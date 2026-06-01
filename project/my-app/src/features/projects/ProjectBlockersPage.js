import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../../config/api';
import './ProjectBlockersPage.css';

function severityMeta(severity) {
    if (severity === 'critical') return { label: 'Crítico', color: '#B71C1C' };
    if (severity === 'medium') return { label: 'Medio', color: '#8A5A00' };
    return { label: 'Bajo', color: '#2E7D32' };
}

function approvalStatusMeta(status) {
    if (status === 'approved') return { label: 'Aprobado', color: '#2E7D32' };
    if (status === 'rejected') return { label: 'Rechazado', color: '#B71C1C' };
    return { label: 'Pendiente', color: '#8A5A00' };
}

function formatDate(value) {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? value
        : parsed.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ProjectBlockersPage() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const projectName = location.state?.projectName || `Proyecto ${id}`;

    const [blockers, setBlockers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [approving, setApproving] = useState({}); // { [blockerId]: deadline string }
    const [submittingId, setSubmittingId] = useState(null);

    useEffect(() => {
        let active = true;

        async function loadBlockers() {
            try {
                const { res, data } = await api.get(`/blockers?project_id=${id}&approval_status=pending`);
                if (!active) return;

                if (res.ok) {
                    setBlockers(data.blockers || []);
                } else {
                    setMessage({ text: data.message || 'Error cargando bloqueadores', type: 'error' });
                }
            } catch {
                if (active) setMessage({ text: 'Error de conexión', type: 'error' });
            } finally {
                if (active) setLoading(false);
            }
        }

        loadBlockers();
        return () => { active = false; };
    }, [id]);

    async function refreshBlockers() {
        const { res, data } = await api.get(`/blockers?project_id=${id}&approval_status=pending`);
        if (res.ok) {
            setBlockers(data.blockers || []);
        } else {
            setMessage({ text: data.message || 'Error recargando bloqueadores', type: 'error' });
        }
    }

    function openApproveForm(blockerId) {
        setApproving(prev => ({ ...prev, [blockerId]: '' }));
    }

    function cancelApproveForm(blockerId) {
        setApproving(prev => { const next = { ...prev }; delete next[blockerId]; return next; });
    }

    async function confirmApprove(blockerId) {
        const deadline = approving[blockerId];
        if (!deadline) {
            setMessage({ text: 'Debes seleccionar una fecha límite para aprobar', type: 'error' });
            return;
        }
        setMessage({ text: '', type: '' });
        setSubmittingId(blockerId);
        try {
            const { res, data } = await api.patch(`/blockers/${blockerId}/approve`, {
                approval_status: 'approved',
                deadline: new Date(deadline).toISOString(),
            });
            if (res.ok) {
                setMessage({ text: 'Bloqueador aprobado con fecha límite', type: 'success' });
                cancelApproveForm(blockerId);
                await refreshBlockers();
            } else {
                setMessage({ text: data.message || 'Error aprobando bloqueador', type: 'error' });
            }
        } catch {
            setMessage({ text: 'Error de conexión', type: 'error' });
        } finally {
            setSubmittingId(null);
        }
    }

    async function rejectBlocker(blockerId) {
        const reason = window.prompt('Motivo del rechazo');
        if (!reason || !reason.trim()) return;

        setMessage({ text: '', type: '' });
        try {
            const { res, data } = await api.patch(`/blockers/${blockerId}/reject`, {
                approval_status: 'rejected',
                rejected_reason: reason.trim(),
            });
            if (res.ok) {
                setMessage({ text: 'Bloqueador rechazado', type: 'success' });
                await refreshBlockers();
            } else {
                setMessage({ text: data.message || 'Error rechazando bloqueador', type: 'error' });
            }
        } catch {
            setMessage({ text: 'Error de conexión', type: 'error' });
        }
    }

    return (
        <div className="pbp-page">
            <div className="pbp-top-bar">
                <div className="pbp-breadcrumb">
                    <button className="pbp-crumb-btn" onClick={() => navigate('/projects')}>Proyectos</button>
                    <span className="pbp-sep">/</span>
                    <button className="pbp-crumb-btn" onClick={() => navigate(`/projects/${id}/view`, { state: { projectName } })}>
                        {projectName}
                    </button>
                    <span className="pbp-sep">/</span>
                    <span className="pbp-crumb-current">Bloqueadores pendientes</span>
                </div>
                <button className="pbp-back-btn" onClick={() => navigate(`/projects/${id}/view`, { state: { projectName } })}>
                    ← Volver al proyecto
                </button>
            </div>

            <div className="pbp-body">
                <div className="pbp-header-card">
                    <h1 className="pbp-title">Bloqueadores pendientes</h1>
                    <p className="pbp-subtitle">Revisa las implicaciones y bloqueadores registrados por los viewers antes de aprobarlos o rechazarlos.</p>
                </div>

                {message.text && (
                    <div className={message.type === 'error' ? 'pbp-error-box' : 'pbp-success-box'}>
                        {message.text}
                    </div>
                )}

                {loading ? (
                    <div className="pbp-empty-state">Cargando bloqueadores...</div>
                ) : blockers.length === 0 ? (
                    <div className="pbp-empty-state">No hay bloqueadores pendientes en este proyecto.</div>
                ) : (
                    <div className="pbp-list">
                        {blockers.map((blocker) => {
                            const severity = severityMeta(blocker.severity);
                            const approval = approvalStatusMeta(blocker.approval_status);
                            const workItem = blocker.work_item || {};
                            const sprint = blocker.sprint || {};

                            return (
                                <article key={blocker.id_blocker} className="pbp-card">
                                    <div className="pbp-card-top">
                                        <div>
                                            <div className="pbp-card-label">{blocker.kind === 'implication' ? 'Implicación' : 'Bloqueador'}</div>
                                            <div className="pbp-card-title">{blocker.description}</div>
                                        </div>
                                        <div className="pbp-chips">
                                            <span className="pbp-chip" style={{ color: severity.color }}>{severity.label}</span>
                                            <span className="pbp-chip-sep">·</span>
                                            <span className="pbp-chip" style={{ color: approval.color }}>{approval.label}</span>
                                        </div>
                                    </div>

                                    <div className="pbp-card-body">{blocker.impact}</div>

                                    <div className="pbp-meta-grid">
                                        <div className="pbp-meta-item"><span>Work item</span><strong>{workItem.title || `Item #${blocker.id_work_item}`}</strong></div>
                                        <div className="pbp-meta-item"><span>Sprint</span><strong>{sprint.name || `Sprint #${workItem.id_sprint || 'N/A'}`}</strong></div>
                                        <div className="pbp-meta-item"><span>Creado por</span><strong>{blocker.created_by_user?.full_name || blocker.created_by_user?.username || 'N/D'}</strong></div>
                                        <div className="pbp-meta-item"><span>Fecha</span><strong>{formatDate(blocker.created_at)}</strong></div>
                                    </div>

                                    {approving[blocker.id_blocker] !== undefined ? (
                                        <div className="pbp-approve-form">
                                            <label className="pbp-approve-label">Fecha límite para resolver</label>
                                            <input
                                                type="date"
                                                className="pbp-date-input"
                                                min={new Date().toISOString().slice(0, 10)}
                                                value={approving[blocker.id_blocker]}
                                                onChange={e => setApproving(prev => ({ ...prev, [blocker.id_blocker]: e.target.value }))}
                                            />
                                            <div className="pbp-actions">
                                                <button
                                                    className="pbp-approve-btn"
                                                    disabled={submittingId === blocker.id_blocker}
                                                    onClick={() => confirmApprove(blocker.id_blocker)}
                                                >
                                                    {submittingId === blocker.id_blocker ? 'Aprobando...' : 'Confirmar aprobación'}
                                                </button>
                                                <button className="pbp-reject-btn" onClick={() => cancelApproveForm(blocker.id_blocker)}>Cancelar</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="pbp-actions">
                                            <button className="pbp-approve-btn" onClick={() => openApproveForm(blocker.id_blocker)}>Aprobar</button>
                                            <button className="pbp-reject-btn" onClick={() => rejectBlocker(blocker.id_blocker)}>Rechazar</button>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}