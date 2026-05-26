const supabase = require('../../config/supabase');

async function isMemberOfProject(userId, projectId) {
    const { data } = await supabase
        .from('project_member')
        .select('id_user')
        .eq('id_user', userId)
        .eq('id_project', projectId)
        .maybeSingle();
    return data !== null;
}

async function isPMOfProject(userId, projectId) {
    const { data } = await supabase
        .from('project')
        .select('id_pm')
        .eq('id_project', projectId)
        .single();
    return data?.id_pm === userId;
}

// ─── GET /risks?project_id=X ─────────────────────────────────────────────────
async function listRisks(req, res) {
    try {
        const projectId = parseInt(req.query.project_id);
        if (!projectId) {
            return res.status(400).json({ message: 'project_id es requerido' });
        }

        const userId = req.user.id_user;
        const role   = req.user.role;

        if (role !== 'admin') {
            const isPM     = await isPMOfProject(userId, projectId);
            const isMember = isPM || await isMemberOfProject(userId, projectId);
            if (!isMember) {
                return res.status(403).json({ message: 'No tienes acceso a los riesgos de este proyecto' });
            }
        }

        const { data: risks, error } = await supabase
            .from('risk')
            .select('*')
            .eq('id_project', projectId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ message: 'Error cargando riesgos', error: error.message });
        }

        return res.status(200).json({ risks: risks || [] });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

// ─── POST /risks ──────────────────────────────────────────────────────────────
async function createRisk(req, res) {
    try {
        const { id_project, title, description, level } = req.body;
        const userId = req.user.id_user;

        const isPM = await isPMOfProject(userId, id_project);
        if (!isPM) {
            return res.status(403).json({ message: 'Solo el PM del proyecto puede registrar riesgos' });
        }

        const { data: risk, error } = await supabase
            .from('risk')
            .insert([{ id_project, title, description: description || null, level, status: 'active' }])
            .select()
            .single();

        if (error) {
            return res.status(500).json({ message: 'Error creando riesgo', error: error.message });
        }

        await supabase.from('audit_log').insert([{
            id_user:   userId,
            action:    'CREATE_RISK',
            entity:    'risk',
            entity_id: String(risk.id_risk),
            payload:   { project_id: id_project, level },
        }]);

        return res.status(201).json({ message: 'Riesgo registrado', risk });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

// ─── PATCH /risks/:id/status ──────────────────────────────────────────────────
async function updateRiskStatus(req, res) {
    try {
        const riskId = parseInt(req.params.id);
        const { status } = req.body;
        const userId = req.user.id_user;

        const { data: risk, error: fetchErr } = await supabase
            .from('risk')
            .select('*')
            .eq('id_risk', riskId)
            .single();

        if (fetchErr || !risk) {
            return res.status(404).json({ message: 'Riesgo no encontrado' });
        }

        if (risk.status !== 'active') {
            return res.status(400).json({ message: 'Solo se pueden cerrar o descartar riesgos activos' });
        }

        const isPM = await isPMOfProject(userId, risk.id_project);
        if (!isPM) {
            return res.status(403).json({ message: 'Solo el PM del proyecto puede cambiar el estado de un riesgo' });
        }

        const { data: updated, error: updateErr } = await supabase
            .from('risk')
            .update({ status, closed_at: new Date().toISOString() })
            .eq('id_risk', riskId)
            .select()
            .single();

        if (updateErr) {
            return res.status(500).json({ message: 'Error actualizando riesgo', error: updateErr.message });
        }

        await supabase.from('audit_log').insert([{
            id_user:   userId,
            action:    status === 'closed' ? 'CLOSE_RISK' : 'DISCARD_RISK',
            entity:    'risk',
            entity_id: String(riskId),
            payload:   { project_id: risk.id_project },
        }]);

        return res.status(200).json({
            message: `Riesgo ${status === 'closed' ? 'cerrado' : 'descartado'}`,
            risk: updated,
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

// ─── DELETE /risks/:id ────────────────────────────────────────────────────────
async function deleteRisk(req, res) {
    try {
        const riskId = parseInt(req.params.id);
        const userId = req.user.id_user;

        const { data: risk, error: fetchErr } = await supabase
            .from('risk')
            .select('*')
            .eq('id_risk', riskId)
            .single();

        if (fetchErr || !risk) {
            return res.status(404).json({ message: 'Riesgo no encontrado' });
        }

        if (risk.status === 'active') {
            return res.status(400).json({ message: 'No se puede eliminar un riesgo activo. Ciérralo o deséchalo primero.' });
        }

        const isPM = await isPMOfProject(userId, risk.id_project);
        if (!isPM) {
            return res.status(403).json({ message: 'Solo el PM del proyecto puede eliminar riesgos' });
        }

        const { error: deleteErr } = await supabase
            .from('risk')
            .delete()
            .eq('id_risk', riskId);

        if (deleteErr) {
            return res.status(500).json({ message: 'Error eliminando riesgo', error: deleteErr.message });
        }

        return res.status(200).json({ message: 'Riesgo eliminado' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

module.exports = { listRisks, createRisk, updateRiskStatus, deleteRisk };
