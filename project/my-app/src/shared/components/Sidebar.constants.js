// ─── Íconos ───────────────────────────────────────────────────────────────────
export const ICONS = {
    dashboard:  '▣',
    projects:   '▭',
    users:      '◉',
    audit:      '≡',
    leader:     '◇',
    personal:   '◦',
    sprints:    '◫',
    workitems:  '▤',
    backlog:    '▦',
    sprintboard:'◈',
    costs:      '◍',
    suggestions: '⬡',
    risks:      '◬',
};

// ─── Navegación global (fuera de contexto de proyecto) ───────────────────────
//
// `roles`: si está definido, el item solo aparece para esos roles.
// Sin `roles` → visible para todos.
//
export const NAV_ITEMS = [
    // ── General ────────────────────────────────────────────────────────────
    { to: '/home',     label: 'Inicio',     icon: 'dashboard', section: 'general' },
    { to: '/projects', label: 'Proyectos',  icon: 'projects',  section: 'general' },
    {
        to: '/users',
        label: 'Usuarios',
        icon: 'users',
        section: 'general',
        roles: ['admin'],           // Solo gestores
    },

    // ── Inteligencia ───────────────────────────────────────────────────────
    { to: '/audit',       label: 'Bitácora general', icon: 'audit',  section: 'inteligencia', roles: ['admin'] },
    { to: '/leaderboard', label: 'Clasificación',  icon: 'leader', section: 'inteligencia' },
    { to: '/suggestions', label: 'Sugerencias de proyecto', icon: 'suggestions', section:'inteligencia'}
];

// Items especiales del viewer (mismos destinos, distintas etiquetas)
export const VIEWER_GLOBAL_ITEMS = [
    { to: '/home',        label: 'Personal Dashboard', icon: 'personal', section: 'my_work' },
    { to: '/projects',    label: 'Projects',           icon: 'projects', section: 'my_work' },
    { to: '/leaderboard', label: 'Leaderboard',        icon: 'leader',   section: 'recognition' },
];

// ─── Menú de proyecto (sidebar contextual) ───────────────────────────────────
//
// Se muestra cuando el usuario está dentro de una ruta /projects/:id/...
// `roles`: si está definido, solo aparece para esos roles.
// Sin `roles` → visible para todos los roles que puedan entrar al proyecto.
//
export const PROJECT_NAV_ITEMS = [
    {
        suffix: 'view',
        label:  'Dashboard',
        icon:   'dashboard',
        // viewer, pm, admin → todos pueden ver el dashboard del proyecto
    },
    {
        suffix: 'backlog',
        label:  'Backlog',
        icon:   'backlog',
        roles:  ['viewer'],               // Solo viewer tiene la vista de backlog
    },
    {
        suffix: 'sprints',
        label:  'Sprints',
        icon:   'sprints',
        // viewer, pm, admin → todos pueden ver sprints
    },
    {
        suffix: 'work-items',
        label:  'Work Items',
        icon:   'workitems',
        roles:  ['pm', 'admin'],          // Solo gestores asignan work items
    },
    {
        suffix: 'blockers',
        label:  'Bloqueadores pendientes',
        icon:   'audit',
        roles:  ['pm', 'admin'],          // Solo gestores revisan bloqueadores
    },
    {
        suffix: 'costs',
        label:  'Costos',
        icon:   'costs',
        // viewer, pm, admin → todos pueden registrar o aprobar costos
    },
    {
        suffix: 'risks',
        label:  'Riesgos',
        icon:   'risks',
        roles:  ['pm', 'admin'],
    },
    {
        suffix: 'audit',
        label:  'Bitácora',
        icon:   'audit',
        roles:  ['pm', 'admin'],
    },
];