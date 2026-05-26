// project/my-app/src/features/audit/audit.utils.js

// Color por entidad — sigue paleta del dashboard.
export const ENTITY_COLORS = {
    project:        '#3B82F6', // azul
    project_member: '#06B6D4', // cian
    work_item:      '#10B981', // verde
    spend:          '#F59E0B', // ámbar
    risk:           '#EF4444', // rojo
    blocker:        '#F97316', // naranja
    sprint:         '#8B5CF6', // violeta
};

export const ENTITY_LABELS = {
    project:        'Proyecto',
    project_member: 'Viewer',
    work_item:      'Work item',
    spend:          'Costo',
    risk:           'Riesgo',
    blocker:        'Bloqueador',
    sprint:         'Sprint',
};

// Acciones disponibles para el filtro (las mismas claves que envía backend).
export const ACTION_OPTIONS = [
    { value: '',                        label: 'Todas las acciones' },
    { value: 'CREATE_PROJECT',          label: 'Creó proyecto' },
    { value: 'ADD_VIEWER',              label: 'Vinculó viewer' },
    { value: 'REMOVE_VIEWER',           label: 'Desvinculó viewer' },
    { value: 'ASSIGN_WORK_ITEM',        label: 'Reasignó work item' },
    { value: 'UPDATE_WORK_ITEM_STATUS', label: 'Cambió estado de work item' },
    { value: 'SUBMIT_COST',             label: 'Registró costo' },
    { value: 'COST_APPROVED',           label: 'Aprobó costo' },
    { value: 'COST_REJECTED',           label: 'Rechazó costo' },
    { value: 'CREATE_RISK',             label: 'Registró riesgo' },
    { value: 'CLOSE_RISK',              label: 'Cerró riesgo' },
    { value: 'DISCARD_RISK',            label: 'Descartó riesgo' },
    { value: 'CREATE_BLOCKER',          label: 'Reportó bloqueador' },
    { value: 'CREATE_BLOCKER_CRITICAL', label: 'Reportó bloqueador crítico' },
    { value: 'APPROVE_BLOCKER',         label: 'Aprobó bloqueador' },
    { value: 'REJECT_BLOCKER',          label: 'Rechazó bloqueador' },
];

export const ENTITY_OPTIONS = [
    { value: '',                label: 'Todas las entidades' },
    { value: 'project',         label: 'Proyectos' },
    { value: 'project_member',  label: 'Viewers' },
    { value: 'work_item',       label: 'Work items' },
    { value: 'spend',           label: 'Costos' },
    { value: 'risk',            label: 'Riesgos' },
    { value: 'blocker',         label: 'Bloqueadores' },
];

// Formatea timestamp ISO → '12/may/2026 14:32'
export function formatWhen(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const date = d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
}

// Convierte un objeto before/after en string legible:
//   { status: 'active', level: 'high' }  →  'status: active · level: high'
//   null  →  '—'
//   string primitivo (legacy: from='todo')  →  'todo'
export function formatValue(v) {
    if (v === null || v === undefined) return '—';
    if (typeof v !== 'object') return String(v);
    const entries = Object.entries(v);
    if (entries.length === 0) return '—';
    return entries.map(([k, val]) => `${k}: ${val ?? '∅'}`).join(' · ');
}
