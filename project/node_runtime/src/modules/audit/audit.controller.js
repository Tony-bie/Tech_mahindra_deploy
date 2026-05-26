// project/node_runtime/src/modules/audit/audit.controller.js
const supabase = require('../../config/supabase');
const { actionLabel, extractBeforeAfter } = require('./audit.utils');

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

// GET /audit
// HU-23 CA-01/02/03 — Lectura de bitácora con RBAC.
// Query params (todos opcionales):
//   entity      string (e.g., 'project', 'work_item', 'spend', 'risk', 'blocker')
//   action      string exacto (e.g., 'COST_APPROVED')
//   project_id  int
//   user_id     int
//   from        ISO date (incluido)
//   to          ISO date (incluido)
//   limit       int (default 50, max 200)
//   offset      int (default 0)
async function listAudit(req, res) {
    try {
        const { id_user, role } = req.user;

        // RBAC: PM solo ve eventos de sus proyectos. Admin ve todo.
        let allowedProjectIds = null; // null = sin filtro (admin)
        if (role === 'pm') {
            const { data: ownProjects, error: pErr } = await supabase
                .from('project')
                .select('id_project')
                .eq('id_pm', id_user);
            if (pErr) return res.status(500).json({ message: 'Error cargando proyectos del PM', error: pErr.message });
            allowedProjectIds = (ownProjects || []).map(p => p.id_project);
            if (allowedProjectIds.length === 0) {
                return res.status(200).json({ rows: [], total: 0, limit: DEFAULT_LIMIT, offset: 0 });
            }
        } else if (role !== 'admin') {
            return res.status(403).json({ message: 'Solo admin y PM pueden consultar la bitácora' });
        }

        const entity     = req.query.entity || null;
        const action     = req.query.action || null;
        let projectId    = null;
        if (req.query.project_id !== undefined && req.query.project_id !== '') {
            const parsed = parseInt(req.query.project_id, 10);
            if (Number.isNaN(parsed)) {
                return res.status(400).json({ message: 'project_id inválido' });
            }
            projectId = parsed;
        }
        let userId       = null;
        if (req.query.user_id !== undefined && req.query.user_id !== '') {
            const parsed = parseInt(req.query.user_id, 10);
            if (Number.isNaN(parsed)) {
                return res.status(400).json({ message: 'user_id inválido' });
            }
            userId = parsed;
        }
        const from       = req.query.from || null;
        const to         = req.query.to   || null;
        if (from && Number.isNaN(Date.parse(from))) {
            return res.status(400).json({ message: 'Parámetro from inválido (debe ser ISO date)' });
        }
        if (to && Number.isNaN(Date.parse(to))) {
            return res.status(400).json({ message: 'Parámetro to inválido (debe ser ISO date)' });
        }
        const rawLimit   = Number(req.query.limit);
        const limit      = Math.min(Math.max(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : DEFAULT_LIMIT, 1), MAX_LIMIT);
        const offset     = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        // Si PM filtra project_id, debe ser uno de los suyos.
        if (role === 'pm' && projectId && !allowedProjectIds.includes(projectId)) {
            return res.status(403).json({ message: 'No tienes acceso a la bitácora de ese proyecto' });
        }

        let q = supabase
            .from('audit_log')
            .select('id_audit, id_user, action, entity, entity_id, payload, created_at', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (entity)    q = q.eq('entity', entity);
        if (action)    q = q.eq('action', action);
        if (userId)    q = q.eq('id_user', userId);
        if (from)      q = q.gte('created_at', from);
        if (to)        q = q.lte('created_at', to);

        // Filtro por project_id: vive dentro de payload (jsonb).
        if (projectId) {
            q = q.eq('payload->>project_id', String(projectId));
        } else if (role === 'pm') {
            // PM sin filtro explícito → traer solo eventos cuyos payload.project_id estén en su lista
            // o eventos sin project_id (logins, etc.) — los excluimos para PM ya que no son de su scope.
            q = q.in('payload->>project_id', allowedProjectIds.map(String));
        }

        const { data: rows, error, count } = await q;
        if (error) return res.status(500).json({ message: 'Error consultando audit_log', error: error.message });

        // Hidratar usuarios para mostrar username
        const userIds = [...new Set((rows || []).map(r => r.id_user).filter(Boolean))];
        let usersById = {};
        if (userIds.length > 0) {
            const { data: users, error: usersErr } = await supabase
                .from('users')
                .select('id_user, username')
                .in('id_user', userIds);
            if (usersErr) {
                console.warn('audit users hydration falló:', usersErr.message);
            }
            usersById = Object.fromEntries((users || []).map(u => [u.id_user, u.username]));
        }

        // Normalizar a contrato de respuesta
        const normalized = (rows || []).map(r => {
            const { before, after } = extractBeforeAfter(r.action, r.payload);
            return {
                id:           r.id_audit,
                who:          { id: r.id_user, username: usersById[r.id_user] || null },
                when:         r.created_at,
                action:       r.action,
                action_label: actionLabel(r.action),
                entity:       r.entity,
                entity_id:    r.entity_id,
                project_id:   r.payload?.project_id ?? null,
                project_name: r.payload?.project_name ?? null,
                before,
                after,
                raw_payload:  r.payload,
            };
        });

        return res.status(200).json({
            rows: normalized,
            total: count ?? normalized.length,
            limit,
            offset,
        });
    } catch (err) {
        return res.status(500).json({ message: 'Error inesperado en bitácora', error: err.message });
    }
}

module.exports = { listAudit };
