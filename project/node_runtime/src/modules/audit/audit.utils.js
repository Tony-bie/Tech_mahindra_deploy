// project/node_runtime/src/modules/audit/audit.utils.js

// Mapa de action → label en español visible en la UI.
const ACTION_LABELS = {
    CREATE_PROJECT:           'Creó proyecto',
    ADD_VIEWER:               'Vinculó viewer',
    REMOVE_VIEWER:            'Desvinculó viewer',
    ASSIGN_WORK_ITEM:         'Reasignó work item',
    UPDATE_WORK_ITEM_STATUS:  'Cambió estado de work item',
    CREATE_WORK_ITEM:         'Creó work item',
    SUBMIT_COST:              'Registró costo',
    COST_APPROVED:            'Aprobó costo',
    COST_REJECTED:            'Rechazó costo',
    CREATE_RISK:              'Registró riesgo',
    CLOSE_RISK:               'Cerró riesgo',
    DISCARD_RISK:             'Descartó riesgo',
    CREATE_BLOCKER:           'Reportó bloqueador',
    CREATE_BLOCKER_CRITICAL:  'Reportó bloqueador crítico',
    APPROVE_BLOCKER:          'Aprobó bloqueador',
    REJECT_BLOCKER:           'Rechazó bloqueador',
    RESOLVE_BLOCKER:          'Resolvió bloqueador',
    CREATE_SPRINT:            'Creó sprint',
    LOGIN:                    'Inició sesión',
};

function actionLabel(action) {
    return ACTION_LABELS[action] || action;
}

// Extrae { before, after } de un payload, normalizando formatos legacy.
// Prioridad:
//   1. payload.before / payload.after si vienen explícitos
//   2. payload.from / payload.to (formato viejo en ASSIGN_WORK_ITEM, UPDATE_WORK_ITEM_STATUS)
//   3. Inferencia por tipo de acción (creates → after, deletes → before)
function extractBeforeAfter(action, payload) {
    if (!payload || typeof payload !== 'object') {
        return { before: null, after: null };
    }
    if ('before' in payload || 'after' in payload) {
        return { before: payload.before ?? null, after: payload.after ?? null };
    }
    if ('from' in payload || 'to' in payload) {
        return { before: payload.from ?? null, after: payload.to ?? null };
    }
    const isCreate = /^(CREATE_|SUBMIT_|ADD_|LOGIN)/.test(action);
    const isDelete = /^(REMOVE_|DELETE_)/.test(action);
    const snapshot = stripMeta(payload);
    if (isCreate) return { before: null, after: snapshot };
    if (isDelete) return { before: snapshot, after: null };
    return { before: null, after: snapshot };
}

function stripMeta(payload) {
    const { project_id, project_name, ...rest } = payload;
    return Object.keys(rest).length === 0 ? null : rest;
}

module.exports = { actionLabel, extractBeforeAfter, ACTION_LABELS };
