import { NavLink, useLocation } from 'react-router-dom';
import { ICONS, PROJECT_NAV_ITEMS } from './Sidebar.constants';

export default function SidebarProjectSection({
    projectId,
    projectLabel,
    projectState,
    role,
    menuClass,
}) {
    const location = useLocation();

    // Detectar si estamos en un sprint board: /projects/:id/sprint-board/:id_sprint
    const sprintBoardMatch = /\/sprint-board\/([^/]+)/.exec(location.pathname);
    const isOnSprintBoard  = !!sprintBoardMatch;
    const sprintBoardId    = sprintBoardMatch?.[1];

    const items = PROJECT_NAV_ITEMS.filter(
        item => !item.roles || item.roles.includes(role)
    );

    return (
        <div className="sb-section">
            <div className="sb-section-label">{projectLabel}</div>

            {items.map(item => {
                const to = `/projects/${projectId}/${item.suffix}`;

                // "Sprints" también se marca activo cuando estás en el sprint board
                const isSprintsItem    = item.suffix === 'sprints';
                const forceSprintActive = isSprintsItem && isOnSprintBoard;

                return (
                    <div key={item.suffix}>
                        <NavLink
                            to={to}
                            state={projectState}
                            className={({ isActive }) =>
                                menuClass({ isActive: isActive || forceSprintActive })
                            }
                        >
                            <span className="sb-icon">{ICONS[item.icon]}</span>
                            {item.label}
                        </NavLink>

                        {/* Sub-ítem Tablero — solo cuando estás dentro de un sprint board */}
                        {isSprintsItem && isOnSprintBoard && (
                            <NavLink
                                to={`/projects/${projectId}/sprint-board/${sprintBoardId}`}
                                state={projectState}
                                className={({ isActive }) =>
                                    'sb-nav-item sb-nav-sub-item' + (isActive ? ' sb-nav-item-active' : '')
                                }
                            >
                                <span className="sb-icon">{ICONS.sprintboard}</span>
                                Tablero
                            </NavLink>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
