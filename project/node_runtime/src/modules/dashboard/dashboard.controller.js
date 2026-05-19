const supabase = require('../../config/supabase');

// ─── GET /dashboard/admin ────────────────────────────────────────────────────
// Dashboard consolidado para el rol admin. Calcula avance real, costo aprobado
// y riesgos activos por proyecto con queries en lote (CA-03). Desviacion y
// semaforo se entregan como null (pendientes de Sprint 3).
// `avance_real` y `avance_promedio` son ratios 0-1 (el frontend los formatea como %).
async function getAdminDashboard(req, res) {
    try {
        // 1. Todos los proyectos
        const { data: projects, error: projErr } = await supabase
            .from('project')
            .select('id_project, project_name, client_name, estimated_sp');
        if (projErr) return res.status(500).json({ error: projErr.message });

        if (!projects || projects.length === 0) {
            return res.status(200).json({
                projects: [],
                summary: {
                    total_projects: 0,
                    total_costo_aprobado: 0,
                    total_riesgos_activos: 0,
                    avance_promedio: null,
                },
            });
        }

        const projectIds = projects.map(p => p.id_project);

        // 2. Sprints de esos proyectos
        const { data: sprints, error: sprintErr } = await supabase
            .from('sprint')
            .select('id_sprint, id_project')
            .in('id_project', projectIds);
        if (sprintErr) return res.status(500).json({ error: sprintErr.message });

        // Cada sprint pertenece a exactamente un proyecto: el mapa es 1-a-1.
        const sprintToProject = Object.fromEntries(
            (sprints || []).map(s => [s.id_sprint, s.id_project])
        );
        const sprintIds = (sprints || []).map(s => s.id_sprint);

        // 3. Work items de esos sprints
        let workItems = [];
        if (sprintIds.length > 0) {
            const { data, error: wiErr } = await supabase
                .from('work_item')
                .select('id_sprint, story_points, status')
                .in('id_sprint', sprintIds);
            if (wiErr) return res.status(500).json({ error: wiErr.message });
            workItems = data || [];
        }

        // 4. Budgets de esos proyectos
        const { data: budgets, error: budgetErr } = await supabase
            .from('budget')
            .select('id_budget, id_project')
            .in('id_project', projectIds);
        if (budgetErr) return res.status(500).json({ error: budgetErr.message });

        const budgetToProject = Object.fromEntries(
            (budgets || []).map(b => [b.id_budget, b.id_project])
        );
        const budgetIds = (budgets || []).map(b => b.id_budget);

        // 5. Spends aprobados de esos budgets
        let spends = [];
        if (budgetIds.length > 0) {
            const { data, error: spendErr } = await supabase
                .from('spend')
                .select('id_budget, spendmoney')
                .in('id_budget', budgetIds)
                .eq('status', 'approved');
            if (spendErr) return res.status(500).json({ error: spendErr.message });
            spends = data || [];
        }

        // 6. Riesgos activos de esos proyectos
        const { data: risks, error: riskErr } = await supabase
            .from('risk')
            .select('id_project')
            .in('id_project', projectIds)
            .eq('status', 'active');
        if (riskErr) return res.status(500).json({ error: riskErr.message });

        // ── Agregacion en memoria ────────────────────────────────────────────
        // SP completados (work items en 'done') por proyecto
        const doneSpByProject = {};
        for (const wi of workItems) {
            if (wi.status !== 'done') continue;
            const pid = sprintToProject[wi.id_sprint];
            if (pid == null) continue;
            doneSpByProject[pid] = (doneSpByProject[pid] || 0) + (wi.story_points || 0);
        }

        // Costo aprobado por proyecto
        const costoByProject = {};
        for (const sp of spends) {
            const pid = budgetToProject[sp.id_budget];
            if (pid == null) continue;
            costoByProject[pid] = (costoByProject[pid] || 0) + Number(sp.spendmoney || 0);
        }

        // Riesgos activos por proyecto
        const riesgosByProject = {};
        for (const r of (risks || [])) {
            riesgosByProject[r.id_project] = (riesgosByProject[r.id_project] || 0) + 1;
        }

        // Construir filas
        const rows = projects.map(p => {
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

        // KPIs agregados (summary)
        const total_costo_aprobado = rows.reduce((a, r) => a + r.costo_aprobado, 0);
        const total_riesgos_activos = rows.reduce((a, r) => a + r.riesgos_activos, 0);
        const avancesValidos = rows.map(r => r.avance_real).filter(v => v != null);
        const avance_promedio = avancesValidos.length > 0
            ? avancesValidos.reduce((a, v) => a + v, 0) / avancesValidos.length
            : null;

        return res.status(200).json({
            projects: rows,
            summary: {
                total_projects: rows.length,
                total_costo_aprobado,
                total_riesgos_activos,
                avance_promedio,
            },
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

module.exports = { getAdminDashboard };
