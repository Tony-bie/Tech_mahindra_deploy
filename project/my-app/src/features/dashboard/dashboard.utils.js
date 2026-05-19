// Helpers y constantes compartidas por el dashboard admin.

export const fmtMoney = n => `$${Number(n || 0).toLocaleString('es-MX')}`;
// Recibe ratio 0-1.
export const fmtPct = v => `${Math.round(v * 100)}%`;

// Paleta consistente para todas las graficas.
export const COLORS = {
    primary:   '#CC0000',
    accent:    '#3162D1',
    success:   '#3C9A57',
    warning:   '#E08F00',
    danger:    '#B94A48',
    muted:     '#7E8693',
    palette: ['#3162D1', '#3C9A57', '#E08F00', '#B94A48', '#7E8693', '#9C27B0', '#00ACC1', '#FF7043'],
};

// Mapas de etiquetas legibles
export const STATUS_LABEL = {
    todo:        'Por hacer',
    in_progress: 'En curso',
    done:        'Finalizado',
    planned:     'Planeado',
    active:      'Activo',
    cancelled:   'Cancelado',
    pending:     'Pendiente',
    approved:    'Aprobado',
    rejected:    'Rechazado',
};

export const TYPE_LABEL = {
    user_story: 'Historia',
    task:       'Tarea',
    bug:        'Bug',
};

export const ROLE_LABEL = {
    admin:  'Administrador',
    pm:     'Project Manager',
    viewer: 'Viewer',
};

// Acciones del audit_log a texto legible
export const ACTION_LABEL = {
    CREATE_PROJECT:           'Crear proyecto',
    ADD_VIEWER:               'Agregar viewer',
    REMOVE_VIEWER:            'Quitar viewer',
    UPDATE_WORK_ITEM_STATUS:  'Cambiar estado de ítem',
    ASSIGN_WORK_ITEM:         'Asignar ítem',
    SUBMIT_COST:              'Registrar costo',
    COST_APPROVED:            'Aprobar costo',
    COST_REJECTED:            'Rechazar costo',
    APPROVE_BLOCKER:          'Aprobar bloqueador',
    REJECT_BLOCKER:           'Rechazar bloqueador',
    CREATE_BLOCKER_CRITICAL:  'Bloqueador crítico',
};

export const prettyAction = a => ACTION_LABEL[a] || a;
export const prettyStatus = s => STATUS_LABEL[s] || s;
export const prettyType   = t => TYPE_LABEL[t]   || t;
export const prettyRole   = r => ROLE_LABEL[r]   || r;

// Estilos compartidos.
export const styles = {
    page:         { minHeight: '100vh', backgroundColor: '#F5F5F4', fontFamily: "'DM Sans',sans-serif", color: '#1A1A1A' },
    topBar:       { backgroundColor: '#FFF', borderBottom: '1px solid #E5E5E3', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center' },
    crumbCurrent: { fontSize: 13, color: '#1A1A1A', fontWeight: 500 },
    body:         { padding: 32, maxWidth: 1400, margin: '0 auto' },
    title:        { fontSize: 26, fontWeight: 700, marginBottom: 4 },
    subtitle:     { fontSize: 13, color: '#888', marginBottom: 24 },
    sectionTitle: { fontSize: 14, fontWeight: 700, color: '#1A1A1A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, marginTop: 8 },
    muted:        { fontSize: 13, color: '#AAA' },
    errorBox:     { padding: '12px 16px', backgroundColor: '#FFF5F5', border: '1px solid #FFCDD2', borderRadius: 4, color: '#B71C1C', fontSize: 13, marginBottom: 16 },
    card:         { backgroundColor: '#FFF', border: '1px solid #E8E8E6', borderRadius: 8, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' },
    cardTitle:    { fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 12 },
    grid2:        { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 },
    grid3:        { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 },
    grid4:        { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
};
