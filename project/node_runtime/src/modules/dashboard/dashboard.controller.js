const supabase = require('../../config/supabase');

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
            .select('id_project, project_name, client_name, estimated_sp, deadline');
        if (projErr) return res.status(500).json({ error: projErr.message });

        // 2. Sprints
        const { data: sprints, error: sprintErr } = await supabase
            .from('sprint')
            .select('id_sprint, id_project, status');
        if (sprintErr) return res.status(500).json({ error: sprintErr.message });

        const sprintToProject = Object.fromEntries(
            (sprints || []).map(s => [s.id_sprint, s.id_project])
        );

        // 3. Work items
        const { data: workItems, error: wiErr } = await supabase
            .from('work_item')
            .select('id_work_item, id_sprint, title, type, status, story_points, assignee_id, end_date');
        if (wiErr) return res.status(500).json({ error: wiErr.message });

        // 4. Budgets
        const { data: budgets, error: budgetErr } = await supabase
            .from('budget')
            .select('id_budget, id_project');
        if (budgetErr) return res.status(500).json({ error: budgetErr.message });

        const budgetToProject = Object.fromEntries(
            (budgets || []).map(b => [b.id_budget, b.id_project])
        );

        // 5. Spends (todos: para distribucion por status/categoria)
        const { data: spends, error: spendErr } = await supabase
            .from('spend')
            .select('id_spend, id_budget, spendmoney, type, status');
        if (spendErr) return res.status(500).json({ error: spendErr.message });

        // 6. Risks activos
        const { data: risks, error: riskErr } = await supabase
            .from('risk')
            .select('id_project')
            .eq('status', 'active');
        if (riskErr) return res.status(500).json({ error: riskErr.message });

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
        const doneSpByProject = {};
        const totalSpByProject = {};
        for (const wi of (workItems || [])) {
            const pid = sprintToProject[wi.id_sprint];
            if (pid == null) continue;
            totalSpByProject[pid] = (totalSpByProject[pid] || 0) + (wi.story_points || 0);
            if (wi.status === 'done') {
                doneSpByProject[pid] = (doneSpByProject[pid] || 0) + (wi.story_points || 0);
            }
        }

        const costoByProject = {};
        for (const sp of (spends || [])) {
            if (sp.status !== 'approved') continue;
            const pid = budgetToProject[sp.id_budget];
            if (pid == null) continue;
            costoByProject[pid] = (costoByProject[pid] || 0) + Number(sp.spendmoney || 0);
        }

        const riesgosByProject = {};
        for (const r of (risks || [])) {
            riesgosByProject[r.id_project] = (riesgosByProject[r.id_project] || 0) + 1;
        }

        const projectRows = (projects || []).map(p => {
            const doneSp = doneSpByProject[p.id_project] || 0;
            const estimated = p.estimated_sp;
            const avance_real = (estimated && estimated > 0) ? doneSp / estimated : null;
            return {
                id_project: p.id_project,
                project_name: p.project_name,
                client_name: p.client_name,
                avance_real,
                costo_aprobado: costoByProject[p.id_project] || 0,
                riesgos_activos: riesgosByProject[p.id_project] || 0,
                desviacion: null,
                semaforo: null,
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
        const now = new Date();
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

// ─── GET /dashboard/leaderboard ──────────────────────────────────────────────
// Ranking semanal del equipo del usuario autenticado.
// "Equipo" = todos los usuarios que comparten al menos un proyecto con el caller.
// Puntos = story_points × gamification_weight  (+25 % si cerrado a tiempo).
// Semana = lunes 00:00 → domingo 23:59 UTC del momento de la petición.
async function getLeaderboard(req, res) {
    try {
        const currentUserId = req.user.id_user;

        // ── Semana actual (lunes–domingo UTC) ────────────────────────────────
        const now = new Date();
        const dow = now.getUTCDay(); // 0=dom … 6=sáb
        const monday = new Date(now);
        monday.setUTCDate(now.getUTCDate() - (dow === 0 ? 6 : dow - 1));
        monday.setUTCHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setUTCDate(monday.getUTCDate() + 6);
        sunday.setUTCHours(23, 59, 59, 999);

        // ── Proyectos del usuario ────────────────────────────────────────────
        const { data: myMemberships, error: memErr } = await supabase
            .from('project_member')
            .select('id_project')
            .eq('id_user', currentUserId);
        if (memErr) return res.status(500).json({ error: memErr.message });

        const myProjectIds = (myMemberships || []).map(m => m.id_project);
        if (myProjectIds.length === 0) {
            return res.status(200).json({ ranking: [], my_position: null,
                week_start: monday.toISOString().slice(0, 10),
                week_end:   sunday.toISOString().slice(0, 10) });
        }

        // ── Todos los miembros del equipo ────────────────────────────────────
        const { data: allMembers, error: allMemErr } = await supabase
            .from('project_member')
            .select('id_user')
            .in('id_project', myProjectIds);
        if (allMemErr) return res.status(500).json({ error: allMemErr.message });

        const teamUserIds = [...new Set((allMembers || []).map(m => m.id_user))];

        // ── Info de usuarios ─────────────────────────────────────────────────
        const { data: users, error: usersErr } = await supabase
            .from('users')
            .select('id_user, username, full_name')
            .in('id_user', teamUserIds);
        if (usersErr) return res.status(500).json({ error: usersErr.message });

        // ── Work items cerrados esta semana por miembros del equipo ──────────
        const { data: doneItems, error: wiErr } = await supabase
            .from('work_item')
            .select('assignee_id, story_points, gamification_weight, end_date, updated_at')
            .eq('status', 'done')
            .in('assignee_id', teamUserIds)
            .gte('updated_at', monday.toISOString())
            .lte('updated_at', sunday.toISOString());
        if (wiErr) return res.status(500).json({ error: wiErr.message });

        // ── Calcular puntos por usuario ──────────────────────────────────────
        const statsMap = {};
        for (const uid of teamUserIds) {
            statsMap[uid] = { items_closed: 0, base_points: 0, bonus_points: 0, on_time_count: 0 };
        }

        for (const wi of (doneItems || [])) {
            const uid = wi.assignee_id;
            if (!statsMap[uid]) continue;
            const base  = (wi.story_points || 0) * (wi.gamification_weight || 1);
            const onTime = wi.end_date && new Date(wi.updated_at) <= new Date(wi.end_date);
            const bonus  = onTime ? Math.round(base * 0.25) : 0;
            statsMap[uid].items_closed  += 1;
            statsMap[uid].base_points   += base;
            statsMap[uid].bonus_points  += bonus;
            if (onTime) statsMap[uid].on_time_count += 1;
        }

        // ── Armar ranking ordenado ───────────────────────────────────────────
        const userById = Object.fromEntries((users || []).map(u => [u.id_user, u]));
        const ranking = teamUserIds
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

module.exports = { getAdminDashboard, getLeaderboard };
