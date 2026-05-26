import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../../config/api';
import ws from '../../config/ws';
import { useAuthContext } from '../../shared/context/AuthContext';

const LEVEL_META = {
    high:   { label: 'Alto',   color: '#B71C1C' },
    medium: { label: 'Medio',  color: '#8A5A00' },
    low:    { label: 'Bajo',   color: '#2E7D32' },
};

const STATUS_META = {
    active:    { label: 'Activo',     color: '#2E7D32' },
    closed:    { label: 'Cerrado',    color: '#777'    },
    discarded: { label: 'Descartado', color: '#999'    },
};

function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime())
        ? value
        : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProjectRisksPage() {
    const { id }      = useParams();
    const location    = useLocation();
    const navigate    = useNavigate();
    const { user }    = useAuthContext();
    const projectName = location.state?.projectName || `Proyecto ${id}`;
    const isPM        = user?.role === 'pm' || user?.role === 'admin';

    const [risks,      setRisks]      = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [message,    setMessage]    = useState({ text: '', type: '' });
    const [showForm,   setShowForm]   = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [closingId,  setClosingId]  = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [form,       setForm]       = useState({ title: '', description: '', level: 'medium' });

    const loadRisks = useCallback(async () => {
        try {
            const { res, data } = await api.get(`/risks?project_id=${id}`);
            if (res.ok) setRisks(data.risks || []);
            else setMessage({ text: data.message || 'Error cargando riesgos', type: 'error' });
        } catch {
            setMessage({ text: 'Error de conexión', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { loadRisks(); }, [loadRisks]);

    function broadcastRiskUpdate() {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'risk_update', id_project: Number(id) }));
        }
    }

    async function handleCreate(e) {
        e.preventDefault();
        if (!form.title.trim()) {
            setMessage({ text: 'El título es obligatorio', type: 'error' });
            return;
        }
        setMessage({ text: '', type: '' });
        setSubmitting(true);
        try {
            const { res, data } = await api.post('/risks', {
                id_project:  Number(id),
                title:       form.title.trim(),
                description: form.description.trim() || undefined,
                level:       form.level,
            });
            if (res.ok) {
                setMessage({ text: 'Riesgo registrado correctamente', type: 'success' });
                setForm({ title: '', description: '', level: 'medium' });
                setShowForm(false);
                broadcastRiskUpdate();
                await loadRisks();
            } else {
                setMessage({ text: data.message || 'Error registrando riesgo', type: 'error' });
            }
        } catch {
            setMessage({ text: 'Error de conexión', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDelete(riskId) {
        setMessage({ text: '', type: '' });
        setDeletingId(riskId);
        try {
            const { res, data } = await api.delete(`/risks/${riskId}`);
            if (res.ok) {
                broadcastRiskUpdate();
                await loadRisks();
            } else {
                setMessage({ text: data.message || 'Error eliminando riesgo', type: 'error' });
            }
        } catch {
            setMessage({ text: 'Error de conexión', type: 'error' });
        } finally {
            setDeletingId(null);
        }
    }

    async function handleStatusChange(riskId, newStatus) {
        setMessage({ text: '', type: '' });
        setClosingId(riskId);
        try {
            const { res, data } = await api.patch(`/risks/${riskId}/status`, { status: newStatus });
            if (res.ok) {
                const label = newStatus === 'closed' ? 'cerrado' : 'descartado';
                setMessage({ text: `Riesgo ${label} correctamente`, type: 'success' });
                broadcastRiskUpdate();
                await loadRisks();
            } else {
                setMessage({ text: data.message || 'Error actualizando riesgo', type: 'error' });
            }
        } catch {
            setMessage({ text: 'Error de conexión', type: 'error' });
        } finally {
            setClosingId(null);
        }
    }

    return (
        <div style={s.page}>
            <div style={s.topBar}>
                <div style={s.breadcrumb}>
                    <button style={s.crumbBtn} onClick={() => navigate('/projects')}>Proyectos</button>
                    <span style={s.sep}>/</span>
                    <button style={s.crumbBtn} onClick={() => navigate(`/projects/${id}/view`, { state: { projectName } })}>
                        {projectName}
                    </button>
                    <span style={s.sep}>/</span>
                    <span style={s.crumbCurrent}>Riesgos</span>
                </div>
                <button style={s.backBtn} onClick={() => navigate(`/projects/${id}/view`, { state: { projectName } })}>
                    ← Volver al proyecto
                </button>
            </div>

            <div style={s.body}>
                <div style={s.headerCard}>
                    <div>
                        <div style={s.kicker}>Gestión de riesgos</div>
                        <h1 style={s.title}>Riesgos del proyecto</h1>
                        <p style={s.subtitle}>Registra y gestiona los riesgos activos. Los riesgos activos se reflejan en el dashboard consolidado.</p>
                    </div>
                    {isPM && (
                        <button
                            style={s.btnPrimary}
                            onClick={() => { setShowForm(v => !v); setMessage({ text: '', type: '' }); }}
                        >
                            {showForm ? 'Cancelar' : '+ Nuevo riesgo'}
                        </button>
                    )}
                </div>

                {showForm && isPM && (
                    <form onSubmit={handleCreate} style={s.form}>
                        <div style={s.formRow}>
                            <div style={{ flex: 2 }}>
                                <label style={s.formLabel}>Título *</label>
                                <input
                                    style={s.input}
                                    type="text"
                                    placeholder="Ej. Dependencia de proveedor externo sin contrato"
                                    maxLength={200}
                                    value={form.title}
                                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={s.formLabel}>Nivel</label>
                                <select
                                    style={s.select}
                                    value={form.level}
                                    onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                                >
                                    <option value="low">Bajo</option>
                                    <option value="medium">Medio</option>
                                    <option value="high">Alto</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label style={s.formLabel}>Descripción (opcional)</label>
                            <textarea
                                style={s.textarea}
                                rows={3}
                                placeholder="Describe el riesgo y su impacto potencial..."
                                maxLength={1000}
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                            <button type="button" style={s.btnSecondary} onClick={() => setShowForm(false)}>Cancelar</button>
                            <button type="submit" style={s.btnPrimary} disabled={submitting}>
                                {submitting ? 'Registrando...' : 'Registrar riesgo'}
                            </button>
                        </div>
                    </form>
                )}

                {message.text && (
                    <div style={message.type === 'error' ? s.errorBox : s.successBox}>
                        {message.text}
                    </div>
                )}

                {loading ? (
                    <div style={s.emptyState}>Cargando riesgos...</div>
                ) : risks.length === 0 ? (
                    <div style={s.emptyState}>No hay riesgos registrados en este proyecto.</div>
                ) : (
                    <div style={s.list}>
                        {risks.map(risk => {
                            const lm = LEVEL_META[risk.level]  || LEVEL_META.low;
                            const sm = STATUS_META[risk.status] || STATUS_META.active;
                            return (
                                <article key={risk.id_risk} style={s.card}>
                                    <div style={s.cardTop}>
                                        <div>
                                            <div style={s.cardLabel}>Riesgo #{risk.id_risk}</div>
                                            <div style={s.cardTitle}>{risk.title}</div>
                                        </div>
                                        <div style={s.chips}>
                                            <span style={{ color: lm.color, fontWeight: 700, fontSize: 12 }}>{lm.label}</span>
                                            <span style={s.chipSep}>·</span>
                                            <span style={{ color: sm.color, fontWeight: 700, fontSize: 12 }}>{sm.label}</span>
                                        </div>
                                    </div>

                                    {risk.description && (
                                        <p style={s.cardBody}>{risk.description}</p>
                                    )}

                                    <div style={s.cardMeta}>
                                        <span>Registrado: {formatDate(risk.created_at)}</span>
                                        {risk.closed_at && <span>Cerrado: {formatDate(risk.closed_at)}</span>}
                                    </div>

                                    {isPM && (
                                        <div style={s.actions}>
                                            {risk.status === 'active' && (
                                                <>
                                                    <button
                                                        style={s.closeBtn}
                                                        disabled={closingId === risk.id_risk}
                                                        onClick={() => handleStatusChange(risk.id_risk, 'closed')}
                                                    >
                                                        {closingId === risk.id_risk ? '...' : 'Cerrar'}
                                                    </button>
                                                    <button
                                                        style={s.discardBtn}
                                                        disabled={closingId === risk.id_risk}
                                                        onClick={() => handleStatusChange(risk.id_risk, 'discarded')}
                                                    >
                                                        Descartar
                                                    </button>
                                                </>
                                            )}
                                            {risk.status !== 'active' && (
                                                <button
                                                    style={s.deleteBtn}
                                                    disabled={deletingId === risk.id_risk}
                                                    onClick={() => handleDelete(risk.id_risk)}
                                                >
                                                    {deletingId === risk.id_risk ? '...' : 'Eliminar'}
                                                </button>
                                            )}
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

const s = {
    page:        { minHeight: '100vh', backgroundColor: '#F5F5F4', fontFamily: "'DM Sans','Helvetica Neue',sans-serif", color: '#1A1A1A' },
    topBar:      { backgroundColor: '#FFF', borderBottom: '1px solid #E5E5E3', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    breadcrumb:  { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#888', flexWrap: 'wrap' },
    crumbBtn:    { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#888', padding: 0 },
    sep:         { color: '#CCC' },
    crumbCurrent:{ color: '#1A1A1A', fontWeight: 500, fontSize: 13 },
    backBtn:     { height: 36, padding: '0 16px', backgroundColor: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    body:        { padding: 32 },
    headerCard:  { backgroundColor: '#FFF', border: '1px solid #E7E4DD', borderRadius: 8, padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20 },
    kicker:      { fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8A8A', fontWeight: 700, marginBottom: 8 },
    title:       { fontSize: 26, lineHeight: 1.1, margin: 0, marginBottom: 8 },
    subtitle:    { fontSize: 13, color: '#6C6C6C', lineHeight: 1.5, maxWidth: 600, margin: 0 },
    btnPrimary:  { height: 36, padding: '0 16px', backgroundColor: '#CC0000', color: '#FFF', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
    btnSecondary:{ height: 36, padding: '0 16px', backgroundColor: 'transparent', color: '#555', border: '1px solid #D0D0CE', borderRadius: 4, fontSize: 13, cursor: 'pointer' },
    form:        { backgroundColor: '#FFF', border: '1px solid #E7E4DD', borderRadius: 8, padding: 20, marginBottom: 16, display: 'grid', gap: 14 },
    formRow:     { display: 'flex', gap: 12 },
    formLabel:   { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#636363', display: 'block', marginBottom: 6 },
    input:       { width: '100%', height: 36, border: '1px solid #DDD7CB', borderRadius: 5, padding: '0 10px', fontSize: 13, backgroundColor: '#FFF', fontFamily: 'inherit', boxSizing: 'border-box' },
    select:      { width: '100%', height: 36, border: '1px solid #DDD7CB', borderRadius: 5, padding: '0 10px', fontSize: 13, backgroundColor: '#FFF', fontFamily: 'inherit', boxSizing: 'border-box' },
    textarea:    { width: '100%', border: '1px solid #DDD7CB', borderRadius: 5, padding: '8px 10px', fontSize: 13, backgroundColor: '#FFF', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
    errorBox:    { padding: '10px 14px', marginBottom: 14, borderRadius: 4, fontSize: 13, backgroundColor: '#FFF5F5', border: '1px solid #FFCDD2', color: '#B71C1C' },
    successBox:  { padding: '10px 14px', marginBottom: 14, borderRadius: 4, fontSize: 13, backgroundColor: '#F1F8E9', border: '1px solid #C5E1A5', color: '#33691E' },
    emptyState:  { padding: 24, backgroundColor: '#FFF', border: '1px solid #E7E4DD', borderRadius: 8, color: '#7B7B7B', fontSize: 13 },
    list:        { display: 'grid', gap: 12 },
    card:        { backgroundColor: '#FFF', border: '1px solid #E7E4DD', borderRadius: 8, padding: 18 },
    cardTop:     { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 10 },
    cardLabel:   { fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8A8A8A', fontWeight: 700, marginBottom: 4 },
    cardTitle:   { fontSize: 16, fontWeight: 700, color: '#2C2C2C', lineHeight: 1.35 },
    chips:       { display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' },
    chipSep:     { color: '#CCC', fontSize: 12 },
    cardBody:    { fontSize: 13, color: '#6C6C6C', lineHeight: 1.55, marginBottom: 10 },
    cardMeta:    { fontSize: 11, color: '#AAA', display: 'flex', gap: 16, marginBottom: 12 },
    actions:     { display: 'flex', gap: 10, justifyContent: 'flex-end' },
    closeBtn:    { height: 32, padding: '0 14px', border: 'none', borderRadius: 4, backgroundColor: '#3C9A57', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
    discardBtn:  { height: 32, padding: '0 14px', border: '1px solid #DEDAD0', borderRadius: 4, backgroundColor: '#FFF', color: '#666', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
    deleteBtn:   { height: 32, padding: '0 14px', border: '1px solid #FFCDD2', borderRadius: 4, backgroundColor: '#FFF', color: '#B71C1C', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
};
