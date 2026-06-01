import { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuthContext } from '../../shared/context/AuthContext';
import api from '../../config/api';
import './ViewerWorkItemDetailPage.css';

// Supabase devuelve TIMESTAMP sin 'Z'; forzar UTC antes de formatear
function fmtMty(ts) {
    if (!ts) return '—';
    const utc = /[Z+]/.test(ts) ? ts : ts + 'Z';
    return new Date(utc).toLocaleString('es-MX', {
        timeZone: 'America/Monterrey',
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

// ── Helpers (antes venían del mock) ──────────────────────────────────────────
function initialsFromName(name = '') {
    const parts = String(name).split(' ').filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

// ── Adapta el item real de la API al shape que usa el componente ─────────────
function adaptItem(raw, projectId) {
    if (!raw) return null;
    return {
        id:          raw.id_work_item,
        title:       raw.title        || '(sin título)',
        description: raw.description  || '',
        type:        raw.type         || 'task',
        status:      raw.status       || 'todo',
        storyPoints: raw.story_points ?? 0,
        assignee:    raw.assignee?.full_name || raw.assignee?.username || 'Sin asignar',
        assigneeId:  raw.assignee_id  || null,
        sprintLabel: raw.id_sprint ? `Sprint #${raw.id_sprint}` : `Proyecto #${projectId}`,
        targetDate:  raw.end_date     || null,
    };
}

function severityMeta(severity) {
    if (severity === 'critical') return { label: 'Crítico', color: '#B71C1C', bg: '#FDECEC' };
    if (severity === 'medium') return { label: 'Medio', color: '#8A5A00', bg: '#FFF3D9' };
    return { label: 'Bajo', color: '#2E7D32', bg: '#E7F6EA' };
}

function approvalStatusLabel(status) {
    if (status === 'approved') return 'Aprobado por PM';
    if (status === 'rejected') return 'Rechazado por PM';
    return 'Pendiente de aprobación';
}

function normalizeStatus(status) {
    if (status === 'In Progress' || status === 'in_progress') return 'in_progress';
    if (status === 'Done' || status === 'done') return 'done';
    return 'todo';
}

function statusLabel(status) {
    if (status === 'done') return 'Finalizado';
    if (status === 'in_progress') return 'En curso';
    return 'Por hacer';
}

export default function ViewerWorkItemDetailPage() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const projectName = location.state?.projectName || `Proyecto ${id}`;

    // Item real pasado desde ViewerProjectBacklogPage via location.state
    const rawItem = location.state?.item;
    const workItem = useMemo(() => adaptItem(rawItem, id), [rawItem, id]);
    const isMyItem = workItem?.assigneeId === user?.id;
    const [currentStatus, setCurrentStatus] = useState(normalizeStatus(workItem?.status));
    const [blockers, setBlockers] = useState([]);
    const [loadingBlockers, setLoadingBlockers] = useState(true);
    const [resolvingId, setResolvingId] = useState(null);
    const [form, setForm] = useState({
        kind: 'blocker',
        description: '',
        impact: '',
        severity: 'medium',
    });
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [, setTimeline] = useState([
        {
            id: 'created',
            title: 'Ítem de trabajo creado',
            detail: 'Agregado al backlog del Sprint 4 para el proyecto viewer.',
            time: 'Hoy · 08:10',
        },
    ]);

    // Cargar bloqueadores desde API
    useEffect(() => {
        if (!workItem?.id) {
            setLoadingBlockers(false);
            return;
        }

        async function loadBlockers() {
            try {
                const { res, data } = await api.get(`/blockers?work_item_id=${workItem.id}`);
                if (res.ok) {
                    setBlockers((data.blockers || []).filter(b => !b.resolved_at && !b.is_expired));
                } else {
                    console.error('Error cargando bloqueadores:', data.message);
                }
            } catch (err) {
                console.error('Error de conexión al cargar bloqueadores:', err);
            } finally {
                setLoadingBlockers(false);
            }
        }

        loadBlockers();
    }, [workItem?.id]);


    if (!workItem) {
        return (
            <div className="vwid-page">
                <div className="vwid-empty-shell">
                    <h1 className="vwid-title">Ítem no encontrado</h1>
                    <button className="vwid-secondary-btn" onClick={() => navigate(`/projects/${id}/backlog`, { state: { projectName } })}>
                        Volver al backlog
                    </button>
                </div>
            </div>
        );
    }

    const typeLabelMap = {
        user_story: 'Historia',
        task: 'Tarea',
        bug: 'Bug',
    };

    function handleSubmit(event) {
        event.preventDefault();

        const nextErrors = {};
        if (form.description.trim().length < 10)
            nextErrors.description = 'La descripción debe tener al menos 10 caracteres.';
        if (form.impact.trim().length < 10)
            nextErrors.impact = 'El impacto debe tener al menos 10 caracteres.';

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }

        submitBlocker();
    }

    async function submitBlocker() {
        setSubmitting(true);
        try {
            const { res, data } = await api.post('/blockers', {
                id_work_item: workItem.id,
                id_project: parseInt(id),
                kind: form.kind,
                severity: form.severity,
                description: form.description.trim(),
                impact: form.impact.trim(),
            });

            if (res.ok) {
                // Agregar el nuevo bloqueador a la lista
                setBlockers(current => [data.blocker, ...current]);

                // Actualizar timeline
                setTimeline((current) => [
                    {
                        id: `timeline-${Date.now()}`,
                        title: `${form.kind === 'implication' ? 'Implicación' : 'Bloqueador'} registrado`,
                        detail: `${form.description.trim()} · ${severityMeta(form.severity).label} (${approvalStatusLabel('pending')})`,
                        time: new Date().toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    },
                    ...current,
                ]);

                // Limpiar formulario
                setForm({ kind: 'blocker', description: '', impact: '', severity: 'medium' });
                setErrors({});
            } else if (data.errors && data.errors.length > 0) {
                const fieldErrors = {};
                data.errors.forEach(({ field, message }) => { fieldErrors[field] = message; });
                setErrors(fieldErrors);
            } else {
                setErrors({ submit: data.message || 'Error creando el bloqueador' });
            }
        } catch (error) {
            setErrors({ submit: 'Error de conexión' });
            console.error('Error enviando bloqueador:', error);
        } finally {
            setSubmitting(false);
        }
    }

    async function handleResolveBlocker(blockerId) {
        setResolvingId(blockerId);
        try {
            const { res, data } = await api.patch(`/blockers/${blockerId}/resolve`, {});
            if (res.ok) {
                setBlockers(prev => prev.filter(b => b.id_blocker !== blockerId));
            } else {
                console.error('Error finalizando bloqueador:', data.message);
            }
        } catch (err) {
            console.error('Error de conexión:', err);
        } finally {
            setResolvingId(null);
        }
    }

    return (
        <div className="vwid-page">
            <div className="vwid-top-bar">
                <div className="vwid-breadcrumb">
                    <span className="vwid-crumb-accent">{projectName}</span>
                    <span>/</span>
                    <span className="vwid-crumb-accent">{workItem.sprintLabel}</span>
                    <span>/</span>
                    <span>Detalle del ítem</span>
                </div>
                <button className="vwid-secondary-btn" onClick={() => navigate(`/projects/${id}/backlog`, { state: { projectName } })}>
                    ← Volver al backlog
                </button>
            </div>

            <div className="vwid-content-wrap">
                <div className="vwid-header-card">
                    <div className="vwid-header-left">
                        <span className="vwid-kicker">{typeLabelMap[workItem.type] || workItem.type}</span>
                        <h1 className="vwid-title">{workItem.title}</h1>
                        <p className="vwid-description">{workItem.description}</p>
                    </div>

                </div>

                <div className="vwid-grid">
                    <section className="vwid-main-column">
                        <div className="vwid-card">
                            <div className="vwid-card-head">
                                <div>
                                    <div className="vwid-card-label">Estado</div>
                                    <div className="vwid-card-note">Controles visuales solamente, aún sin persistencia en backend.</div>
                                </div>
                                <div className="vwid-pill-row">
                                    {['todo', 'in_progress', 'done'].map((value) => (
                                        <button
                                            key={value}
                                            className={`vwid-status-btn ${currentStatus === value ? 'is-active' : ''}`}
                                            onClick={() => {
                                                setCurrentStatus(value);
                                                setTimeline((current) => [
                                                    {
                                                        id: `status-${Date.now()}`,
                                                        title: 'Estado cambiado localmente',
                                                        detail: `Ahora está en ${statusLabel(value)}`,
                                                        time: new Date().toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                                                    },
                                                    ...current,
                                                ]);
                                            }}
                                        >
                                            {statusLabel(value)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="vwid-info-grid">
                                <div>
                                    <span className="vwid-info-label">Responsable</span>
                                    <div className="vwid-assignee-wrap">
                                        <span className="vwid-avatar">{initialsFromName(workItem.assignee).toUpperCase()}</span>
                                        <span>{workItem.assignee}</span>
                                    </div>
                                </div>
                                <div>
                                    <span className="vwid-info-label">Puntos de historia</span>
                                    <div className="vwid-info-value">{workItem.storyPoints} SP</div>
                                </div>
                                <div>
                                    <span className="vwid-info-label">Fecha objetivo</span>
                                    <div className="vwid-info-value vwid-warning">{workItem.targetDate}</div>
                                </div>
                                <div>
                                    <span className="vwid-info-label">Vínculo al proyecto</span>
                                    <div className="vwid-info-value">Ítem #{workItem.id} · Proyecto #{id}</div>
                                </div>
                            </div>
                        </div>

                        {isMyItem && (
                            <div className="vwid-card vwid-alert-card">
                                <div className="vwid-card-head vwid-card-head-tight">
                                    <div>
                                        <div className="vwid-card-label">Bloqueadores e implicaciones</div>
                                        <div className="vwid-card-note">Registrados y aprobados por el PM</div>
                                    </div>
                                    <span className="vwid-scope-pill">{blockers.length} registros</span>
                                </div>

                                {loadingBlockers ? (
                                    <div className="vwid-empty-state">Cargando bloqueadores...</div>
                                ) : blockers.length > 0 ? (
                                    <div style={{ marginBottom: 24 }}>
                                        {blockers.map((blocker) => {
                                            const blockerSeverity = severityMeta(blocker.severity);
                                            const approvalLabel = approvalStatusLabel(blocker.approval_status);
                                            const statusColor = blocker.approval_status === 'pending' ? '#8A5A00' :
                                                blocker.approval_status === 'approved' ? '#2E7D32' : '#B71C1C';
                                            const statusBg = blocker.approval_status === 'pending' ? '#FFF3D9' :
                                                blocker.approval_status === 'approved' ? '#E7F6EA' : '#FDECEC';

                                            const isResolved = !!blocker.resolved_at;
                                            return (
                                                <div key={blocker.id_blocker} className="vwid-active-blocker" data-severity={blocker.severity} style={{ marginBottom: 12, opacity: isResolved ? 0.7 : 1 }}>
                                                    <div className="vwid-active-blocker-head">
                                                        <span className="vwid-active-badge">{blocker.kind === 'implication' ? 'Implicación' : 'Bloqueador'}</span>
                                                        <span className="vwid-date">{fmtMty(blocker.created_at)}</span>
                                                    </div>
                                                    <div className="vwid-blocker-title">{blocker.description}</div>
                                                    <div className="vwid-blocker-impact">{blocker.impact}</div>
                                                    <div className="vwid-blocker-footer">
                                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                                            <span className="vwid-meta-chip" style={{ color: blockerSeverity.color, backgroundColor: blockerSeverity.bg }}>{blockerSeverity.label}</span>
                                                            <span className="vwid-meta-chip" style={{ color: statusColor, backgroundColor: statusBg }}>
                                                                {isResolved ? 'Finalizado' : approvalLabel}
                                                            </span>
                                                            {blocker.approval_status === 'approved' && blocker.deadline && !isResolved && (
                                                                <span style={{ fontSize: 11, color: '#8A5A00' }}>
                                                                    Límite: {new Date(blocker.deadline).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                </span>
                                                            )}
                                                            {isResolved && (
                                                                <span style={{ fontSize: 11, color: '#2E7D32' }}>
                                                                    Resuelto: {new Date(blocker.resolved_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                </span>
                                                            )}
                                                            {blocker.approval_status === 'rejected' && blocker.rejected_reason && (
                                                                <span style={{ fontSize: 11, color: '#B71C1C' }}>Razón: {blocker.rejected_reason}</span>
                                                            )}
                                                        </div>
                                                        {blocker.approval_status === 'approved' && !isResolved && (
                                                            <button
                                                                className="vwid-secondary-btn"
                                                                style={{ fontSize: 11, height: 28, padding: '0 12px', borderColor: '#3C9A57', color: '#3C9A57' }}
                                                                disabled={resolvingId === blocker.id_blocker}
                                                                onClick={() => handleResolveBlocker(blocker.id_blocker)}
                                                            >
                                                                {resolvingId === blocker.id_blocker ? 'Finalizando...' : 'Finalizar'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="vwid-empty-state">No hay bloqueadores registrados. Usa el formulario de abajo para registrar uno.</div>
                                )}

                                <form className="vwid-form" onSubmit={handleSubmit}>
                                    {errors.submit && (
                                        <div style={{
                                            padding: '10px 12px',
                                            marginBottom: 12,
                                            borderRadius: 4,
                                            backgroundColor: '#FDECEC',
                                            border: '1px solid #FFCDD2',
                                            color: '#B71C1C',
                                            fontSize: 12,
                                        }}>
                                            {errors.submit}
                                        </div>
                                    )}
                                    <div className="vwid-form-row">
                                        <div className="vwid-field">
                                            <label>Tipo</label>
                                            <select 
                                                value={form.kind} 
                                                onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))}
                                                disabled={submitting}
                                            >
                                                <option value="blocker">Bloqueador</option>
                                                <option value="implication">Implicación</option>
                                            </select>
                                        </div>
                                        <div className="vwid-field">
                                            <label>Severidad</label>
                                            <select 
                                                value={form.severity} 
                                                onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value }))}
                                                disabled={submitting}
                                            >
                                                <option value="low">Bajo</option>
                                                <option value="medium">Medio</option>
                                                <option value="critical">Crítico</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="vwid-field">
                                        <label>Descripción del bloqueador *</label>
                                        <textarea
                                            rows="3"
                                            value={form.description}
                                            onChange={(event) => {
                                                setForm((current) => ({ ...current, description: event.target.value }));
                                                if (errors.description) setErrors((current) => ({ ...current, description: '' }));
                                            }}
                                            placeholder="¿Qué está bloqueando el avance? Sé específico."
                                            disabled={submitting}
                                            style={errors.description ? { borderColor: '#D92F47' } : {}}
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            {errors.description ? <span className="vwid-error-text">{errors.description}</span> : <span />}
                                            <span style={{ fontSize: 10, color: form.description.trim().length < 10 ? '#D92F47' : '#AAA' }}>
                                                {form.description.trim().length}/10 mín
                                            </span>
                                        </div>
                                    </div>

                                    <div className="vwid-field">
                                        <label>Implicación / Impacto *</label>
                                        <textarea
                                            rows="3"
                                            value={form.impact}
                                            onChange={(event) => {
                                                setForm((current) => ({ ...current, impact: event.target.value }));
                                                if (errors.impact) setErrors((current) => ({ ...current, impact: '' }));
                                            }}
                                            placeholder="¿Qué pasará si esto no se resuelve?"
                                            disabled={submitting}
                                            style={errors.impact ? { borderColor: '#D92F47' } : {}}
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            {errors.impact ? <span className="vwid-error-text">{errors.impact}</span> : <span />}
                                            <span style={{ fontSize: 10, color: form.impact.trim().length < 10 ? '#D92F47' : '#AAA' }}>
                                                {form.impact.trim().length}/10 mín
                                            </span>
                                        </div>
                                    </div>

                                    <div className="vwid-form-actions">
                                        <button 
                                            type="button" 
                                            className="vwid-secondary-btn" 
                                            onClick={() => setForm({ kind: 'blocker', description: '', impact: '', severity: 'medium' })}
                                            disabled={submitting}
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            type="submit" 
                                            className="vwid-primary-btn"
                                            disabled={submitting}
                                        >
                                            {submitting ? 'Registrando...' : 'Registrar bloqueador'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                    </section>

                    <aside className="vwid-side-column">
                        <div className="vwid-summary-card">
                            <div className="vwid-card-label">Detalles</div>
                            <div className="vwid-summary-row"><span>Tipo</span><strong>{workItem.type}</strong></div>
                            <div className="vwid-summary-row"><span>Estado</span><strong>{statusLabel(currentStatus)}</strong></div>
                            <div className="vwid-summary-row"><span>Puntos de historia</span><strong>{workItem.storyPoints} SP</strong></div>
                            <div className="vwid-summary-row"><span>Responsable</span><strong>{workItem.assignee}</strong></div>
                            <div className="vwid-summary-row"><span>Sprint</span><strong>{workItem.sprintLabel}</strong></div>
                            <div className="vwid-summary-row"><span>Objetivo</span><strong>{workItem.targetDate}</strong></div>
                        </div>

                    </aside>
                </div>
            </div>
        </div>
    );
}