const supabase             = require('../../config/supabase');
const { computeRiskScore } = require('../semaphore/riskScore');

// ─── GET /dashboard/admin ────────────────────────────────────────────────────
// Dashboard consolidado para el rol admin. Calcula KPIs, agrega series para
// graficas (work items, sprints, costos, actividad, equipo, vencimientos) y
// devuelve la tabla por proyecto. Todo con queries en lote (CA-03).
// `avance_real`, `avance_promedio` y `completion_rate` son ratios 0-1.
async function getAdminDashboard(req, res) {
    try {
        // ── Queries en lote ──────────────────────────────────────────────────

        // 1. Proyectos
        const { data: projects, error: projErr } = await supabase
            .from('project')
            .select('id_project, project_name, client_name, estimated_sp, deadline, start_date');
        if (projErr) return res.status(500).json({ error: projErr.message });

        // 2. Sprints
        const { data: sprints, error: sprintErr } = await supabase
            .from('sprint')
            .select('id_sprint, id_project, status, SP_estimated, deadline');
        if (sprintErr) return res.status(500).json({ error: sprintErr.message });

        const sprintToProject = Object.fromEntries(
            (sprints || []).map(s => [s.id_sprint, s.id_project])
        );

        // 3. Work items
        const { data: workItems, error: wiErr } = await supabase
            .from('work_item')
            .select('id_work_item, id_sprint, title, type, status, story_points, assignee_id, end_date, updated_at');
        if (wiErr) return res.status(500).json({ error: wiErr.message });

        // 4. Budgets
        const { data: budgets, error: budgetErr } = await supabase
            .from('budget')
            .select('id_budget, id_project, total_cost');
        if (budgetErr) return res.status(500).json({ error: budgetErr.message });

        const budgetToProject = Object.fromEntries(
            (budgets || []).map(b => [b.id_budget, b.id_project])
        );
        const budgetToTotal = Object.fromEntries(
            (budgets || []).map(b => [b.id_project, Number(b.total_cost || 0)])
        );

        // 5. Spends (todos: para distribucion por status/categoria)
        const { data: spends, error: spendErr } = await supabase
            .from('spend')
            .select('id_spend, id_budget, spendmoney, type, status');
        if (spendErr) return res.status(500).json({ error: spendErr.message });

        // 6. Risks activos
        const { data: risks, error: riskErr } = await supabase
            .from('risk')
            .select('id_project, level')
            .eq('status', 'active');
        if (riskErr) return res.status(500).json({ error: riskErr.message });

        // 6b. Blockers para Risk Score (RF-25 requiere created_at)
        const { data: blockersAll } = await supabase
            .from('blocker_implication')
            .select('id_project, severity, approval_status, created_at')
            .eq('kind', 'blocker')
            .in('approval_status', ['pending', 'approved']);

        // 7. Users + roles
        const { data: users, error: usersErr } = await supabase
            .from('users')
            .select('id_user, username, full_name');
        if (usersErr) return res.status(500).json({ error: usersErr.message });

        const { data: roles, error: rolesErr } = await supabase
            .from('role')
            .select('id_user, status');
        if (rolesErr) return res.status(500).json({ error: rolesErr.message });

        // 8. Audit log (ultimos 30 dias para timeline, todo para top contributors/actions)
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const { data: auditAll, error: auditErr } = await supabase
            .from('audit_log')
            .select('id_user, action, created_at');
        if (auditErr) return res.status(500).json({ error: auditErr.message });

        // ── Agregaciones por proyecto (tabla principal) ──────────────────────
        const now = new Date();
        const doneSpByProject   = {};
        const totalSpByProject  = {};
        const recentSPByProject = {};
        const sevenDaysAgo = new Date(now - 7 * 86400000);

        for (const wi of (workItems || [])) {
            const pid = sprintToProject[wi.id_sprint];
            if (pid == null) continue;
            totalSpByProject[pid] = (totalSpByProject[pid] || 0) + (wi.story_points || 0);
            if (wi.status === 'done') {
                doneSpByProject[pid] = (doneSpByProject[pid] || 0) + (wi.story_points || 0);
                if (wi.updated_at && new Date(wi.updated_at) >= sevenDaysAgo) {
                    recentSPByProject[pid] = (recentSPByProject[pid] || 0) + (wi.story_points || 0);
                }
            }
        }

        // Sprints por proyecto (para avance esperado y velocidad)
        const sprintsByProject = {};
        for (const s of (sprints || [])) {
            if (!sprintsByProject[s.id_project]) sprintsByProject[s.id_project] = [];
            sprintsByProject[s.id_project].push(s);
        }

        // Bloqueadores por proyecto
        const blockersByProject = {};
        for (const b of (blockersAll || [])) {
            if (!blockersByProject[b.id_project]) blockersByProject[b.id_project] = [];
            blockersByProject[b.id_project].push(b);
        }

        const costoByProject = {};
        for (const sp of (spends || [])) {
            if (sp.status !== 'approved') continue;
            const pid = budgetToProject[sp.id_budget];
            if (pid == null) continue;
            costoByProject[pid] = (costoByProject[pid] || 0) + Number(sp.spendmoney || 0);
        }

        const riesgosByProject = {};
        const activeRisksByProject = {};
        for (const r of (risks || [])) {
            riesgosByProject[r.id_project] = (riesgosByProject[r.id_project] || 0) + 1;
            if (!activeRisksByProject[r.id_project]) activeRisksByProject[r.id_project] = [];
            activeRisksByProject[r.id_project].push(r);
        }

        const nowISO = now.toISOString();
        const projectRows = (projects || []).map(p => {
            const pid        = p.id_project;
            const sp_totales = p.estimated_sp || totalSpByProject[pid] || 0;
            const sp_done    = doneSpByProject[pid] || 0;
            const avance_real_pct = sp_totales > 0 ? (sp_done / sp_totales) * 100 : 0;
            const avance_real     = sp_totales > 0 ? sp_done / sp_totales : null;

            // Avance esperado
            const pastSprints    = (sprintsByProject[pid] || []).filter(s => s.deadline && s.deadline <= nowISO);
            const sp_esperados   = pastSprints.reduce((a, s) => a + (s.SP_estimated || 0), 0);
            const avance_esperado = sp_totales > 0 ? (sp_esperados / sp_totales) * 100 : 0;
            const desviacion      = avance_real_pct - avance_esperado;

            // Velocidad semanal esperada
            let expectedWeeklySP = 0;
            if (p.start_date && p.deadline && sp_totales > 0) {
                const weeks = Math.max(1, (new Date(p.deadline) - new Date(p.start_date)) / (7 * 86400000));
                expectedWeeklySP = sp_totales / weeks;
            }

            const { semaforo } = computeRiskScore({
                desviacion,
                deadline:        p.deadline,
                avance_real:     avance_real_pct,
                costo_aprobado:  costoByProject[pid]        || 0,
                presupuesto:     budgetToTotal[pid]         || 0,
                blockers:        blockersByProject[pid]     || [],
                activeRisks:     activeRisksByProject[pid]  || [],
                recentSP:        recentSPByProject[pid]     || 0,
                expectedWeeklySP,
            });

            return {
                id_project:      pid,
                project_name:    p.project_name,
                client_name:     p.client_name,
                avance_real,
                costo_aprobado:  costoByProject[pid] || 0,
                riesgos_activos: riesgosByProject[pid] || 0,
                desviacion,
                semaforo,
            };
        });

        // SP por proyecto (para grafica de barras)
        const project_sp_progress = (projects || []).map(p => ({
            id_project: p.id_project,
            project_name: p.project_name,
            done_sp: doneSpByProject[p.id_project] || 0,
            total_sp: totalSpByProject[p.id_project] || 0,
            estimated_sp: p.estimated_sp || 0,
        }));

        // ── Work items: distribuciones ───────────────────────────────────────
        const wiStatusMap = {};
        const wiTypeMap = {};
        for (const wi of (workItems || [])) {
            wiStatusMap[wi.status] = (wiStatusMap[wi.status] || 0) + 1;
            wiTypeMap[wi.type] = (wiTypeMap[wi.type] || 0) + 1;
        }
        const work_items_by_status = Object.entries(wiStatusMap).map(([status, n]) => ({ status, n }));
        const work_items_by_type = Object.entries(wiTypeMap).map(([type, n]) => ({ type, n }));

        // ── Sprints por status ───────────────────────────────────────────────
        const sprintStatusMap = {};
        for (const s of (sprints || [])) {
            sprintStatusMap[s.status] = (sprintStatusMap[s.status] || 0) + 1;
        }
        const sprints_by_status = Object.entries(sprintStatusMap).map(([status, n]) => ({ status, n }));

        // ── Users por rol ────────────────────────────────────────────────────
        const roleMap = {};
        for (const r of (roles || [])) {
            roleMap[r.status] = (roleMap[r.status] || 0) + 1;
        }
        const users_by_role = Object.entries(roleMap).map(([role, n]) => ({ role, n }));

        // ── Spends: por categoria (aprobados) y por status (todos) ───────────
        const spendCatMap = {};
        const spendStatusMap = {};
        for (const sp of (spends || [])) {
            const amount = Number(sp.spendmoney || 0);
            if (sp.status === 'approved') {
                spendCatMap[sp.type] = (spendCatMap[sp.type] || 0) + amount;
            }
            if (!spendStatusMap[sp.status]) spendStatusMap[sp.status] = { n: 0, total: 0 };
            spendStatusMap[sp.status].n += 1;
            spendStatusMap[sp.status].total += amount;
        }
        const spends_by_category = Object.entries(spendCatMap).map(([category, approved_total]) => ({
            category,
            approved_total,
        }));
        const spends_by_status = ['pending', 'approved', 'rejected'].map(status => ({
            status,
            n: spendStatusMap[status]?.n || 0,
            total: spendStatusMap[status]?.total || 0,
        }));

        // ── Actividad: por dia (30 dias) + acciones top + top contributors ───
        const sinceMs = since.getTime();
        const dayMap = {};
        const actionMap = {};
        const userEventMap = {};
        for (const ev of (auditAll || [])) {
            const ts = new Date(ev.created_at).getTime();
            if (ts >= sinceMs) {
                const day = new Date(ev.created_at).toISOString().slice(0, 10);
                dayMap[day] = (dayMap[day] || 0) + 1;
            }
            actionMap[ev.action] = (actionMap[ev.action] || 0) + 1;
            if (ev.id_user != null) {
                userEventMap[ev.id_user] = (userEventMap[ev.id_user] || 0) + 1;
            }
        }
        // Rellenar dias sin actividad para que la grafica sea continua
        const activity_by_day = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            activity_by_day.push({ day: key, events: dayMap[key] || 0 });
        }
        const actions_top = Object.entries(actionMap)
            .map(([action, n]) => ({ action, n }))
            .sort((a, b) => b.n - a.n)
            .slice(0, 8);

        const userById = Object.fromEntries((users || []).map(u => [u.id_user, u]));
        const top_contributors = Object.entries(userEventMap)
            .map(([id_user, events]) => ({
                id_user: Number(id_user),
                username: userById[id_user]?.username || `User ${id_user}`,
                full_name: userById[id_user]?.full_name || null,
                events,
            }))
            .sort((a, b) => b.events - a.events)
            .slice(0, 10);

        // ── Vencimientos: deadlines proximos y items overdue ─────────────────
        const in30 = new Date();
        in30.setDate(in30.getDate() + 30);

        const upcoming_deadlines = (projects || [])
            .filter(p => p.deadline)
            .map(p => {
                const d = new Date(p.deadline);
                const daysLeft = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
                return {
                    id_project: p.id_project,
                    project_name: p.project_name,
                    deadline: p.deadline,
                    days_left: daysLeft,
                };
            })
            .filter(x => x.days_left >= 0 && x.days_left <= 30)
            .sort((a, b) => a.days_left - b.days_left);

        const overdue_items = (workItems || [])
            .filter(wi => wi.end_date && wi.status !== 'done')
            .map(wi => {
                const d = new Date(wi.end_date);
                const daysOverdue = Math.floor((now - d) / (1000 * 60 * 60 * 24));
                const pid = sprintToProject[wi.id_sprint];
                const project = (projects || []).find(p => p.id_project === pid);
                return {
                    id_work_item: wi.id_work_item,
                    title: wi.title,
                    end_date: wi.end_date,
                    days_overdue: daysOverdue,
                    project_name: project?.project_name || null,
                    assignee_username: wi.assignee_id ? (userById[wi.assignee_id]?.username || null) : null,
                };
            })
            .filter(x => x.days_overdue > 0)
            .sort((a, b) => b.days_overdue - a.days_overdue)
            .slice(0, 15);

        // ── KPIs (summary) ───────────────────────────────────────────────────
        const total_costo_aprobado = projectRows.reduce((a, r) => a + r.costo_aprobado, 0);
        const total_riesgos_activos = projectRows.reduce((a, r) => a + r.riesgos_activos, 0);
        const avancesValidos = projectRows.map(r => r.avance_real).filter(v => v != null);
        const avance_promedio = avancesValidos.length > 0
            ? avancesValidos.reduce((a, v) => a + v, 0) / avancesValidos.length
            : null;

        const total_work_items = (workItems || []).length;
        const done_count = (workItems || []).filter(wi => wi.status === 'done').length;
        const completion_rate = total_work_items > 0 ? done_count / total_work_items : null;
        const active_sprints = (sprints || []).filter(s => s.status === 'active').length;
        const total_users = (users || []).length;
        const pending_costs = (spends || []).filter(sp => sp.status === 'pending');
        const pending_costs_count = pending_costs.length;
        const pending_costs_amount = pending_costs.reduce((a, sp) => a + Number(sp.spendmoney || 0), 0);
        const overdue_items_count = overdue_items.length;

        return res.status(200).json({
            projects: projectRows,
            summary: {
                total_projects: projectRows.length,
                total_costo_aprobado,
                total_riesgos_activos,
                avance_promedio,
                total_users,
                active_sprints,
                total_work_items,
                completion_rate,
                pending_costs_count,
                pending_costs_amount,
                overdue_items_count,
            },
            charts: {
                work_items_by_status,
                work_items_by_type,
                sprints_by_status,
                users_by_role,
                spends_by_category,
                spends_by_status,
                activity_by_day,
                actions_top,
                top_contributors,
                project_sp_progress,
            },
            lists: {
                upcoming_deadlines,
                overdue_items,
            },
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// ─── GET /dashboard/leaderboard?project_id=:id ───────────────────────────────
// Ranking semanal de los viewers asignados a un proyecto específico.
// Puntos = story_points × gamification_weight  (+25 % si cerrado a tiempo).
// Semana = lunes 00:00 → domingo 23:59 UTC del momento de la petición.
async function getLeaderboard(req, res) {
    try {
        const currentUserId = req.user.id_user;
        const projectId     = req.query.project_id;

        if (!projectId) {
            return res.status(400).json({ error: 'Se requiere project_id como parámetro.' });
        }

        // ── Verificar que el usuario tiene acceso al proyecto ────────────────
        // admin → siempre; pm → si es id_pm del proyecto; viewer → si está en project_member
        const userRole = req.user.role;

        if (userRole !== 'admin') {
            if (userRole === 'pm') {
                const { data: proj, error: projErr } = await supabase
                    .from('project')
                    .select('id_project')
                    .eq('id_project', projectId)
                    .eq('id_pm', currentUserId)
                    .maybeSingle();
                if (projErr) return res.status(500).json({ error: projErr.message });
                if (!proj) return res.status(403).json({ error: 'No tienes acceso a este proyecto.' });
            } else {
                const { data: membership, error: memErr } = await supabase
                    .from('project_member')
                    .select('id_user')
                    .eq('id_project', projectId)
                    .eq('id_user', currentUserId)
                    .maybeSingle();
                if (memErr) return res.status(500).json({ error: memErr.message });
                if (!membership) return res.status(403).json({ error: 'No tienes acceso a este proyecto.' });
            }
        }

        // ── Semana actual (lunes–domingo UTC) ────────────────────────────────
        const now = new Date();
        const dow = now.getUTCDay();
        const monday = new Date(now);
        monday.setUTCDate(now.getUTCDate() - (dow === 0 ? 6 : dow - 1));
        monday.setUTCHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setUTCDate(monday.getUTCDate() + 6);
        sunday.setUTCHours(23, 59, 59, 999);

        const emptyResponse = {
            ranking: [], my_position: null,
            week_start: monday.toISOString().slice(0, 10),
            week_end:   sunday.toISOString().slice(0, 10),
        };

        // ── Miembros del proyecto ────────────────────────────────────────────
        const { data: members, error: allMemErr } = await supabase
            .from('project_member')
            .select('id_user')
            .eq('id_project', projectId);
        if (allMemErr) return res.status(500).json({ error: allMemErr.message });

        const memberIds = (members || []).map(m => m.id_user);
        if (memberIds.length === 0) return res.status(200).json(emptyResponse);

        // ── Filtrar solo los que tienen rol viewer ───────────────────────────
        const { data: viewerRoles, error: roleErr } = await supabase
            .from('role')
            .select('id_user')
            .in('id_user', memberIds)
            .eq('status', 'viewer');
        if (roleErr) return res.status(500).json({ error: roleErr.message });

        const viewerIds = (viewerRoles || []).map(r => r.id_user);
        if (viewerIds.length === 0) return res.status(200).json(emptyResponse);

        // ── Info de usuarios ─────────────────────────────────────────────────
        const { data: users, error: usersErr } = await supabase
            .from('users')
            .select('id_user, username, full_name')
            .in('id_user', viewerIds);
        if (usersErr) return res.status(500).json({ error: usersErr.message });

        // ── Work items cerrados esta semana por los viewers del proyecto ──────
        const { data: doneItems, error: wiErr } = await supabase
            .from('work_item')
            .select('assignee_id, story_points, gamification_weight, end_date, updated_at')
            .eq('status', 'done')
            .in('assignee_id', viewerIds)
            .gte('updated_at', monday.toISOString())
            .lte('updated_at', sunday.toISOString());
        if (wiErr) return res.status(500).json({ error: wiErr.message });

        // ── Calcular puntos por viewer ───────────────────────────────────────
        const statsMap = {};
        for (const uid of viewerIds) {
            statsMap[uid] = { items_closed: 0, base_points: 0, bonus_points: 0, on_time_count: 0 };
        }

        for (const wi of (doneItems || [])) {
            const uid = wi.assignee_id;
            if (!statsMap[uid]) continue;
            const base   = (wi.story_points || 0) * (wi.gamification_weight || 1);
            const onTime = wi.end_date && new Date(wi.updated_at) <= new Date(wi.end_date);
            const bonus  = onTime ? Math.round(base * 0.25) : 0;
            statsMap[uid].items_closed  += 1;
            statsMap[uid].base_points   += base;
            statsMap[uid].bonus_points  += bonus;
            if (onTime) statsMap[uid].on_time_count += 1;
        }

        // ── Armar ranking ordenado ───────────────────────────────────────────
        const userById = Object.fromEntries((users || []).map(u => [u.id_user, u]));
        const ranking = viewerIds
            .map(uid => {
                const s = statsMap[uid];
                const total = s.base_points + s.bonus_points;
                const on_time_rate = s.items_closed > 0
                    ? Math.round((s.on_time_count / s.items_closed) * 100)
                    : 0;
                return {
                    id_user:       uid,
                    username:      userById[uid]?.username  || `User ${uid}`,
                    full_name:     userById[uid]?.full_name || null,
                    weekly_points: total,
                    base_points:   s.base_points,
                    bonus_points:  s.bonus_points,
                    items_closed:  s.items_closed,
                    on_time_rate,
                };
            })
            .sort((a, b) => b.weekly_points - a.weekly_points || a.username.localeCompare(b.username))
            .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

        const my_position = ranking.find(r => r.id_user === currentUserId) || null;

        return res.status(200).json({
            ranking,
            my_position,
            week_start: monday.toISOString().slice(0, 10),
            week_end:   sunday.toISOString().slice(0, 10),
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// ─── GET /dashboard/pm ───────────────────────────────────────────────────────
// Dashboard para PM: igual al admin pero filtrado a sus propios proyectos.
async function getPmDashboard(req, res) {
    try {
        const pmId = req.user.id_user;

        const { data: projects, error: projErr } = await supabase
            .from('project')
            .select('id_project, project_name, client_name, estimated_sp, deadline, start_date')
            .eq('id_pm', pmId);
        if (projErr) return res.status(500).json({ error: projErr.message });

        const empty = {
            projects: [],
            summary: { total_projects: 0, active_sprints: 0, total_work_items: 0, completion_rate: null, pending_costs_count: 0, pending_costs_amount: 0, overdue_items_count: 0, total_riesgos_activos: 0, avance_promedio: null, total_costo_aprobado: 0 },
            charts:  { work_items_by_status: [], work_items_by_type: [], sprints_by_status: [], spends_by_category: [], spends_by_status: [], project_sp_progress: [] },
            lists:   { upcoming_deadlines: [], overdue_items: [] },
        };
        if (!projects || projects.length === 0) return res.status(200).json(empty);

        const projectIds = projects.map(p => p.id_project);

        const [
            { data: sprints  },
            { data: budgets  },
            { data: risks    },
            { data: blockers },
            { data: users    },
        ] = await Promise.all([
            supabase.from('sprint').select('id_sprint, id_project, status, SP_estimated, deadline').in('id_project', projectIds),
            supabase.from('budget').select('id_budget, id_project, total_cost').in('id_project', projectIds),
            supabase.from('risk').select('id_project, level').eq('status', 'active').in('id_project', projectIds),
            supabase.from('blocker_implication').select('id_project, severity, approval_status, created_at').eq('kind', 'blocker').in('approval_status', ['pending', 'approved']).in('id_project', projectIds),
            supabase.from('users').select('id_user, username, full_name'),
        ]);

        const sprintIds      = (sprints  || []).map(s => s.id_sprint);
        const budgetIds      = (budgets  || []).map(b => b.id_budget);
        const sprintToProject = Object.fromEntries((sprints || []).map(s => [s.id_sprint, s.id_project]));
        const budgetToProject = Object.fromEntries((budgets || []).map(b => [b.id_budget, b.id_project]));
        const budgetToTotal   = Object.fromEntries((budgets || []).map(b => [b.id_project, Number(b.total_cost || 0)]));
        const userById        = Object.fromEntries((users  || []).map(u => [u.id_user, u]));

        const [{ data: workItems }, { data: spends }] = await Promise.all([
            sprintIds.length > 0
                ? supabase.from('work_item').select('id_work_item, id_sprint, title, type, status, story_points, assignee_id, end_date, updated_at').in('id_sprint', sprintIds)
                : { data: [] },
            budgetIds.length > 0
                ? supabase.from('spend').select('id_spend, id_budget, spendmoney, type, status').in('id_budget', budgetIds)
                : { data: [] },
        ]);

        const now          = new Date();
        const nowISO       = now.toISOString();
        const sevenDaysAgo = new Date(now - 7 * 86400000);

        const doneSpByProject  = {};
        const totalSpByProject = {};
        const recentSPByProject = {};
        for (const wi of (workItems || [])) {
            const pid = sprintToProject[wi.id_sprint];
            if (pid == null) continue;
            totalSpByProject[pid] = (totalSpByProject[pid] || 0) + (wi.story_points || 0);
            if (wi.status === 'done') {
                doneSpByProject[pid] = (doneSpByProject[pid] || 0) + (wi.story_points || 0);
                if (wi.updated_at && new Date(wi.updated_at) >= sevenDaysAgo)
                    recentSPByProject[pid] = (recentSPByProject[pid] || 0) + (wi.story_points || 0);
            }
        }

        const sprintsByProject  = {};
        const blockersByProject = {};
        const activeRisksByProject = {};
        const riesgosByProject  = {};
        const costoByProject    = {};

        for (const s of (sprints || [])) {
            if (!sprintsByProject[s.id_project]) sprintsByProject[s.id_project] = [];
            sprintsByProject[s.id_project].push(s);
        }
        for (const b of (blockers || [])) {
            if (!blockersByProject[b.id_project]) blockersByProject[b.id_project] = [];
            blockersByProject[b.id_project].push(b);
        }
        for (const r of (risks || [])) {
            riesgosByProject[r.id_project] = (riesgosByProject[r.id_project] || 0) + 1;
            if (!activeRisksByProject[r.id_project]) activeRisksByProject[r.id_project] = [];
            activeRisksByProject[r.id_project].push(r);
        }
        for (const sp of (spends || [])) {
            if (sp.status !== 'approved') continue;
            const pid = budgetToProject[sp.id_budget];
            if (pid == null) continue;
            costoByProject[pid] = (costoByProject[pid] || 0) + Number(sp.spendmoney || 0);
        }

        const projectRows = projects.map(p => {
            const pid         = p.id_project;
            const sp_totales  = p.estimated_sp || totalSpByProject[pid] || 0;
            const sp_done     = doneSpByProject[pid] || 0;
            const avance_real_pct = sp_totales > 0 ? (sp_done / sp_totales) * 100 : 0;
            const avance_real     = sp_totales > 0 ? sp_done / sp_totales : null;
            const pastSprints     = (sprintsByProject[pid] || []).filter(s => s.deadline && s.deadline <= nowISO);
            const sp_esperados    = pastSprints.reduce((a, s) => a + (s.SP_estimated || 0), 0);
            const avance_esperado = sp_totales > 0 ? (sp_esperados / sp_totales) * 100 : 0;
            const desviacion      = avance_real_pct - avance_esperado;
            let expectedWeeklySP  = 0;
            if (p.start_date && p.deadline && sp_totales > 0) {
                const weeks = Math.max(1, (new Date(p.deadline) - new Date(p.start_date)) / (7 * 86400000));
                expectedWeeklySP = sp_totales / weeks;
            }
            const { semaforo } = computeRiskScore({ desviacion, deadline: p.deadline, avance_real: avance_real_pct, costo_aprobado: costoByProject[pid] || 0, presupuesto: budgetToTotal[pid] || 0, blockers: blockersByProject[pid] || [], activeRisks: activeRisksByProject[pid] || [], recentSP: recentSPByProject[pid] || 0, expectedWeeklySP });
            return { id_project: pid, project_name: p.project_name, client_name: p.client_name, avance_real, costo_aprobado: costoByProject[pid] || 0, riesgos_activos: riesgosByProject[pid] || 0, desviacion, semaforo };
        });

        const project_sp_progress = projects.map(p => ({ id_project: p.id_project, project_name: p.project_name, done_sp: doneSpByProject[p.id_project] || 0, total_sp: totalSpByProject[p.id_project] || 0, estimated_sp: p.estimated_sp || 0 }));

        const wiStatusMap    = {};
        const wiTypeMap      = {};
        const sprintStatusMap = {};
        const spendCatMap    = {};
        const spendStatusMap = {};

        for (const wi of (workItems || [])) {
            wiStatusMap[wi.status] = (wiStatusMap[wi.status] || 0) + 1;
            wiTypeMap[wi.type]     = (wiTypeMap[wi.type]   || 0) + 1;
        }
        for (const s of (sprints || [])) {
            sprintStatusMap[s.status] = (sprintStatusMap[s.status] || 0) + 1;
        }
        for (const sp of (spends || [])) {
            const amount = Number(sp.spendmoney || 0);
            if (sp.status === 'approved') spendCatMap[sp.type] = (spendCatMap[sp.type] || 0) + amount;
            if (!spendStatusMap[sp.status]) spendStatusMap[sp.status] = { n: 0, total: 0 };
            spendStatusMap[sp.status].n     += 1;
            spendStatusMap[sp.status].total += amount;
        }

        const upcoming_deadlines = projects.filter(p => p.deadline).map(p => {
            const daysLeft = Math.ceil((new Date(p.deadline) - now) / (1000 * 60 * 60 * 24));
            return { id_project: p.id_project, project_name: p.project_name, deadline: p.deadline, days_left: daysLeft };
        }).filter(x => x.days_left >= 0 && x.days_left <= 30).sort((a, b) => a.days_left - b.days_left);

        const overdue_items = (workItems || []).filter(wi => wi.end_date && wi.status !== 'done').map(wi => {
            const daysOverdue = Math.floor((now - new Date(wi.end_date)) / (1000 * 60 * 60 * 24));
            const pid = sprintToProject[wi.id_sprint];
            const project = projects.find(p => p.id_project === pid);
            return { id_work_item: wi.id_work_item, title: wi.title, end_date: wi.end_date, days_overdue: daysOverdue, project_name: project?.project_name || null, assignee_username: wi.assignee_id ? (userById[wi.assignee_id]?.username || null) : null };
        }).filter(x => x.days_overdue > 0).sort((a, b) => b.days_overdue - a.days_overdue).slice(0, 15);

        const total_work_items  = (workItems || []).length;
        const done_count        = (workItems || []).filter(wi => wi.status === 'done').length;
        const completion_rate   = total_work_items > 0 ? done_count / total_work_items : null;
        const active_sprints    = (sprints || []).filter(s => s.status === 'active').length;
        const total_costo_aprobado = projectRows.reduce((a, r) => a + r.costo_aprobado, 0);
        const total_riesgos_activos = projectRows.reduce((a, r) => a + r.riesgos_activos, 0);
        const avancesValidos    = projectRows.map(r => r.avance_real).filter(v => v != null);
        const avance_promedio   = avancesValidos.length > 0 ? avancesValidos.reduce((a, v) => a + v, 0) / avancesValidos.length : null;
        const pending_costs     = (spends || []).filter(sp => sp.status === 'pending');

        return res.status(200).json({
            projects: projectRows,
            summary: { total_projects: projectRows.length, total_costo_aprobado, total_riesgos_activos, avance_promedio, active_sprints, total_work_items, completion_rate, pending_costs_count: pending_costs.length, pending_costs_amount: pending_costs.reduce((a, sp) => a + Number(sp.spendmoney || 0), 0), overdue_items_count: overdue_items.length },
            charts:  { work_items_by_status: Object.entries(wiStatusMap).map(([status, n]) => ({ status, n })), work_items_by_type: Object.entries(wiTypeMap).map(([type, n]) => ({ type, n })), sprints_by_status: Object.entries(sprintStatusMap).map(([status, n]) => ({ status, n })), spends_by_category: Object.entries(spendCatMap).map(([category, approved_total]) => ({ category, approved_total })), spends_by_status: ['pending', 'approved', 'rejected'].map(status => ({ status, n: spendStatusMap[status]?.n || 0, total: spendStatusMap[status]?.total || 0 })), project_sp_progress },
            lists:   { upcoming_deadlines, overdue_items },
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

// ─── GET /dashboard/viewer ───────────────────────────────────────────────────
// Dashboard personal del viewer: mis items, mis proyectos, mi ranking semanal.
async function getViewerDashboard(req, res) {
    try {
        const viewerId = req.user.id_user;

        const { data: memberships, error: memErr } = await supabase
            .from('project_member')
            .select('id_project')
            .eq('id_user', viewerId);
        if (memErr) return res.status(500).json({ error: memErr.message });

        const projectIds = (memberships || []).map(m => m.id_project);

        const empty = {
            summary: { my_projects_count: 0, my_items_total: 0, my_items_done: 0, my_items_in_progress: 0, my_weekly_points: 0, my_overdue_count: 0 },
            charts:  { my_items_by_status: [], my_items_by_type: [], sprint_progress: [] },
            lists:   { my_overdue_items: [], upcoming_deadlines: [] },
        };
        if (projectIds.length === 0) return res.status(200).json(empty);

        const [{ data: projects }, { data: sprints }] = await Promise.all([
            supabase.from('project').select('id_project, project_name, deadline').in('id_project', projectIds),
            supabase.from('sprint').select('id_sprint, id_project, name, status, SP_estimated').in('id_project', projectIds),
        ]);

        const sprintIds       = (sprints || []).map(s => s.id_sprint);
        const sprintToProject = Object.fromEntries((sprints || []).map(s => [s.id_sprint, s.id_project]));
        const projectById     = Object.fromEntries((projects || []).map(p => [p.id_project, p]));

        const [{ data: allItems }, { data: myItems }] = sprintIds.length > 0
            ? await Promise.all([
                supabase.from('work_item').select('id_work_item, id_sprint, status, story_points').in('id_sprint', sprintIds),
                supabase.from('work_item').select('id_work_item, id_sprint, title, type, status, story_points, end_date, updated_at, gamification_weight').in('id_sprint', sprintIds).eq('assignee_id', viewerId),
            ])
            : [{ data: [] }, { data: [] }];

        // ── Puntos de la semana actual ───────────────────────────────────────
        const now = new Date();
        const dow = now.getUTCDay();
        const monday = new Date(now);
        monday.setUTCDate(now.getUTCDate() - (dow === 0 ? 6 : dow - 1));
        monday.setUTCHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setUTCDate(monday.getUTCDate() + 6);
        sunday.setUTCHours(23, 59, 59, 999);

        let my_weekly_points = 0;
        for (const wi of myItems) {
            if (wi.status !== 'done') continue;
            const updatedAt = new Date(wi.updated_at);
            if (updatedAt < monday || updatedAt > sunday) continue;
            const base   = (wi.story_points || 0) * (wi.gamification_weight || 1);
            const onTime = wi.end_date && updatedAt <= new Date(wi.end_date);
            my_weekly_points += base + (onTime ? Math.round(base * 0.25) : 0);
        }

        // ── Distribuciones de mis items ──────────────────────────────────────
        const wiStatusMap = {};
        const wiTypeMap   = {};
        for (const wi of myItems) {
            wiStatusMap[wi.status] = (wiStatusMap[wi.status] || 0) + 1;
            wiTypeMap[wi.type]     = (wiTypeMap[wi.type]   || 0) + 1;
        }

        // ── Progreso por sprint (activos + planeados) ────────────────────────
        const sprintDoneMap  = {};
        const sprintTotalMap = {};
        for (const wi of (allItems || [])) {
            const sid = wi.id_sprint;
            sprintTotalMap[sid] = (sprintTotalMap[sid] || 0) + (wi.story_points || 0);
            if (wi.status === 'done') sprintDoneMap[sid] = (sprintDoneMap[sid] || 0) + (wi.story_points || 0);
        }
        const STATUS_ORDER = { active: 0, planned: 1, done: 2, cancelled: 3 };
        const sprint_progress = (sprints || [])
            .map(s => ({
                id_sprint:    s.id_sprint,
                sprint_name:  s.name,
                project_name: projectById[s.id_project]?.project_name || `Proyecto ${s.id_project}`,
                done_sp:      sprintDoneMap[s.id_sprint]  || 0,
                total_sp:     sprintTotalMap[s.id_sprint] || 0,
                status:       s.status,
            }))
            .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))
            .slice(0, 8);

        // ── Mis items vencidos ───────────────────────────────────────────────
        const my_overdue_items = myItems
            .filter(wi => wi.end_date && wi.status !== 'done')
            .map(wi => {
                const daysOverdue = Math.floor((now - new Date(wi.end_date)) / (1000 * 60 * 60 * 24));
                const pid = sprintToProject[wi.id_sprint];
                return { id_work_item: wi.id_work_item, title: wi.title, end_date: wi.end_date, days_overdue: daysOverdue, project_name: projectById[pid]?.project_name || null };
            })
            .filter(x => x.days_overdue > 0)
            .sort((a, b) => b.days_overdue - a.days_overdue);

        // ── Deadlines próximos de mis proyectos ──────────────────────────────
        const upcoming_deadlines = (projects || [])
            .filter(p => p.deadline)
            .map(p => {
                const daysLeft = Math.ceil((new Date(p.deadline) - now) / (1000 * 60 * 60 * 24));
                return { id_project: p.id_project, project_name: p.project_name, deadline: p.deadline, days_left: daysLeft };
            })
            .filter(x => x.days_left >= 0 && x.days_left <= 30)
            .sort((a, b) => a.days_left - b.days_left);

        return res.status(200).json({
            summary: {
                my_projects_count:  projectIds.length,
                my_items_total:     myItems.length,
                my_items_done:      myItems.filter(wi => wi.status === 'done').length,
                my_items_in_progress: myItems.filter(wi => wi.status === 'in_progress').length,
                my_weekly_points,
                my_overdue_count:   my_overdue_items.length,
            },
            charts: {
                my_items_by_status: Object.entries(wiStatusMap).map(([status, n]) => ({ status, n })),
                my_items_by_type:   Object.entries(wiTypeMap).map(([type, n]) => ({ type, n })),
                sprint_progress,
            },
            lists: { my_overdue_items, upcoming_deadlines },
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

module.exports = { getAdminDashboard, getLeaderboard, getPmDashboard, getViewerDashboard };
