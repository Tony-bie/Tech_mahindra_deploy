import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../shared/context/AuthContext';
import api from '../../config/api';

// ─── Constantes (deben coincidir con costs.validation.js) ────────────────────
const VALID_CATEGORIES = [
    'Infrastructure', 'Software', 'Consulting',
    'Training', 'Hardware', 'Travel', 'Other',
];

const STATUS_CONFIG = {
    pending:  { label: 'Pendiente', bg: '#FFF8E1', color: '#E65100', border: '#FFE082' },
    approved: { label: 'Aprobado',  bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' },
    rejected: { label: 'Rechazado', bg: '#FFEBEE', color: '#C62828', border: '#EF9A9A' },
};

const CATEGORY_COLORS = {
    Infrastructure: '#E3F2FD', Software: '#F3E5F5', Consulting: '#E8F5E9',
    Training: '#FFF9C4', Hardware: '#FCE4EC', Travel: '#E0F7FA', Other: '#F5F5F5',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = n => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
const fmtDate = d => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return '—';
    return dt.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
};

function KpiCard({ label, value, sub, accent }) {
    return (
        <div style={s.kpi}>
            <div style={s.kpiLabel}>{label}</div>
            <div style={{ ...s.kpiValue, color: accent || '#1A1A1A' }}>{value}</div>
            {sub && <div style={s.kpiSub}>{sub}</div>}
        </div>
    );
}

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    return (
        <span style={{
            padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
            backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
        }}>
            {cfg.label}
        </span>
    );
}

