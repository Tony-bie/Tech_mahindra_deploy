import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getBacklogItemsForProject } from './viewerBacklogMock';
import ProjectProgressCard from './ProjectProgressCard';
import './ViewerProjectWorkspacePage.css';

export default function ViewerProjectWorkspacePage() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const projectName = location.state?.projectName || `Proyecto ${id}`;
    const backlogItems = getBacklogItemsForProject(id);
    const blockedItems = backlogItems.filter((item) => item.blockerCount > 0).length;
    const doneItems = backlogItems.filter((item) => item.status === 'Done').length;
    const progress = Math.round((doneItems / Math.max(backlogItems.length, 1)) * 100);

    return (
        <div className="vpw-page">
            <div className="vpw-top-bar">
                <div className="vpw-breadcrumb">
                    <span>Inicio</span>
                    <span className="vpw-sep">/</span>
                    <span>Projects</span>
                    <span className="vpw-sep">/</span>
                    <span className="vpw-current-crumb">{projectName}</span>
                </div>
                <button className="vpw-backlog-btn" onClick={() => navigate(`/projects/${id}/backlog`, { state: { projectName } })}>
                    Ir al backlog
                </button>
            </div>

            <div className="vpw-body">
                <ProjectProgressCard projectId={id} />

                <section className="vpw-hero-card">
                    <div>
                        <div className="vpw-kicker">Viewer project workspace</div>
                        <h1 className="vpw-title">{projectName}</h1>
                        <p className="vpw-subtitle">
                            Vista visual del proyecto para revisar avance, backlog y bloqueadores sin tocar backend todavía.
                        </p>
                    </div>

                    <div className="vpw-hero-actions">
                        <button className="vpw-primary-btn" onClick={() => navigate(`/projects/${id}/backlog`, { state: { projectName } })}>
                            Ver backlog
                        </button>
                        <div className="vpw-hero-tag">Sprint 4 active</div>
                    </div>
                </section>

                <section className="vpw-stats-grid">
                    <div className="vpw-stat-card">
                        <span className="vpw-stat-label">Backlog items</span>
                        <strong className="vpw-stat-value">{backlogItems.length}</strong>
                        <span className="vpw-stat-hint">Items visibles para el viewer</span>
                    </div>
                    <div className="vpw-stat-card">
                        <span className="vpw-stat-label">Blocked items</span>
                        <strong className="vpw-stat-value-danger">{blockedItems}</strong>
                        <span className="vpw-stat-hint">Bloqueadores o implicaciones activas</span>
                    </div>
                    <div className="vpw-stat-card">
                        <span className="vpw-stat-label">Visual progress</span>
                        <strong className="vpw-stat-value">{progress}%</strong>
                        <span className="vpw-progress-track">
                            <span className="vpw-progress-fill" style={{ width: `${progress}%` }} />
                        </span>
                    </div>
                    <div className="vpw-stat-card">
                        <span className="vpw-stat-label">Current status</span>
                        <strong className="vpw-stat-value">In review</strong>
                        <span className="vpw-stat-hint">Solo representación visual por ahora</span>
                    </div>
                </section>

                <section className="vpw-content-grid">
                    <div className="vpw-main-column">
                        <div className="vpw-card">
                            <div className="vpw-card-header">
                                <div>
                                    <div className="vpw-section-label">Quick access</div>
                                    <div className="vpw-card-title">Entradas principales del proyecto</div>
                                </div>
                            </div>

                            <div className="vpw-quick-grid">
                                <button className="vpw-quick-action" onClick={() => navigate(`/projects/${id}/backlog`, { state: { projectName } })}>
                                    Backlog
                                </button>
                                <button className="vpw-quick-action" onClick={() => navigate(`/projects/${id}/backlog`, { state: { projectName } })}>
                                    Work item blockers
                                </button>
                                <button className="vpw-quick-action" onClick={() => navigate('/leaderboard')}>
                                    Leaderboard
                                </button>
                                <button className="vpw-quick-action" onClick={() => navigate('/audit')}>
                                    Audit trail
                                </button>
                            </div>
                        </div>

                        <div className="vpw-card">
                            <div className="vpw-card-header">
                                <div>
                                    <div className="vpw-section-label">Backlog snapshot</div>
                                    <div className="vpw-card-title">Resumen rápido de ítems</div>
                                </div>
                            </div>

                            <div className="vpw-snapshot-list">
                                {backlogItems.slice(0, 3).map((item) => (
                                    <div key={item.id} className="vpw-snapshot-row">
                                        <div>
                                            <div className="vpw-snapshot-title">{item.title}</div>
                                            <div className="vpw-snapshot-meta">{item.type} · {item.assignee} · {item.storyPoints} SP</div>
                                        </div>
                                        <button className="vpw-snapshot-btn" onClick={() => navigate(`/projects/${id}/backlog/${item.id}`, { state: { projectName } })}>
                                            View
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <aside className="vpw-side-column">
                        <div className="vpw-side-card">
                            <div className="vpw-section-label">Project focus</div>
                            <div className="vpw-side-text">
                                Esta pantalla es solo visual. La interacción detallada de bloqueos vive dentro del detalle del work item.
                            </div>
                        </div>

                        <div className="vpw-side-card">
                            <div className="vpw-section-label">Alert</div>
                            <div className="vpw-alert-box">
                                {blockedItems > 0 ? `${blockedItems} item(s) tienen bloqueadores activos.` : 'No active blockers.'}
                            </div>
                        </div>
                    </aside>
                </section>
            </div>
        </div>
    );
}