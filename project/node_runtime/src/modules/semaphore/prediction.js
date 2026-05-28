// project/node_runtime/src/modules/semaphore/prediction.js
// HU-24 v3 — Predicción temporal integrada al Risk Score.
// Funciones puras (sin acceso a BD). El controller alimenta los inputs.

const MS_PER_DAY = 86_400_000;
const TOLERANCE_DAYS = 14;
const DEFAULT_SPRINT_DAYS = 14;

// ─── computeVelocity ─────────────────────────────────────────────────────────
// Promedio de SP completados en sprints CLEAN.
// pastSprints: array de { id_sprint, doneSp }
// Devuelve null si el array está vacío.
function computeVelocity(pastSprints) {
    if (!Array.isArray(pastSprints) || pastSprints.length === 0) return null;
    const total = pastSprints.reduce((acc, s) => acc + (s.doneSp || 0), 0);
    return total / pastSprints.length;
}

// ─── computeSprintDuration ───────────────────────────────────────────────────
// Promedio de duración (días) de sprints pasados. Fallback 14 días.
function computeSprintDuration(pastSprints) {
    if (!Array.isArray(pastSprints) || pastSprints.length === 0) return DEFAULT_SPRINT_DAYS;
    const durations = [];
    for (const s of pastSprints) {
        if (!s.begin_at || !s.deadline) continue;
        const start = new Date(s.begin_at).getTime();
        const end   = new Date(s.deadline).getTime();
        if (Number.isNaN(start) || Number.isNaN(end) || end <= start) continue;
        durations.push((end - start) / MS_PER_DAY);
    }
    if (durations.length === 0) return DEFAULT_SPRINT_DAYS;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
}

// ─── filterCleanSprints ──────────────────────────────────────────────────────
// Separa sprints CLEAN (doneSp > 0 || assignedSp === 0) de STUCK (doneSp === 0 && assignedSp > 0).
// allPastSprints: array de { id_sprint, begin_at, deadline, doneSp, assignedSp }
// Devuelve { clean: [...], stuck: [...] }
function filterCleanSprints(allPastSprints) {
    const clean = [];
    const stuck = [];
    for (const s of (allPastSprints || [])) {
        if (s.doneSp === 0 && (s.assignedSp || 0) > 0) {
            stuck.push(s);
        } else {
            clean.push(s);
        }
    }
    return { clean, stuck };
}

// ─── computeBlockerPenalty ───────────────────────────────────────────────────
// Multiplicador acumulativo sobre velocity por bloqueadores activos.
// blockers: array de { severity, approval_status }
// Devuelve número en [0.30, 1.00].
function computeBlockerPenalty(blockers) {
    let penalty = 1.0;
    for (const b of (blockers || [])) {
        if (b.severity === 'critical' && ['pending', 'approved'].includes(b.approval_status)) {
            penalty *= 0.85; // -15% por crítico
        } else if (b.severity === 'medium' && b.approval_status === 'pending') {
            penalty *= 0.92; // -8% por medio pendiente
        }
    }
    return Math.max(penalty, 0.30); // floor: nunca menos del 30%
}

// ─── computeConfidence ───────────────────────────────────────────────────────
// Etiqueta cualitativa de calidad del modelo, en orden de prioridad.
// inputs: { cleanCount, stuckCount, blockerPenalty, hasHighRisk }
// Devuelve 'SIN_DATOS' | 'BAJA' | 'MEDIA' | 'ALTA'.
function computeConfidence({ cleanCount, stuckCount, blockerPenalty, hasHighRisk }) {
    if (cleanCount === 0) return 'SIN_DATOS';
    if (cleanCount < 2)    return 'BAJA';
    if (stuckCount >= 2)   return 'BAJA';
    if (hasHighRisk)       return 'BAJA';
    if (blockerPenalty < 0.80) return 'MEDIA';
    if (stuckCount === 1)      return 'MEDIA';
    if (cleanCount >= 4)       return 'ALTA';
    return 'MEDIA';
}

// ─── buildPrediction ─────────────────────────────────────────────────────────
// Orquesta el cálculo completo y devuelve el bloque `prediction` del endpoint.
function buildPrediction({ project, allPastSprints, doneSpTotal, totalSp, blockers, activeRisks, now = new Date() }) {
    const { clean: cleanPastSprints, stuck: stuckSprints } = filterCleanSprints(allPastSprints);
    const stuckCount = stuckSprints.length;

    const velocityBase = computeVelocity(cleanPastSprints);
    const sprintDurationDays = computeSprintDuration(cleanPastSprints);
    const blockerPenalty = computeBlockerPenalty(blockers);

    const hasHighRisk = (activeRisks || []).some(r => r.level === 'high');
    const confidence = computeConfidence({
        cleanCount: cleanPastSprints.length,
        stuckCount,
        blockerPenalty,
        hasHighRisk,
    });

    const remainingSp = Math.max(0, (totalSp || 0) - (doneSpTotal || 0));
    const deadline = project && project.deadline ? new Date(project.deadline) : null;

    const base = {
        velocity_base:        velocityBase != null ? Math.round(velocityBase * 100) / 100 : null,
        velocity_effective:   null,
        blocker_penalty:      Math.round(blockerPenalty * 100) / 100,
        sprint_duration_days: Math.round(sprintDurationDays * 10) / 10,
        completed_sprints_clean: cleanPastSprints.length,
        stuck_sprints_excluded:  stuckCount,
        remaining_sp:         remainingSp,
        total_sp:             totalSp || 0,
        done_sp:              doneSpTotal || 0,
        estimated_finish:     null,
        days_diff:            null,
        confidence,
    };

    if (confidence === 'SIN_DATOS' || cleanPastSprints.length === 0) {
        return base;
    }

    if (remainingSp === 0) {
        return {
            ...base,
            velocity_effective: velocityBase != null ? Math.round(velocityBase * blockerPenalty * 100) / 100 : null,
            estimated_finish:   now.toISOString().slice(0, 10),
            days_diff:          deadline ? Math.round((now - deadline) / MS_PER_DAY) : null,
        };
    }

    const velocityEffective = (velocityBase || 0) * blockerPenalty;

    if (velocityEffective <= 0) {
        return { ...base, velocity_effective: 0 };
    }

    const sprintsNeeded = Math.ceil(remainingSp / velocityEffective);
    const estimatedFinishMs = now.getTime() + sprintsNeeded * sprintDurationDays * MS_PER_DAY;
    const estimatedFinish = new Date(estimatedFinishMs);
    const daysDiff = deadline ? Math.round((estimatedFinishMs - deadline.getTime()) / MS_PER_DAY) : null;

    return {
        ...base,
        velocity_effective: Math.round(velocityEffective * 100) / 100,
        estimated_finish:   estimatedFinish.toISOString().slice(0, 10),
        days_diff:          daysDiff,
    };
}

module.exports = {
    MS_PER_DAY,
    TOLERANCE_DAYS,
    DEFAULT_SPRINT_DAYS,
    computeVelocity,
    computeSprintDuration,
    filterCleanSprints,
    computeBlockerPenalty,
    computeConfidence,
    buildPrediction,
};