function CategoryBadge({ category }) {
    return (
        <span style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
            backgroundColor: CATEGORY_COLORS[category] || '#F5F5F5', color: '#444',
        }}>
            {category}
        </span>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CostsPage() {
    const { id }        = useParams();
    const location      = useLocation();
    const navigate      = useNavigate();
    const { user }      = useAuthContext();

    const isPM      = user?.role === 'pm' || user?.role === 'admin';
    const projectName = location.state?.projectName || `Proyecto ${id}`;

    // ── Estado ────────────────────────────────────────────────────────────────
    const [spends,   setSpends]   = useState([]);
    const [summary,  setSummary]  = useState({ estimated_budget: 0, approved_cost: 0, pending_cost: 0, remaining_budget: 0 });
    const [tab,      setTab]      = useState('pending');
    const [loading,  setLoading]  = useState(true);
    const [msg,      setMsg]      = useState({ text: '', type: '' });

    // Formulario submission
    const [form, setForm] = useState({
        category: '', amount: '', description: '', spend_date: '',
    });
    const [submitting, setSubmitting] = useState(false);

    // Presupuesto (edición para PM)
    const [editBudget,    setEditBudget]    = useState(false);
    const [budgetInput,   setBudgetInput]   = useState('');
    const [savingBudget,  setSavingBudget]  = useState(false);

    // ── Carga de datos ────────────────────────────────────────────────────────
    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { res, data } = await api.get(`/costs?project_id=${id}`);
            if (res.ok) {
                setSpends(data.spends || []);
                setSummary(data.summary || {});
                setBudgetInput(String(data.summary?.estimated_budget || 0));
            } else {
                showMsg(data.message || 'Error cargando costos', 'error');
            }
        } catch {
            showMsg('Error de conexión', 'error');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { load(); }, [load]);

    function showMsg(text, type = 'success') {
        setMsg({ text, type });
        setTimeout(() => setMsg({ text: '', type: '' }), 5000);
    }

    // ── Filtro por tab ────────────────────────────────────────────────────────
    const filtered = tab === 'all'
        ? spends
        : spends.filter(s => s.status === tab);

    // ── Acciones PM: aprobar / rechazar ───────────────────────────────────────
    async function decide(spendId, decision) {
        try {
            const { res, data } = await api.patch(`/costs/${spendId}/decision`, { decision });
            if (res.ok) {
                showMsg(decision === 'approved' ? 'Costo aprobado ✓' : 'Costo rechazado');
                load();
            } else {
                showMsg(data.message || 'Error procesando decisión', 'error');
            }
        } catch {
            showMsg('Error de conexión', 'error');
        }
    }

    async function approveAll() {
        const pending = spends.filter(s => s.status === 'pending');
        for (const s of pending) await decide(s.id_spend, 'approved');
    }

    // ── Acción: enviar costo (HU-12) ──────────────────────────────────────────
    async function handleSubmit() {
        if (!form.category)           { showMsg('Selecciona una categoría (CA-01)', 'error'); return; }
        if (!form.amount || Number(form.amount) <= 0) { showMsg('El monto debe ser mayor a cero (CA-02)', 'error'); return; }
        if (!form.description.trim()) { showMsg('La descripción es obligatoria', 'error'); return; }
        if (!form.spend_date)         { showMsg('La fecha es obligatoria', 'error'); return; }

        setSubmitting(true);
        try {
            const { res, data } = await api.post('/costs', {
                id_project:  parseInt(id),
                category:    form.category,
                amount:      Number(form.amount),
                description: form.description,
                spend_date:  form.spend_date,
            });
            if (res.ok) {
                showMsg('Costo registrado. Pendiente de aprobación del PM. (CA-03)');
                setForm({ category: '', amount: '', description: '', spend_date: '' });
                setTab('pending');
                load();
            } else {
                showMsg(data.message || 'Error registrando costo', 'error');
            }
        } catch {
            showMsg('Error de conexión', 'error');
        } finally {
            setSubmitting(false);
        }
    }

    // ── Guardar presupuesto estimado ──────────────────────────────────────────
    async function handleSaveBudget() {
        if (!budgetInput || Number(budgetInput) <= 0) {
            showMsg('El presupuesto debe ser mayor a cero', 'error'); return;
        }
        setSavingBudget(true);
        try {
            const { res, data } = await api.patch(`/costs/budget/${id}`, { total_cost: Number(budgetInput) });
            if (res.ok) {
                showMsg('Presupuesto actualizado');
                setEditBudget(false);
                load();
            } else {
                showMsg(data.message || 'Error actualizando presupuesto', 'error');
            }
        } catch {
            showMsg('Error de conexión', 'error');
        } finally {
            setSavingBudget(false);
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    const pendingCount = spends.filter(s => s.status === 'pending').length;
    const usedPct = summary.estimated_budget > 0
        ? Math.min(100, Math.round((summary.approved_cost / summary.estimated_budget) * 100))
        : 0;

    return (
        <div style={s.page}>

            {/* ── Top bar ──────────────────────────────────────────────────── */}
            <div style={s.topBar}>
                <div style={s.breadcrumb}>
                    <span style={s.crumb} onClick={() => navigate('/projects')}>Proyectos</span>
                    <span style={s.sep}>/</span>
                    <span style={s.crumb} onClick={() => navigate(`/projects/${id}/view`, { state: { projectName } })}>
                        {projectName}
                    </span>
                    <span style={s.sep}>/</span>
                    <span style={{ color: '#1A1A1A', fontWeight: 500 }}>Costos</span>
                </div>
            </div>

            <div style={s.body}>
                <h1 style={s.title}>Gestión de costos</h1>

                {/* ── Mensaje ──────────────────────────────────────────────── */}
                {msg.text && (
                    <div style={msg.type === 'error' ? s.msgErr : s.msgOk}>{msg.text}</div>
                )}

                {/* ── KPI Cards ────────────────────────────────────────────── */}
                <div style={s.kpiRow}>
                    <div style={s.kpi}>
                        <div style={s.kpiLabel}>PRESUPUESTO ESTIMADO</div>
                        {isPM && editBudget ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                                <input
                                    style={{ ...s.input, width: 130, fontSize: 16 }}
                                    type="number" min="1" value={budgetInput}
                                    onChange={e => setBudgetInput(e.target.value)}
                                />
                                <button style={s.btnSm} onClick={handleSaveBudget} disabled={savingBudget}>
                                    {savingBudget ? '...' : '✓'}
                                </button>
                                <button style={{ ...s.btnSm, backgroundColor: '#eee', color: '#555' }}
                                    onClick={() => { setEditBudget(false); setBudgetInput(String(summary.estimated_budget)); }}>
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                                {isPM && (
                                    <button style={s.editBtn} onClick={() => setEditBudget(true)}>✎</button>
                                )}
                                <div style={{ ...s.kpiValue, color: '#1A1A1A' }}>{fmt(summary.estimated_budget)}</div>
                            </div>
                        )}
                        <div style={s.kpiSub}>Presupuesto total del proyecto</div>
                    </div>

                    <KpiCard
                        label="COSTO APROBADO"
                        value={fmt(summary.approved_cost)}
                        sub={`${usedPct}% del presupuesto usado`}
                        accent="#E65100"
                    />
                    <KpiCard
                        label="PENDIENTE DE APROBACIÓN"
                        value={fmt(summary.pending_cost)}
                        sub={`${pendingCount} ítem${pendingCount !== 1 ? 's' : ''} en espera del PM`}
                        accent="#E07A00"
                    />
                    <KpiCard
                        label="PRESUPUESTO RESTANTE"
                        value={fmt(summary.remaining_budget)}
                        sub={`${100 - usedPct}% disponible`}
                        accent="#2E7D32"
                    />
                </div>

                {/* ── Tabs ─────────────────────────────────────────────────── */}
                <div style={s.tabs}>
                    {[
                        { key: 'pending',  label: `Pendientes${pendingCount ? ` (${pendingCount})` : ''}` },
                        { key: 'approved', label: 'Aprobados' },
                        { key: 'rejected', label: 'Rechazados' },
                        { key: 'all',      label: 'Todos' },
                    ].map(t => (
                        <button
                            key={t.key}
                            style={{ ...s.tab, ...(tab === t.key ? s.tabActive : {}) }}
                            onClick={() => setTab(t.key)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── Tabla de costos ───────────────────────────────────────── */}
                {isPM && tab === 'pending' && pendingCount > 0 && (
                    <div style={s.card}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div>
                                <div style={s.sectionTitle}>Costos pendientes de aprobación</div>
                            </div>
                            {pendingCount > 1 && (
                                <button style={s.btnApproveAll} onClick={approveAll}>
                                    Aprobar todos
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <div style={s.empty}>Cargando...</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={s.table}>
                                    <thead>
                                        <tr>
                                            {['CATEGORÍA','DESCRIPCIÓN','MONTO','ENVIADO POR','FECHA','ESTADO','ACCIONES'].map(h => (
                                                <th key={h} style={h === 'MONTO' ? s.thNum : s.th}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(spend => (
                                            <tr key={spend.id_spend} style={s.tr}>
                                                <td style={s.td}><CategoryBadge category={spend.category || spend.type} /></td>
                                                <td style={{ ...s.td, maxWidth: 260 }}>{spend.description}</td>
                                                <td style={s.tdNum}>{fmt(spend.amount)}</td>
                                                <td style={s.td}>{spend.submitter?.full_name || spend.submitter?.username || `User #${spend.submitted_by}`}</td>
                                                <td style={s.td}>{fmtDate(spend.spend_date || spend.created_at)}</td>
                                                <td style={s.td}><StatusBadge status={spend.status} /></td>
                                                <td style={s.td}>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button style={s.btnApprove} onClick={() => decide(spend.id_spend, 'approved')}>
                                                            Aprobar
                                                        </button>
                                                        <button style={s.btnReject} onClick={() => decide(spend.id_spend, 'rejected')}>
                                                            Rechazar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div style={{ marginTop: 12, fontSize: 12, color: '#E65100' }}>
                            ⚠ Aprobar un costo actualiza el acumulado en tiempo real
                        </div>
                    </div>
                )}

                {/* Tabla para otros tabs */}
                {(tab !== 'pending' || !isPM) && (
                    <div style={s.card}>
                        <div style={s.sectionTitle}>
                            {tab === 'approved' ? 'Costos aprobados' : tab === 'rejected' ? 'Costos rechazados' : tab === 'all' ? 'Todos los costos' : 'Mis costos'}
                        </div>
                        {loading ? (
                            <div style={s.empty}>Cargando...</div>
                        ) : filtered.length === 0 ? (
                            <div style={s.empty}>No hay costos en esta categoría.</div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={s.table}>
                                    <thead>
                                        <tr>
                                            {['CATEGORÍA','DESCRIPCIÓN','MONTO','ENVIADO POR','FECHA','ESTADO'].map(h => (
                                                <th key={h} style={h === 'MONTO' ? s.thNum : s.th}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(spend => (
                                            <tr key={spend.id_spend} style={s.tr}>
                                                <td style={s.td}><CategoryBadge category={spend.category || spend.type} /></td>
                                                <td style={{ ...s.td, maxWidth: 260 }}>{spend.description}</td>
                                                <td style={s.tdNum}>{fmt(spend.amount)}</td>
                                                <td style={s.td}>{spend.submitter?.full_name || spend.submitter?.username || `User #${spend.submitted_by}`}</td>
                                                <td style={s.td}>{fmtDate(spend.spend_date || spend.created_at)}</td>
                                                <td style={s.td}><StatusBadge status={spend.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Formulario: Registrar costo (HU-12) ──────────────────── */}
                <div style={s.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div style={s.sectionTitle}>Registrar costo</div>
                    </div>

                    <div style={s.infoBox}>
                        Los costos registrados tendrán estado <strong>Pendiente</strong> hasta que el PM los apruebe.
                    </div>

                    <div style={s.formGrid}>
                        <div style={s.formGroup}>
                            <label style={s.label}>Categoría *</label>
                            <select style={s.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                <option value="">— Seleccionar categoría —</option>
                                {VALID_CATEGORIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div style={s.formGroup}>
                            <label style={s.label}>Monto (USD) *</label>
                            <input
                                style={s.input} type="number" min="0.01" step="0.01"
                                placeholder="0.00" value={form.amount}
                                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                            />
                        </div>

                        <div style={{ ...s.formGroup, gridColumn: '1 / -1' }}>
                            <label style={s.label}>Descripción *</label>
                            <input
                                style={s.input} type="text"
                                placeholder="¿Para qué es este costo? Sé específico."
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            />
                        </div>

                        <div style={s.formGroup}>
                            <label style={s.label}>Fecha *</label>
                            <input
                                style={s.input} type="date" value={form.spend_date}
                                onChange={e => setForm(f => ({ ...f, spend_date: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                        <button style={s.btnCancel} onClick={() => setForm({ category: '', amount: '', description: '', spend_date: '' })}>
                            Cancelar
                        </button>
                        <button style={s.btnSubmit} onClick={handleSubmit} disabled={submitting}>
                            {submitting ? 'Enviando...' : 'Enviar'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = {
    page:        { minHeight: '100vh', backgroundColor: '#F5F5F4', fontFamily: "'DM Sans','Helvetica Neue',sans-serif", color: '#1A1A1A' },
    topBar:      { backgroundColor: '#FFF', borderBottom: '1px solid #E5E5E3', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    breadcrumb:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 },
    crumb:       { color: '#888', cursor: 'pointer', fontSize: 13 },
    sep:         { color: '#CCC' },
    body:        { padding: '28px 32px', width: '100%', boxSizing: 'border-box' },
    title:       { fontSize: 24, fontWeight: 700, marginBottom: 20 },
    msgOk:       { padding: '10px 14px', backgroundColor: '#F1F8E9', border: '1px solid #C5E1A5', borderRadius: 6, color: '#33691E', fontSize: 13, marginBottom: 16 },
    msgErr:      { padding: '10px 14px', backgroundColor: '#FFF5F5', border: '1px solid #FFCDD2', borderRadius: 6, color: '#B71C1C', fontSize: 13, marginBottom: 16 },
    kpiRow:      { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 },
    kpi:         { backgroundColor: '#FFF', border: '1px solid #E8E8E6', borderRadius: 8, padding: '18px 20px', textAlign: 'right' },
    kpiLabel:    { fontSize: 10, fontWeight: 700, color: '#AAA', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 },
    kpiValue:    { fontSize: 26, fontWeight: 700, marginBottom: 4 },
    kpiSub:      { fontSize: 12, color: '#AAA' },
    tabs:        { display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #E8E8E6', paddingBottom: 0 },
    tab:         { padding: '8px 16px', fontSize: 13, fontWeight: 500, color: '#888', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '2px solid transparent', marginBottom: -2 },
    tabActive:   { color: '#CC0000', borderBottom: '2px solid #CC0000', fontWeight: 700 },
    card:        { backgroundColor: '#FFF', border: '1px solid #E8E8E6', borderRadius: 8, padding: '20px 24px', marginBottom: 20 },
    sectionTitle:{ fontSize: 15, fontWeight: 700, color: '#1A1A1A' },
    table:       { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th:          { padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #F0EEE8' },
    thNum:       { padding: '8px 12px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #F0EEE8' },
    tr:          { borderBottom: '1px solid #F7F5F0' },
    td:          { padding: '12px 12px', verticalAlign: 'middle' },
    tdNum:       { padding: '12px 12px', verticalAlign: 'middle', textAlign: 'right', fontWeight: 700 },
    empty:       { color: '#AAA', fontSize: 13, padding: '24px 0', textAlign: 'center' },
    infoBox:     { backgroundColor: '#F9F8F6', border: '1px solid #E8E8E6', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#555', marginBottom: 16 },
    formGrid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
    formGroup:   { display: 'flex', flexDirection: 'column', gap: 5 },
    label:       { fontSize: 12, fontWeight: 600, color: '#555' },
    input:       { height: 36, padding: '0 10px', fontSize: 13, border: '1px solid #E0E0DE', borderRadius: 4, backgroundColor: '#FAFAFA', outline: 'none' },
    btnApprove:  { padding: '4px 12px', backgroundColor: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
    btnReject:   { padding: '4px 12px', backgroundColor: '#FFEBEE', color: '#C62828', border: '1px solid #EF9A9A', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
    btnApproveAll: { padding: '6px 14px', backgroundColor: '#F0F4FF', color: '#2453C9', border: '1px solid #B0BEF0', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
    btnSubmit:   { height: 36, padding: '0 24px', backgroundColor: '#CC0000', color: '#FFF', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    btnCancel:   { height: 36, padding: '0 16px', backgroundColor: 'transparent', color: '#555', border: '1px solid #D0D0CE', borderRadius: 4, fontSize: 13, cursor: 'pointer' },
    btnSm:       { height: 30, padding: '0 10px', backgroundColor: '#CC0000', color: '#FFF', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
    editBtn:     { backgroundColor: 'rgba(180, 20, 20, 0.12)', border: '1px solid rgba(180, 20, 20, 0.25)', borderRadius: 4, fontSize: 13, color: '#e06060', cursor: 'pointer', padding: '3px 7px', lineHeight: 1 },
};