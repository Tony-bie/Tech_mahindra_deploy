import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../../config/api';
import { useAuthContext } from '../../shared/context/AuthContext';
import ProjectProgressCard from './ProjectProgressCard';
import PredictionCard from './PredictionCard';
import './ViewerProjectWorkspacePage.css';

export default function ViewerProjectWorkspacePage() {
    const { id }       = useParams();
    const location     = useLocation();
    const navigate     = useNavigate();
    const projectName  = location.state?.projectName || `Proyecto ${id}`;

    const [items,         setItems]         = useState([]);
    const [activeSprint,  setActiveSprint]  = useState(null);
    const [loading,       setLoading]       = useState(true);
    const [activeRisks,   setActiveRisks]   = useState(0);
    const { user } = useAuthContext();
    const isPM = user?.role === 'pm' || user?.role === 'admin';

    const loadData = useCallback(async () => {
        try {
            const [itemsRes, sprintsRes] = await Promise.all([
                api.get(`/work-items?project_id=${id}`),
                api.get(`/sprints/${id}/get-sprints`),
            ]);

            if (itemsRes.res.ok) {
                setItems(itemsRes.data.items || []);
            }

            const sprintList = sprintsRes.data?.data || sprintsRes.data || [];
            const active = Array.isArray(sprintList)
                ? sprintList.find(s => s.status === 'active') || sprintList[sprintList.length - 1] || null
                : null;
            setActiveSprint(active);
        } catch {
            // no bloquea la vista
        } finally {
            setLoading(false);
        }

        try {
            const { res: riskRes, data: riskData } = await api.get(`/risks?project_id=${id}`);
            if (riskRes.ok) {
                setActiveRisks((riskData.risks || []).filter(r => r.status === 'active').length);
            }
        } catch { /* no bloquea la vista */ }
    }, [id]);

    useEffect(() => { loadData(); }, [loadData]);

    const doneItems    = items.filter(i => i.status === 'done').length;
    const totalItems   = items.length;
    const progress     = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
    const inProgress   = items.filter(i => i.status === 'in_progress').length;

    return (
        <div className="vpw-page">
            <div className="vpw-top-bar">
                <div className="vpw-breadcrumb">
                    <span>Inicio</span>
                    <span className="vpw-sep">/</span>
                    <span>Proyectos</span>
                    <span className="vpw-sep">/</span>
                    <span className="vpw-current-crumb">{projectName}</span>
                </div>
                {activeSprint && (
                    <div className="vpw-hero-tag">{activeSprint.name} activo</div>
                )}
            </div>

            <div className="vpw-body">
                {/* Avance real vs esperado */}
                <ProjectProgressCard projectId={id} />

                {/* HU-24: Predicción del cumplimiento del deadline */}
                <PredictionCard projectId={id} />

                {/* Stats */}
                <section className="vpw-stats-grid">
                    <div className="vpw-stat-card">
                        <span className="vpw-stat-label">Ítems totales</span>
                        <strong className="vpw-stat-value">{loading ? '—' : totalItems}</strong>
                    </div>
                    <div className="vpw-stat-card">
                        <span className="vpw-stat-label">En progreso</span>
                        <strong className="vpw-stat-value">{loading ? '—' : inProgress}</strong>
                    </div>
                    <div className="vpw-stat-card">
                        <span className="vpw-stat-label">Completados</span>
                        <strong className="vpw-stat-value">{loading ? '—' : doneItems}</strong>
                        <span className="vpw-progress-track">
                            <span className="vpw-progress-fill" style={{ width: `${progress}%` }} />
                        </span>
                    </div>
                    <div className="vpw-stat-card">
                        <span className="vpw-stat-label">Riesgos activos</span>
                        <strong
                            className="vpw-stat-value"
                            style={{ color: activeRisks > 0 ? '#B94A48' : undefined }}
                        >
                            {loading ? '—' : activeRisks}
                        </strong>
                    </div>
                    <div className="vpw-stat-card">
                        <span className="vpw-stat-label">Sprint activo</span>
                        <strong className="vpw-stat-value" style={{ fontSize: 15 }}>
                            {loading ? '—' : activeSprint ? activeSprint.name : 'Sin sprint'}
                        </strong>
                        {activeSprint?.SP_estimated && (
                            <span className="vpw-stat-hint">{activeSprint.SP_estimated} SP estimados</span>
                        )}
                    </div>
                </section>

                <section className="vpw-content-grid">
                    <div className="vpw-main-column">
                        {/* Work items */}
                        <div className="vpw-card">
                            <div className="vpw-card-header">
                                <div className="vpw-card-title">Ítems del proyecto</div>
                                <button
                                    className="vpw-snapshot-btn"
                                    onClick={() => navigate(`/projects/${id}/backlog`, { state: { projectName } })}
                                >
                                    Ver todos
                                </button>
                            </div>
                            <div className="vpw-snapshot-list">
                                {loading ? (
                                    <div style={{ padding: '16px 0', color: '#AAA', fontSize: 13 }}>Cargando ítems...</div>
                                ) : items.length === 0 ? (
                                    <div style={{ padding: '16px 0', color: '#AAA', fontSize: 13 }}>No hay ítems en este proyecto.</div>
                                ) : (
                                    items.slice(0, 5).map((item) => (
                                        <div key={item.id_work_item} className="vpw-snapshot-row">
                                            <div>
                                                <div className="vpw-snapshot-title">{item.title}</div>
                                                <div className="vpw-snapshot-meta">
                                                    {item.type || 'Tarea'}
                                                    {item.assignee ? ` · ${item.assignee.username}` : ''}
                                                    {item.story_points ? ` · ${item.story_points} SP` : ''}
                                                </div>
                                            </div>
                                            <button
                                                className="vpw-snapshot-btn"
                                                onClick={() => navigate(`/projects/${id}/backlog/${item.id_work_item}`, { state: { projectName } })}
                                            >
                                                Ver
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <aside className="vpw-side-column">
                        <div className="vpw-side-card">
                            <div className="vpw-section-label">Navegación</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                                <button className="vpw-quick-action" onClick={() => navigate('/leaderboard')}>
                                    Leaderboard
                                </button>
                                <button className="vpw-quick-action" onClick={() => navigate('/audit')}>
                                    Auditoría
                                </button>
                                {isPM && (
                                    <button
                                        className="vpw-quick-action"
                                        onClick={() => navigate(`/projects/${id}/risks`, { state: { projectName } })}
                                    >
                                        Riesgos
                                    </button>
                                )}
                            </div>
                        </div>
                    </aside>
                </section>
            </div>
        </div>
    );
}
