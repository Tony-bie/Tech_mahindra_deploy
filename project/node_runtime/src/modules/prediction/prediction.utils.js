// project/node_runtime/src/modules/prediction/prediction.utils.js

const MS_PER_DAY = 86_400_000;
const TOLERANCE_DAYS = 14;
const DEFAULT_SPRINT_DAYS = 14;

// Promedio de SP completados en sprints pasados.
// pastSprints: array de { id_sprint, doneSp }
// Devuelve null si no hay sprints pasados.
function computeVelocity(pastSprints) {
    if (!Array.isArray(pastSprints) || pastSprints.length === 0) return null;
    const total = pastSprints.reduce((acc, s) => acc + (s.doneSp || 0), 0);
    return total / pastSprints.length;
}

// Promedio de duración (en días) de sprints pasados.
// pastSprints: array de { begin_at, deadline } (strings ISO)
// Devuelve DEFAULT_SPRINT_DAYS (14) si no hay sprints válidos.
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

// Clasifica la predicción.
// Devuelve { classification, message, estimated_finish, days_diff, velocity,
//            sprint_duration_days, completed_sprints, remaining_sp, total_sp, done_sp }
function buildPrediction({ project, pastSprints, doneSpTotal, totalSp, now = new Date() }) {
    const velocity = computeVelocity(pastSprints);
    const sprintDurationDays = computeSprintDuration(pastSprints);
    const remainingSp = Math.max(0, (totalSp || 0) - (doneSpTotal || 0));
    const deadline = project.deadline ? new Date(project.deadline) : null;
    const base = {
        velocity,
        sprint_duration_days: Math.round(sprintDurationDays * 10) / 10,
        completed_sprints: pastSprints.length,
        remaining_sp: remainingSp,
        total_sp: totalSp || 0,
        done_sp: doneSpTotal || 0,
        estimated_finish: null,
        days_diff: null,
    };

    // Caso 1: sin datos suficientes
    if ((totalSp || 0) === 0 || pastSprints.length === 0) {
        return {
            ...base,
            classification: 'SIN_DATOS',
            message: 'Necesitamos al menos un sprint pasado con story points para predecir.',
        };
    }

    // Caso 2: proyecto ya completado
    if (remainingSp === 0) {
        return {
            ...base,
            classification: 'VERDE',
            message: 'Proyecto completado.',
            estimated_finish: now.toISOString().slice(0, 10),
            days_diff: deadline ? Math.round((now - deadline) / MS_PER_DAY) : null,
        };
    }

    // Caso 3: velocity = 0 con SP pendientes
    if (velocity === 0) {
        return {
            ...base,
            classification: 'ROJO',
            message: `Sin progreso reciente: 0 SP completados en ${pastSprints.length} sprint(s) pasado(s).`,
        };
    }

    const sprintsNeeded = Math.ceil(remainingSp / velocity);
    const estimatedFinishMs = now.getTime() + sprintsNeeded * sprintDurationDays * MS_PER_DAY;
    const estimatedFinish = new Date(estimatedFinishMs);

    // Caso 4: deadline vencido con SP pendientes
    if (deadline && deadline < now) {
        return {
            ...base,
            classification: 'ROJO',
            message: `Deadline vencido y aún quedan ${remainingSp} SP por completar.`,
            estimated_finish: estimatedFinish.toISOString().slice(0, 10),
            days_diff: Math.round((estimatedFinishMs - deadline.getTime()) / MS_PER_DAY),
        };
    }

    // Sin deadline → no podemos clasificar contra fecha
    if (!deadline) {
        return {
            ...base,
            classification: 'SIN_DATOS',
            message: 'El proyecto no tiene deadline definido.',
            estimated_finish: estimatedFinish.toISOString().slice(0, 10),
        };
    }

    const daysDiff = Math.round((estimatedFinishMs - deadline.getTime()) / MS_PER_DAY);

    let classification;
    let message;
    if (daysDiff <= 0) {
        classification = 'VERDE';
        message = 'Llegará a tiempo con el ritmo actual.';
    } else if (daysDiff <= TOLERANCE_DAYS) {
        classification = 'AMARILLO';
        message = `Riesgo de retraso de ${daysDiff} día(s) con el ritmo actual.`;
    } else {
        classification = 'ROJO';
        message = `No llegará a tiempo: ${daysDiff} días de retraso estimado.`;
    }

    return {
        ...base,
        classification,
        message,
        estimated_finish: estimatedFinish.toISOString().slice(0, 10),
        days_diff: daysDiff,
    };
}

module.exports = {
    MS_PER_DAY,
    TOLERANCE_DAYS,
    DEFAULT_SPRINT_DAYS,
    computeVelocity,
    computeSprintDuration,
    buildPrediction,
};
