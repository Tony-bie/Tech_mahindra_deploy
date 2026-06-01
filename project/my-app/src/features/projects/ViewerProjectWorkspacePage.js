import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../../config/api';
import { useAuthContext } from '../../shared/context/AuthContext';
import ProjectProgressCard from './ProjectProgressCard';
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

    const sprintItems    = activeSprint ? items.filter(i => i.id_sprint === activeSprint.id_sprint) : [];
    const sprintDone     = sprintItems.filter(i => i.status === 'done').length;
    const sprintProgress = sprintItems.length > 0 ? Math.round((sprintDone / sprintItems.length) * 100) : 0;
    const daysLeft       = activeSprint?.deadline
        ? Math.ceil((new Date(activeSprint.deadline) - new Date()) / 86400000)
        : null;

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
                </section>

                {/* Sprint activo */}
                {!loading && activeSprint && (
                    <div className="vpw-sprint-card">
                        <div className="vpw-sprint-col vpw-sprint-col--name">
                            <span className="vpw-stat-label">Sprint activo</span>
                            <strong className="vpw-sprint-name">{activeSprint.name}</strong>
                        </div>
                        <div className="vpw-sprint-col">
                            <span className="vpw-stat-label">Deadline</span>
                            <strong className="vpw-sprint-meta-value">
                                {activeSprint.deadline
                                    ? new Date(activeSprint.deadline).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
                                    : '—'}
                            </strong>
                            {daysLeft !== null && (
                                <span className="vpw-stat-hint" style={{ color: daysLeft < 0 ? '#B94A48' : daysLeft <= 3 ? '#8A5A00' : '#7B7B7B' }}>
                                    {daysLeft < 0 ? `${Math.abs(daysLeft)} día(s) vencido` : daysLeft === 0 ? 'Vence hoy' : `${daysLeft} día(s) restantes`}
                                </span>
                            )}
                        </div>
                        <div className="vpw-sprint-col">
                            <span className="vpw-stat-label">SP estimados</span>
                            <strong className="vpw-sprint-meta-value">{activeSprint.SP_estimated ?? '—'}</strong>
                        </div>
                        <div className="vpw-sprint-col">
                            <span className="vpw-stat-label">Progreso del sprint</span>
                            <strong className="vpw-sprint-meta-value">{sprintProgress}%</strong>
                            <span className="vpw-stat-hint">{sprintDone} de {sprintItems.length} ítems</span>
                            <span className="vpw-progress-track" style={{ marginTop: 4 }}>
                                <span className="vpw-progress-fill" style={{ width: `${sprintProgress}%` }} />
                            </span>
                        </div>
                    </div>
                )}

                {/* Work items */}
                <div className="vpw-card">
                    <div className="vpw-card-header">
                        <div className="vpw-card-title">Ítems del proyecto</div>
                        <button
                            className="vpw-snapshot-btn"
                            onClick={() => navigate(
                                isPM
                                    ? `/projects/${id}/work-items`
                                    : `/projects/${id}/backlog`,
                                { state: { projectName } }
                            )}
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
                                    {!isPM && (
                                        <button
                                            className="vpw-snapshot-btn"
                                            onClick={() => navigate(`/projects/${id}/backlog/${item.id_work_item}`, { state: { projectName } })}
                                        >
                                            Ver
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
