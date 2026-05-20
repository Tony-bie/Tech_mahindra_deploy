const supabase = require('../../config/supabase');

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Verifica que el usuario sea PM del proyecto
async function isPMOfProject(userId, projectId) {
    const { data: project, error } = await supabase
        .from('project')
        .select('id_pm')
        .eq('id_project', projectId)
        .single();

    if (error || !project) {
        return false;
    }

    return project.id_pm === userId;
}

// Verifica que el item esté asignado al usuario actual
async function isItemAssignedToUser(itemId, userId) {
    const { data: item, error } = await supabase
        .from('work_item')
        .select('assignee_id')
        .eq('id_work_item', itemId)
        .single();

    if (error || !item) {
        return false;
    }

    return item.assignee_id === userId;
}

// ─── POST /blockers ─────────────────────────────────────────────────────────
// CA-01, CA-02, CA-03: crear bloqueador/implicación
async function createBlocker(req, res) {
    try {
        const { id_work_item, id_project, kind, severity, description, impact } = req.body;
        const userId = req.user.id_user;

        // CA-03: Verificar que el item exista y esté asignado al usuario
        const isAssigned = await isItemAssignedToUser(id_work_item, userId);
        if (!isAssigned) {
            return res.status(403).json({
                message: 'CA-03: Solo puedes registrar bloqueadores en tus items asignados',
            });
        }

        // Verificar que el proyecto exista
        const { data: project, error: projErr } = await supabase
            .from('project')
            .select('id_project')
            .eq('id_project', id_project)
            .single();

        if (projErr || !project) {
            return res.status(404).json({ message: 'Proyecto no encontrado' });
        }

        // Insertar bloqueador
        const { data: blocker, error: insertErr } = await supabase
            .from('blocker_implication')
            .insert([{
                id_work_item,
                id_project,
                kind,
                severity,
                description,
                impact,
                created_by: userId,
                approval_status: 'pending',
            }])
            .select()
            .single();

        if (insertErr) {
            return res.status(500).json({
                message: 'Error creando bloqueador',
                error: insertErr.message,
            });
        }

        // CA-04: Auditoría si es crítico
        if (severity === 'critical') {
            await supabase.from('audit_log').insert([{
                id_user: userId,
                action: 'CREATE_BLOCKER_CRITICAL',
                entity: 'blocker_implication',
                entity_id: String(blocker.id_blocker),
                payload: {
                    project_id: id_project,
                    work_item_id: id_work_item,
                    severity,
                    description,
                },
            }]);
        }

        return res.status(201).json({
            message: 'Bloqueador registrado correctamente',
            blocker,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// ─── GET /blockers?work_item_id=X | project_id=X ────────────────────────────
// CA-03: listar bloqueadores por item o por proyecto
async function listBlockers(req, res) {
    try {
        const workItemId = parseInt(req.query.work_item_id);
        const projectId = parseInt(req.query.project_id);
        const approvalStatus = req.query.approval_status?.trim();
        const requesterId = req.user.id_user;
        const requesterRole = req.user.role;

        if (!workItemId && !projectId) {
            return res.status(400).json({
                message: 'work_item_id o project_id es requerido',
            });
        }

        if (projectId) {
            const { data: project, error: projectErr } = await supabase
                .from('project')
                .select('id_project, id_pm')
                .eq('id_project', projectId)
                .single();

            if (projectErr || !project) {
                return res.status(404).json({ message: 'Proyecto no encontrado' });
            }

            if (requesterRole === 'pm' && project.id_pm !== requesterId) {
                return res.status(403).json({ message: 'No tienes acceso a los bloqueadores de este proyecto' });
            }
        }

        if (workItemId && requesterRole === 'viewer') {
            const { data: workItem, error: workItemErr } = await supabase
                .from('work_item')
                .select('assignee_id')
                .eq('id_work_item', workItemId)
                .single();

            if (workItemErr || !workItem) {
                return res.status(404).json({ message: 'Work item no encontrado' });
            }

            if (workItem.assignee_id !== requesterId) {
                return res.status(403).json({ message: 'No tienes acceso a los bloqueadores de este item' });
            }
        }

        let blockersQuery = supabase
            .from('blocker_implication')
            .select('*');

        if (workItemId) {
            blockersQuery = blockersQuery.eq('id_work_item', workItemId);
        }

        if (projectId) {
            blockersQuery = blockersQuery.eq('id_project', projectId);
        }

        if (approvalStatus) {
            blockersQuery = blockersQuery.eq('approval_status', approvalStatus);
        }

        const { data: blockers, error } = await blockersQuery.order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({
                message: 'Error cargando bloqueadores',
                error: error.message,
            });
        }

        const workItemIds = [...new Set((blockers || []).map(b => b.id_work_item).filter(Boolean))];
        const sprintIds = new Set();

        let workItemMap = {};
        let sprintMap = {};

        if (workItemIds.length > 0) {
            const { data: workItems } = await supabase
                .from('work_item')
                .select('id_work_item, id_sprint, title, description, status, type, story_points, assignee_id, created_at, updated_at')
                .in('id_work_item', workItemIds);

            (workItems || []).forEach(item => {
                workItemMap[item.id_work_item] = item;
                if (item.id_sprint) sprintIds.add(item.id_sprint);
            });

            if (sprintIds.size > 0) {
                const { data: sprints } = await supabase
                    .from('sprint')
                    .select('id_sprint, name, begin_at, deadline, status, id_project')
                    .in('id_sprint', [...sprintIds]);

                sprintMap = Object.fromEntries((sprints || []).map(sprint => [sprint.id_sprint, sprint]));
            }
        }

        // Hidratar info de creador y aprobador
        const userIds = [
            ...new Set(
                (blockers || [])
                    .flatMap(b => [b.created_by, b.approved_by])
                    .filter(Boolean)
            ),
        ];

        let userMap = {};
        if (userIds.length > 0) {
            const { data: users } = await supabase
                .from('users')
                .select('id_user, username, full_name')
                .in('id_user', userIds);

            userMap = Object.fromEntries(
                (users || []).map(u => [u.id_user, u])
            );
        }

        const enriched = (blockers || []).map(b => ({
            ...b,
            created_by_user: b.created_by ? userMap[b.created_by] : null,
            approved_by_user: b.approved_by ? userMap[b.approved_by] : null,
            work_item: workItemMap[b.id_work_item] || null,
            sprint: workItemMap[b.id_work_item]?.id_sprint ? (sprintMap[workItemMap[b.id_work_item].id_sprint] || null) : null,
        }));

        return res.status(200).json({ blockers: enriched });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// ─── PATCH /blockers/:id/approve ────────────────────────────────────────
// Solo PM del proyecto puede aprobar
async function approveBlocker(req, res) {
    try {
        const blockerId = parseInt(req.params.id);
        const { deadline } = req.body;
        const userId = req.user.id_user;

        // Obtener bloqueador
        const { data: blocker, error: fetchErr } = await supabase
            .from('blocker_implication')
            .select('*')
            .eq('id_blocker', blockerId)
            .single();

        if (fetchErr || !blocker) {
            return res.status(404).json({ message: 'Bloqueador no encontrado' });
        }

        // Verificar que sea PM del proyecto
        const isPM = await isPMOfProject(userId, blocker.id_project);
        if (!isPM) {
            return res.status(403).json({
                message: 'Solo el PM del proyecto puede aprobar bloqueadores',
            });
        }

        // Actualizar estado a aprobado con fecha límite
        const { data: updated, error: updateErr } = await supabase
            .from('blocker_implication')
            .update({
                approval_status: 'approved',
                approved_by: userId,
                decided_at: new Date().toISOString(),
                deadline,
            })
            .eq('id_blocker', blockerId)
            .select()
            .single();

        if (updateErr) {
            return res.status(500).json({
                message: 'Error aprobando bloqueador',
                error: updateErr.message,
            });
        }

        // Auditoría
        await supabase.from('audit_log').insert([{
            id_user: userId,
            action: 'APPROVE_BLOCKER',
            entity: 'blocker_implication',
            entity_id: String(blockerId),
            payload: {
                project_id: blocker.id_project,
                work_item_id: blocker.id_work_item,
                severity: blocker.severity,
            },
        }]);

        return res.status(200).json({
            message: 'Bloqueador aprobado',
            blocker: updated,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// ─── PATCH /blockers/:id/reject ─────────────────────────────────────────
// Solo PM del proyecto puede rechazar
async function rejectBlocker(req, res) {
    try {
        const blockerId = parseInt(req.params.id);
        const { rejected_reason } = req.body;
        const userId = req.user.id_user;

        // Obtener bloqueador
        const { data: blocker, error: fetchErr } = await supabase
            .from('blocker_implication')
            .select('*')
            .eq('id_blocker', blockerId)
            .single();

        if (fetchErr || !blocker) {
            return res.status(404).json({ message: 'Bloqueador no encontrado' });
        }

        // Verificar que sea PM del proyecto
        const isPM = await isPMOfProject(userId, blocker.id_project);
        if (!isPM) {
            return res.status(403).json({
                message: 'Solo el PM del proyecto puede rechazar bloqueadores',
            });
        }

        // Actualizar estado a rechazado
        const { data: updated, error: updateErr } = await supabase
            .from('blocker_implication')
            .update({
                approval_status: 'rejected',
                approved_by: userId,
                rejected_reason,
                decided_at: new Date().toISOString(),
            })
            .eq('id_blocker', blockerId)
            .select()
            .single();

        if (updateErr) {
            return res.status(500).json({
                message: 'Error rechazando bloqueador',
                error: updateErr.message,
            });
        }

        // Auditoría
        await supabase.from('audit_log').insert([{
            id_user: userId,
            action: 'REJECT_BLOCKER',
            entity: 'blocker_implication',
            entity_id: String(blockerId),
            payload: {
                project_id: blocker.id_project,
                work_item_id: blocker.id_work_item,
                reason: rejected_reason,
            },
        }]);

        return res.status(200).json({
            message: 'Bloqueador rechazado',
            blocker: updated,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// ─── PATCH /blockers/:id/resolve ────────────────────────────────────────
// Viewer asignado al work item puede marcar el bloqueador como resuelto
async function resolveBlocker(req, res) {
    try {
        const blockerId = parseInt(req.params.id);
        const userId = req.user.id_user;

        const { data: blocker, error: fetchErr } = await supabase
            .from('blocker_implication')
            .select('*')
            .eq('id_blocker', blockerId)
            .single();

        if (fetchErr || !blocker) {
            return res.status(404).json({ message: 'Bloqueador no encontrado' });
        }

        if (blocker.approval_status !== 'approved') {
            return res.status(400).json({ message: 'Solo se pueden resolver bloqueadores aprobados' });
        }

        if (blocker.resolved_at) {
            return res.status(400).json({ message: 'Este bloqueador ya fue resuelto' });
        }

        // Solo el viewer asignado al work item puede resolver
        const isAssigned = await isItemAssignedToUser(blocker.id_work_item, userId);
        if (!isAssigned) {
            return res.status(403).json({ message: 'Solo el responsable del ítem puede finalizar el bloqueador' });
        }

        const { data: updated, error: updateErr } = await supabase
            .from('blocker_implication')
            .update({
                resolved_at: new Date().toISOString(),
                resolved_by: userId,
            })
            .eq('id_blocker', blockerId)
            .select()
            .single();

        if (updateErr) {
            return res.status(500).json({ message: 'Error resolviendo bloqueador', error: updateErr.message });
        }

        await supabase.from('audit_log').insert([{
            id_user: userId,
            action: 'RESOLVE_BLOCKER',
            entity: 'blocker_implication',
            entity_id: String(blockerId),
            payload: { project_id: blocker.id_project, work_item_id: blocker.id_work_item },
        }]);

        return res.status(200).json({ message: 'Bloqueador finalizado', blocker: updated });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

module.exports = {
    createBlocker,
    listBlockers,
    approveBlocker,
    rejectBlocker,
    resolveBlocker,
};
