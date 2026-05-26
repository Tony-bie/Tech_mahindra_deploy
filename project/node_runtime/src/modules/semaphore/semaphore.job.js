// RF-21: calcula el Risk Score una vez al día para todos los proyectos
// y persiste en la tabla semaphore (upsert por id_project).
const supabase          = require('../../config/supabase');
const { computeRiskScore } = require('./riskScore');

async function runSemaphoreUpdate() {
    console.log('[semaphore.job] Iniciando actualización de Risk Score...');
    try {
        const now          = new Date();
        const sevenDaysAgo = new Date(now - 7 * 86400000);
        const nowISO       = now.toISOString();

        // ── Fetch en lote ────────────────────────────────────────────────────
        const [
            { data: projects },
            { data: sprints  },
            { data: workItems},
            { data: budgets  },
            { data: spends   },
            { data: blockers },
            { data: risks    },
        ] = await Promise.all([
            supabase.from('project').select('id_project, estimated_sp, deadline, start_date'),
            supabase.from('sprint').select('id_sprint, id_project, SP_estimated, deadline'),
            supabase.from('work_item').select('id_sprint, story_points, status, updated_at'),
            supabase.from('budget').select('id_budget, id_project, total_cost'),
            supabase.from('spend').select('id_budget, spendmoney, status'),
            supabase.from('blocker_implication')
                .select('id_project, severity, approval_status, created_at')
                .eq('kind', 'blocker')
                .in('approval_status', ['pending', 'approved']),
            supabase.from('risk').select('id_project, level').eq('status', 'active'),
        ]);

        // ── Mapas de lookup ──────────────────────────────────────────────────
        const sprintToProject = Object.fromEntries((sprints  || []).map(s => [s.id_sprint,  s.id_project]));
        const budgetToProject = Object.fromEntries((budgets  || []).map(b => [b.id_budget,  b.id_project]));
        const budgetToTotal   = Object.fromEntries((budgets  || []).map(b => [b.id_project, Number(b.total_cost || 0)]));

        // ── Agregaciones de work items ───────────────────────────────────────
        const doneSPByProject   = {};
        const recentSPByProject = {};

        for (const wi of (workItems || [])) {
            const pid = sprintToProject[wi.id_sprint];
            if (pid == null) continue;
            if (wi.status === 'done') {
                doneSPByProject[pid] = (doneSPByProject[pid] || 0) + (wi.story_points || 0);
                if (wi.updated_at && new Date(wi.updated_at) >= sevenDaysAgo) {
                    recentSPByProject[pid] = (recentSPByProject[pid] || 0) + (wi.story_points || 0);
                }
            }
        }

        // ── Costo aprobado por proyecto ──────────────────────────────────────
        const costoByProject = {};
        for (const sp of (spends || [])) {
            if (sp.status !== 'approved') continue;
            const pid = budgetToProject[sp.id_budget];
            if (pid == null) continue;
            costoByProject[pid] = (costoByProject[pid] || 0) + Number(sp.spendmoney || 0);
        }

        // ── Sprints por proyecto ─────────────────────────────────────────────
        const sprintsByProject = {};
        for (const s of (sprints || [])) {
            if (!sprintsByProject[s.id_project]) sprintsByProject[s.id_project] = [];
            sprintsByProject[s.id_project].push(s);
        }

        // ── Bloqueadores por proyecto ────────────────────────────────────────
        const blockersByProject = {};
        for (const b of (blockers || [])) {
            if (!blockersByProject[b.id_project]) blockersByProject[b.id_project] = [];
            blockersByProject[b.id_project].push(b);
        }

        // ── Riesgos activos por proyecto ─────────────────────────────────────
        const risksByProject = {};
        for (const r of (risks || [])) {
            if (!risksByProject[r.id_project]) risksByProject[r.id_project] = [];
            risksByProject[r.id_project].push(r);
        }

        // ── Calcular score + upsert ──────────────────────────────────────────
        const upserts = [];

        for (const p of (projects || [])) {
            const pid       = p.id_project;
            const sp_totales = p.estimated_sp || 0;
            const sp_done    = doneSPByProject[pid] || 0;
            const avance_real = sp_totales > 0 ? (sp_done / sp_totales) * 100 : 0;

            // Avance esperado = SP de sprints ya vencidos / sp_totales
            const pastSprints    = (sprintsByProject[pid] || []).filter(s => s.deadline && s.deadline <= nowISO);
            const sp_esperados   = pastSprints.reduce((a, s) => a + (s.SP_estimated || 0), 0);
            const avance_esperado = sp_totales > 0 ? (sp_esperados / sp_totales) * 100 : 0;
            const desviacion      = avance_real - avance_esperado;

            // Velocidad semanal esperada
            let expectedWeeklySP = 0;
            if (p.start_date && p.deadline && sp_totales > 0) {
                const weeks = Math.max(1, (new Date(p.deadline) - new Date(p.start_date)) / (7 * 86400000));
                expectedWeeklySP = sp_totales / weeks;
            }

            const { score, semaforo_en } = computeRiskScore({
                desviacion,
                deadline:        p.deadline,
                avance_real,
                costo_aprobado:  costoByProject[pid]  || 0,
                presupuesto:     budgetToTotal[pid]   || 0,
                blockers:        blockersByProject[pid] || [],
                activeRisks:     risksByProject[pid]   || [],
                recentSP:        recentSPByProject[pid] || 0,
                expectedWeeklySP,
            });

            upserts.push({
                id_project:          pid,
                status:              semaforo_en,
                risk_score:          score,
                semaphore_update_at: nowISO,
            });
        }

        if (upserts.length > 0) {
            const { error } = await supabase
                .from('semaphore')
                .upsert(upserts, { onConflict: 'id_project' });

            if (error) {
                console.error('[semaphore.job] Error en upsert:', error.message);
            } else {
                console.log(`[semaphore.job] ${upserts.length} proyectos actualizados.`);
            }
        }
    } catch (err) {
        console.error('[semaphore.job] Error inesperado:', err.message);
    }
}

// Ejecutar al arrancar y cada 24 horas (RF-21)
runSemaphoreUpdate();
setInterval(runSemaphoreUpdate, 24 * 60 * 60 * 1000);

module.exports = { runSemaphoreUpdate };
