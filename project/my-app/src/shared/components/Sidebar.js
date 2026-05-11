import { NavLink, useLocation, useParams } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import {
    ICONS,
    NAV_ITEMS,
    VIEWER_GLOBAL_ITEMS,
} from './Sidebar.constants';
import SidebarProjectSection from './SidebarProjectSection';
import './Sidebar.css';

/** Extrae iniciales del username para el avatar */
function getInitials(username = '') {
    return username
        .split(/[\s_-]+/)
        .slice(0, 2)
        .map(w => w[0] ?? '')
        .join('')
        .toUpperCase() || '?';
}

/**
 * Sidebar unificado con RBAC real.
 *
 * Reglas de visibilidad:
 *   - La sección "proyecto" aparece para TODOS los roles cuando el usuario
 *     está en una ruta /projects/:id/...  Los items dentro se filtran por rol.
 *   - viewer  → sección "My Work" + "Recognition" + proyecto si aplica
 *   - pm/admin → sección "General" + "Inteligencia" + proyecto si aplica
 *
 * Espeja exactamente los roles definidos en AppRouter → ProtectedRoute.
 */
export default function Sidebar({ onLogout }) {
    const { user }  = useAuthContext();
    const location  = useLocation();
    const params    = useParams();

    const role     = user?.role ?? '';
    const isViewer = role === 'viewer';

    // ── Detección de contexto de proyecto ────────────────────────────────────
    // Coincide con /projects/:id/cualquier-subruta
    const projectRouteMatch = /^\/projects\/(\d+)\//.exec(location.pathname);
    const isInProject       = !!projectRouteMatch;
    const contextProjectId  = params?.id ?? projectRouteMatch?.[1] ?? null;

    const projectNameFromState = location.state?.projectName;
    const projectLabel = (
        projectNameFromState || `Proyecto ${contextProjectId || ''}`
    ).toUpperCase();

    const projectState = { projectName: projectNameFromState };

    // ── Clases de NavLink ─────────────────────────────────────────────────────
    const navClass = ({ isActive }) =>
        'sb-nav-item' + (isActive ? ' sb-nav-item-active' : '');

    const projectMenuClass = ({ isActive }) =>
        'sb-nav-item sb-nav-item-project' + (isActive ? ' sb-nav-item-active' : '');

    // ── Navegación global filtrada por rol ────────────────────────────────────
    const globalItems = (isViewer ? VIEWER_GLOBAL_ITEMS : NAV_ITEMS).filter(
        item => !item.roles || item.roles.includes(role)
    );

    const sectionGeneral      = globalItems.filter(i => i.section === 'general');
    const sectionInteligencia = globalItems.filter(i => i.section === 'inteligencia');
    const sectionMyWork       = globalItems.filter(i => i.section === 'my_work');
    const sectionRecognition  = globalItems.filter(i => i.section === 'recognition');

    // ── Render helper ─────────────────────────────────────────────────────────
    const renderNavItems = items =>
        items.map(item => (
            <NavLink key={item.to} to={item.to} className={navClass}>
                <span className="sb-icon">{ICONS[item.icon]}</span>
                {item.label}
            </NavLink>
        ));

    return (
        <aside className="sb-sidebar">

            {/* ── Logo ─────────────────────────────────────────────────────── */}
            <div className="sb-logo-wrap">
                <div className="sb-logo-box">
                    <div className="sb-logo-icon">T</div>
                    <div>
                        <div className="sb-logo-text">
                            {isViewer ? 'Viewer' : 'TECH'}
                        </div>
                        <div className="sb-logo-sub">Mahindra PM</div>
                    </div>
                </div>
            </div>

            {/* ── Navegación ───────────────────────────────────────────────── */}

            {isViewer ? (
                /* ── VIEWER ──────────────────────────────────────────────── */
                <>
                    <div className="sb-section">
                        <div className="sb-section-label">My Work</div>
                        {renderNavItems(sectionMyWork)}
                    </div>

                    {/* Sección de proyecto: aparece para viewer también */}
                    {isInProject && contextProjectId && (
                        <SidebarProjectSection
                            projectId={contextProjectId}
                            projectLabel={projectLabel}
                            projectState={projectState}
                            role={role}
                            menuClass={projectMenuClass}
                        />
                    )}

                    <div className="sb-section">
                        <div className="sb-section-label">Recognition</div>
                        {renderNavItems(sectionRecognition)}
                    </div>
                </>
            ) : (
                /* ── PM / ADMIN ───────────────────────────────────────────── */
                <>
                    <div className="sb-section">
                        <div className="sb-section-label">General</div>
                        {renderNavItems(sectionGeneral)}
                    </div>

                    {/* ✅ Sección de proyecto para PM y admin */}
                    {isInProject && contextProjectId && (
                        <SidebarProjectSection
                            projectId={contextProjectId}
                            projectLabel={projectLabel}
                            projectState={projectState}
                            role={role}
                            menuClass={projectMenuClass}
                        />
                    )}

                    <div className="sb-section">
                        <div className="sb-section-label">Inteligencia</div>
                        {renderNavItems(sectionInteligencia)}
                    </div>
                </>
            )}

            {/* ── Footer: usuario + logout ──────────────────────────────────── */}
            <div className="sb-logout-wrap">
                <div className="sb-user-info">
                    <div className="sb-user-avatar">
                        {getInitials(user?.username)}
                    </div>
                    <div className="sb-user-meta">
                        <span className="sb-user-name">{user?.username}</span>
                        <span className="sb-user-role">{user?.role}</span>
                    </div>
                </div>

                {onLogout && (
                    <button className="sb-logout-btn" onClick={onLogout}>
                        <span className="sb-logout-btn-icon">⎋</span>
                        Cerrar sesión
                    </button>
                )}
            </div>

        </aside>
    );
}