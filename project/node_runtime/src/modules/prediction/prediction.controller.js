// project/node_runtime/src/modules/prediction/prediction.controller.js
const supabase = require('../../config/supabase');
const { buildPrediction } = require('./prediction.utils');

// GET /projects/:id/prediction
// HU-24 — Predicción del cumplimiento del deadline basada en SP completados por sprint.
// Acceso: admin (cualquier proyecto), pm (su proyecto), viewer (proyectos vinculados).
async function getProjectPrediction(req, res) {
    try {
        const projectId = parseInt(req.params.id, 10);
        if (Number.isNaN(projectId)) {
            return res.status(400).json({ message: 'project_id inválido' });
        }
        const { id_user, role } = req.user;

        // 1. Cargar proyecto
        const { data: project, error: projErr } = await supabase
            .from('project')
            .select('id_project, id_pm, project_name, estimated_sp, deadline, start_date')
            .eq('id_project', projectId)
            .single();
        if (projErr || !project) {
            return res.status(404).json({ message: 'Proyecto no encontrado' });
        }

        // 2. RBAC: admin OK, PM solo el suyo, viewer solo si está vinculado.
        if (role === 'pm' && project.id_pm !== id_user) {
            return res.status(403).json({ message: 'No tienes acceso a este proyecto' });
        }
        if (role === 'viewer') {
            const { data: member } = await supabase
                .from('project_member')
                .select('id_user')
                .eq('id_project', projectId)
                .eq('id_user', id_user)
                .maybeSingle();
            if (!member) {
                return res.status(403).json({ message: 'No tienes acceso a este proyecto' });
            }
        }

        // 3. Cargar todos los sprints del proyecto
        const { data: allSprints, error: sprintsErr } = await supabase
            .from('sprint')
            .select('id_sprint, begin_at, deadline')
            .eq('id_project', projectId);
        if (sprintsErr) {
            return res.status(500).json({ message: 'Error cargando sprints', error: sprintsErr.message });
        }

        const now = new Date();
        const nowMs = now.getTime();
        const pastSprintsBase = (allSprints || []).filter(s => {
            if (!s.deadline) return false;
            return new Date(s.deadline).getTime() < nowMs;
        });

        // 4. Cargar work_items del proyecto (vía id_sprint ∈ sprints del proyecto)
        const sprintIds = (allSprints || []).map(s => s.id_sprint);
        let workItems = [];
        if (sprintIds.length > 0) {
            const { data: items, error: itemsErr } = await supabase
                .from('work_item')
                .select('id_work_item, id_sprint, story_points, status')
                .in('id_sprint', sprintIds);
            if (itemsErr) {
                return res.status(500).json({ message: 'Error cargando work items', error: itemsErr.message });
            }
            workItems = items || [];
        }

        // 5. doneSp por sprint pasado
        const doneSpBySprintId = {};
        for (const wi of workItems) {
            if (wi.status !== 'done') continue;
            const sp = wi.story_points || 0;
            doneSpBySprintId[wi.id_sprint] = (doneSpBySprintId[wi.id_sprint] || 0) + sp;
        }
        const pastSprints = pastSprintsBase.map(s => ({
            id_sprint: s.id_sprint,
            begin_at:  s.begin_at,
            deadline:  s.deadline,
            doneSp:    doneSpBySprintId[s.id_sprint] || 0,
        }));

        // 6. doneSpTotal (TODOS los sprints) y totalSp
        const doneSpTotal = workItems
            .filter(wi => wi.status === 'done')
            .reduce((acc, wi) => acc + (wi.story_points || 0), 0);

        let totalSp = project.estimated_sp;
        if (totalSp === null || totalSp === undefined || totalSp <= 0) {
            totalSp = workItems.reduce((acc, wi) => acc + (wi.story_points || 0), 0);
        }

        // 7. Construir predicción
        const prediction = buildPrediction({
            project,
            pastSprints,
            doneSpTotal,
            totalSp,
            now,
        });

        return res.status(200).json({
            project_id:    project.id_project,
            project_name:  project.project_name,
            deadline:      project.deadline,
            computed_at:   now.toISOString(),
            ...prediction,
        });
    } catch (err) {
        return res.status(500).json({ message: 'Error inesperado en predicción', error: err.message });
    }
}

module.exports = { getProjectPrediction };
