const supabase = require('../../config/supabase');

// =====================================================
// GET /projects
// CA-04 (HU-08): filtra proyectos según rol
//   admin  → todos
//   pm     → solo los que tiene asignados (id_pm)
//   viewer → solo los que está vinculado (project_member)
// =====================================================
async function getProjects(req, res) {
    try {
        const { id_user, role } = req.user;
        let query = supabase.from('project').select('*');

        if (role === 'pm') {
            query = query.eq('id_pm', id_user);
        } else if (role === 'viewer') {
            const { data: memberships, error: memErr } = await supabase
                .from('project_member')
                .select('id_project')
                .eq('id_user', id_user);

            if (memErr) return res.status(500).json({ error: memErr.message });

            const projectIds = memberships.map(m => m.id_project);
            if (projectIds.length === 0) return res.status(200).json([]);

            query = query.in('id_project', projectIds);
        }
        // admin: sin filtro adicional

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// =====================================================
// GET /projects/managers
// Devuelve PMs disponibles (sin proyecto asignado)
// =====================================================
async function getManagers(req, res) {
    try {
        const { data: roles, error: roleErr } = await supabase
            .from('role')
            .select('id_user')
            .eq('status', 'pm');

        if (roleErr) return res.status(500).json({ error: roleErr.message });

        const pmIds = roles.map(r => r.id_user);
        if (pmIds.length === 0) return res.status(200).json({ pms: [] });

        const { data: users, error: usersErr } = await supabase
            .from('users')
            .select('id_user, username, email')
            .in('id_user', pmIds);

        if (usersErr) return res.status(500).json({ error: usersErr.message });

        const { data: busyProjects, error: busyErr } = await supabase
            .from('project')
            .select('id_pm');

        if (busyErr) return res.status(500).json({ error: busyErr.message });

        const busyPmSet = new Set(busyProjects.map(p => p.id_pm));
        const availablePms = users.filter(u => !busyPmSet.has(u.id_user));

        return res.status(200).json({ pms: availablePms });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// =====================================================
// GET /projects/viewers
// Usuarios con rol 'viewer'
// =====================================================
async function getViewers(req, res) {
    try {
        const { data: roles, error: roleErr } = await supabase
            .from('role')
            .select('id_user')
            .eq('status', 'viewer');

        if (roleErr) return res.status(500).json({ error: roleErr.message });

        const viewerIds = roles.map(r => r.id_user);
        if (viewerIds.length === 0) return res.status(200).json({ viewers: [] });

        const { data: users, error: usersErr } = await supabase
            .from('users')
            .select('id_user, username, email')
            .in('id_user', viewerIds);

        if (usersErr) return res.status(500).json({ error: usersErr.message });

        return res.status(200).json({ viewers: users });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// =====================================================
// POST /projects/create
//   CA-01: PM asignado obligatorio
//   CA-02: el PM debe tener rol 'pm'
//   CA-03: no guardable sin PM
//   CA-01 (HU-08): viewer_ids deben tener rol 'viewer'
//   CA-04: auditoría al guardar
// =====================================================
async function createProject(req, res) {
    try {
        const {
            id_pm,
            project_name,
            description,
            start_date,
            deadline,
            client_name,
            estimated_sp,
            viewer_ids = [],
        } = req.body;

        if (!project_name || !client_name) {
            return res.status(400).json({ message: 'project_name y client_name son obligatorios' });
        }
        if (!id_pm) {
            return res.status(400).json({ message: 'CA-03: se requiere asignar un PM' });
        }
        if (start_date && deadline && new Date(deadline) <= new Date(start_date)) {
            return res.status(400).json({ message: 'El deadline debe ser posterior a la fecha de inicio' });
        }

        // CA-02: el PM debe tener rol 'pm'
        const { data: pmRole, error: pmRoleErr } = await supabase
            .from('role')
            .select('status')
            .eq('id_user', id_pm)
            .single();

        if (pmRoleErr || !pmRole) {
            return res.status(400).json({ message: 'CA-02: el usuario asignado no tiene rol registrado' });
        }
        if (pmRole.status !== 'pm') {
            return res.status(400).json({
                message: `CA-02: el usuario asignado tiene rol '${pmRole.status}', se requiere 'pm'`
            });
        }

        // Un solo proyecto por PM
        const { data: existingPmProject, error: existingErr } = await supabase
            .from('project')
            .select('id_project, project_name')
            .eq('id_pm', id_pm);

        if (existingErr) {
            return res.status(500).json({ message: 'Error verificando PM', error: existingErr.message });
        }
        if (existingPmProject && existingPmProject.length > 0) {
            return res.status(400).json({
                message: `El PM ya está asignado al proyecto "${existingPmProject[0].project_name}". Un PM solo puede gestionar un proyecto a la vez.`
            });
        }

        // Nombre único
        const { data: nameDup } = await supabase
            .from('project')
            .select('id_project')
            .eq('project_name', project_name)
            .limit(1);

        if (nameDup && nameDup.length > 0) {
            return res.status(400).json({ message: 'Ya existe un proyecto con ese nombre' });
        }

        // CA-01 (HU-08): validar que viewer_ids tengan rol 'viewer'
        if (Array.isArray(viewer_ids) && viewer_ids.length > 0) {
            const { data: viewerRoles, error: vrErr } = await supabase
                .from('role')
                .select('id_user, status')
                .in('id_user', viewer_ids);

            if (vrErr) return res.status(500).json({ message: 'Error verificando roles de viewers' });

            const invalidViewers = viewer_ids.filter(vid => {
                const r = viewerRoles.find(vr => vr.id_user === vid);
                return !r || r.status !== 'viewer';
            });

            if (invalidViewers.length > 0) {
                return res.status(400).json({
                    message: `CA-01: los siguientes usuarios no tienen rol viewer: ${invalidViewers.join(', ')}`
                });
            }
        }

        // Insertar proyecto
        const { data: created, error: insertErr } = await supabase
            .from('project')
            .insert([{
                id_pm,
                project_name,
                description: description || null,
                start_date: start_date || null,
                deadline: deadline || null,
                client_name,
                estimated_sp: estimated_sp || null,
            }])
            .select()
            .single();

        if (insertErr) {
            return res.status(500).json({ message: 'Error creando proyecto', error: insertErr.message });
        }

        // Asignar viewers en project_member
        if (Array.isArray(viewer_ids) && viewer_ids.length > 0) {
            const { error: memberErr } = await supabase
                .from('project_member')
                .insert(viewer_ids.map(id_user => ({ id_project: created.id_project, id_user })));
            if (memberErr) console.warn('Warning asignando viewers:', memberErr.message);
        }

        // Auditoría
        const { error: auditErr } = await supabase
            .from('audit_log')
            .insert([{
                id_user: req.user.id_user,
                action: 'CREATE_PROJECT',
                entity: 'project',
                entity_id: String(created.id_project),
                payload: { project_name: created.project_name, client_name: created.client_name, id_pm: created.id_pm, viewer_ids },
            }]);

        if (auditErr) console.warn('Warning: audit log falló:', auditErr.message);

        return res.status(201).json({ message: 'Proyecto creado exitosamente', project: created });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
}

// =====================================================
// GET /projects/:id/viewers
// Lista los viewers vinculados a un proyecto.
// CA-02: solo el PM del proyecto o admin puede consultar.
// =====================================================
async function getProjectViewers(req, res) {
    try {
        const projectId = parseInt(req.params.id);
        const { id_user, role } = req.user;

        const { data: project, error: projErr } = await supabase
            .from('project')
            .select('id_project, id_pm, project_name')
            .eq('id_project', projectId)
            .single();

        if (projErr || !project) {
            return res.status(404).json({ message: 'Proyecto no encontrado' });
        }

        // CA-02
        if (role === 'pm' && project.id_pm !== id_user) {
            return res.status(403).json({ message: 'CA-02: solo el PM asignado puede gestionar viewers de este proyecto' });
        }

        const { data: members, error: memErr } = await supabase
            .from('project_member')
            .select('id_user')
            .eq('id_project', projectId);

        if (memErr) return res.status(500).json({ error: memErr.message });
        if (members.length === 0) return res.status(200).json({ viewers: [] });

        const { data: users, error: usersErr } = await supabase
            .from('users')
            .select('id_user, username, email')
            .in('id_user', members.map(m => m.id_user));

        if (usersErr) return res.status(500).json({ error: usersErr.message });

        return res.status(200).json({ viewers: users });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// =====================================================
// POST /projects/:id/viewers
// Agrega un viewer a un proyecto existente.
//   CA-01: el usuario debe tener rol 'viewer'
//   CA-02: solo el PM asignado o admin puede agregar
//   CA-03: permite mismo viewer en múltiples proyectos
// =====================================================
async function addViewerToProject(req, res) {
    try {
        const projectId = parseInt(req.params.id);
        const { viewer_id } = req.body;
        const { id_user, role } = req.user;

        if (!viewer_id) {
            return res.status(400).json({ message: 'viewer_id es requerido' });
        }

        const { data: project, error: projErr } = await supabase
            .from('project')
            .select('id_project, id_pm, project_name')
            .eq('id_project', projectId)
            .single();

        if (projErr || !project) {
            return res.status(404).json({ message: 'Proyecto no encontrado' });
        }

        // CA-02
        if (role === 'pm' && project.id_pm !== id_user) {
            return res.status(403).json({ message: 'CA-02: solo el PM asignado puede agregar viewers a este proyecto' });
        }

        // CA-01
        const { data: viewerRole, error: vrErr } = await supabase
            .from('role')
            .select('status')
            .eq('id_user', viewer_id)
            .single();

        if (vrErr || !viewerRole) {
            return res.status(400).json({ message: 'CA-01: el usuario no tiene rol registrado' });
        }
        if (viewerRole.status !== 'viewer') {
            return res.status(400).json({
                message: `CA-01: el usuario tiene rol '${viewerRole.status}', se requiere 'viewer'`
            });
        }

        // CA-03: evitar duplicados
        const { data: existing } = await supabase
            .from('project_member')
            .select('id_member')
            .eq('id_project', projectId)
            .eq('id_user', viewer_id)
            .limit(1);

        if (existing && existing.length > 0) {
            return res.status(409).json({ message: 'El viewer ya está vinculado a este proyecto' });
        }

        const { error: insertErr } = await supabase
            .from('project_member')
            .insert([{ id_project: projectId, id_user: viewer_id }]);

        if (insertErr) return res.status(500).json({ message: 'Error vinculando viewer', error: insertErr.message });

        await supabase
            .from('audit_log')
            .insert([{
                id_user,
                action: 'ADD_VIEWER',
                entity: 'project_member',
                entity_id: String(projectId),
                payload: { project_name: project.project_name, viewer_id },
            }]);

        return res.status(201).json({ message: 'Viewer vinculado exitosamente' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// =====================================================
// DELETE /projects/:id/viewers/:viewer_id
// Desvincula un viewer de un proyecto.
// CA-02: solo el PM del proyecto o admin puede hacerlo.
// =====================================================
async function removeViewerFromProject(req, res) {
    try {
        const projectId = parseInt(req.params.id);
        const viewerId = parseInt(req.params.viewer_id);
        const { id_user, role } = req.user;

        const { data: project, error: projErr } = await supabase
            .from('project')
            .select('id_project, id_pm, project_name')
            .eq('id_project', projectId)
            .single();

        if (projErr || !project) {
            return res.status(404).json({ message: 'Proyecto no encontrado' });
        }

        // CA-02
        if (role === 'pm' && project.id_pm !== id_user) {
            return res.status(403).json({ message: 'CA-02: solo el PM asignado puede gestionar viewers de este proyecto' });
        }

        const { error: deleteErr } = await supabase
            .from('project_member')
            .delete()
            .eq('id_project', projectId)
            .eq('id_user', viewerId);

        if (deleteErr) return res.status(500).json({ message: 'Error desvinculando viewer', error: deleteErr.message });

        await supabase
            .from('audit_log')
            .insert([{
                id_user,
                action: 'REMOVE_VIEWER',
                entity: 'project_member',
                entity_id: String(projectId),
                payload: { project_name: project.project_name, viewer_id: viewerId },
            }]);

        return res.status(200).json({ message: 'Viewer desvinculado exitosamente' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// =====================================================
// GET /projects/:id/assignable
// Devuelve el PM del proyecto + todos los viewers vinculados.
// Usado para poblar el dropdown de asignación en el Sprint Board.
// =====================================================
async function getAssignableMembers(req, res) {
    try {
        const projectId = parseInt(req.params.id);

        const { data: project, error: projErr } = await supabase
            .from('project')
            .select('id_project, id_pm')
            .eq('id_project', projectId)
            .single();

        if (projErr || !project) {
            return res.status(404).json({ message: 'Proyecto no encontrado' });
        }

        // Obtener datos del PM
        const { data: pmUser } = await supabase
            .from('users')
            .select('id_user, username, email')
            .eq('id_user', project.id_pm)
            .single();

        // Obtener viewers vinculados al proyecto
        const { data: members } = await supabase
            .from('project_member')
            .select('id_user')
            .eq('id_project', projectId);

        const viewerIds = (members || []).map(m => m.id_user);

        let viewerUsers = [];
        if (viewerIds.length > 0) {
            const { data } = await supabase
                .from('users')
                .select('id_user, username, email')
                .in('id_user', viewerIds);
            viewerUsers = data || [];
        }

        const assignable = [];
        if (pmUser) assignable.push({ ...pmUser, projectRole: 'pm' });
        viewerUsers.forEach(v => assignable.push({ ...v, projectRole: 'viewer' }));

        return res.status(200).json({ assignable });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

module.exports = {
    getProjects,
    getManagers,
    getViewers,
    createProject,
    getProjectViewers,
    addViewerToProject,
    removeViewerFromProject,
    getAssignableMembers,
};
