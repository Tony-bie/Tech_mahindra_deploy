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
    pending:  { label: 'Pending',  bg: '#FFF8E1', color: '#E65100', border: '#FFE082' },
    approved: { label: 'Approved', bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' },
    rejected: { label: 'Rejected', bg: '#FFEBEE', color: '#C62828', border: '#EF9A9A' },
};

const CATEGORY_COLORS = {
    Infrastructure: '#E3F2FD', Software: '#F3E5F5', Consulting: '#E8F5E9',
    Training: '#FFF9C4', Hardware: '#FCE4EC', Travel: '#E0F7FA', Other: '#F5F5F5',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = n => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
const fmtDate = d => d ? String(d).slice(0, 10) : '—';

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
                    <span style={{ color: '#1A1A1A', fontWeight: 500 }}>Costs</span>
                </div>
                <div style={{ fontSize: 11, color: '#AAA' }}>RF-14 · RF-15 · RF-16</div>
            </div>

            <div style={s.body}>
                <h1 style={s.title}>Cost Management</h1>

                {/* ── Mensaje ──────────────────────────────────────────────── */}
                {msg.text && (
                    <div style={msg.type === 'error' ? s.msgErr : s.msgOk}>{msg.text}</div>
                )}

                {/* ── KPI Cards ────────────────────────────────────────────── */}
                <div style={s.kpiRow}>
                    <div style={s.kpi}>
                        <div style={s.kpiLabel}>ESTIMATED BUDGET</div>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ ...s.kpiValue, color: '#1A1A1A' }}>{fmt(summary.estimated_budget)}</div>
                                {isPM && (
                                    <button style={s.editBtn} onClick={() => setEditBudget(true)}>✎</button>
                                )}
                            </div>
                        )}
                        <div style={s.kpiSub}>Total project budget</div>
                    </div>

                    <KpiCard
                        label="APPROVED COST"
                        value={fmt(summary.approved_cost)}
                        sub={`${usedPct}% of budget used`}
                        accent="#E65100"
                    />
                    <KpiCard
                        label="PENDING APPROVAL"
                        value={fmt(summary.pending_cost)}
                        sub={`${pendingCount} item${pendingCount !== 1 ? 's' : ''} awaiting PM`}
                        accent="#E07A00"
                    />
                    <KpiCard
                        label="REMAINING BUDGET"
                        value={fmt(summary.remaining_budget)}
                        sub={`${100 - usedPct}% available`}
                        accent="#2E7D32"
                    />
                </div>

                {/* ── Tabs ─────────────────────────────────────────────────── */}
                <div style={s.tabs}>
                    {[
                        { key: 'pending',  label: `Pending Approval${pendingCount ? ` (${pendingCount})` : ''}` },
                        { key: 'approved', label: 'Approved' },
                        { key: 'rejected', label: 'Rejected' },
                        { key: 'all',      label: 'All Costs' },
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
                                <div style={s.sectionTitle}>Costs Pending PM Approval</div>
                                <div style={{ fontSize: 11, color: '#AAA', marginTop: 2 }}>
                                    RF-15 · Approved costs impact metrics immediately
                                </div>
                            </div>
                            {pendingCount > 1 && (
                                <button style={s.btnApproveAll} onClick={approveAll}>
                                    Approve All Visible
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
                                            {['CATEGORY','DESCRIPTION','AMOUNT','SUBMITTED BY','DATE','STATUS','ACTIONS'].map(h => (
                                                <th key={h} style={s.th}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(spend => (
                                            <tr key={spend.id_spend} style={s.tr}>
                                                <td style={s.td}><CategoryBadge category={spend.category || spend.type} /></td>
                                                <td style={{ ...s.td, maxWidth: 260 }}>{spend.description}</td>
                                                <td style={{ ...s.td, fontWeight: 700 }}>{fmt(spend.amount)}</td>
                                                <td style={s.td}>{spend.submitter?.full_name || spend.submitter?.username || `User #${spend.submitted_by}`}</td>
                                                <td style={s.td}>{fmtDate(spend.spend_date || spend.created_at)}</td>
                                                <td style={s.td}><StatusBadge status={spend.status} /></td>
                                                <td style={s.td}>
                                                    <div style={{ display: 'flex', gap: 6 }}>
                                                        <button style={s.btnApprove} onClick={() => decide(spend.id_spend, 'approved')}>
                                                            Approve
                                                        </button>
                                                        <button style={s.btnReject} onClick={() => decide(spend.id_spend, 'rejected')}>
                                                            Reject
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
                            ⚠ Approving costs updates the Approved Cost Accumulated metric in real time (RF-16)
                        </div>
                    </div>
                )}

                {/* Tabla para otros tabs */}
                {(tab !== 'pending' || !isPM) && (
                    <div style={s.card}>
                        <div style={s.sectionTitle}>
                            {tab === 'approved' ? 'Approved Costs' : tab === 'rejected' ? 'Rejected Costs' : tab === 'all' ? 'All Costs' : 'My Costs'}
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
                                            {['CATEGORY','DESCRIPTION','AMOUNT','SUBMITTED BY','DATE','STATUS'].map(h => (
                                                <th key={h} style={s.th}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(spend => (
                                            <tr key={spend.id_spend} style={s.tr}>
                                                <td style={s.td}><CategoryBadge category={spend.category || spend.type} /></td>
                                                <td style={{ ...s.td, maxWidth: 260 }}>{spend.description}</td>
                                                <td style={{ ...s.td, fontWeight: 700 }}>{fmt(spend.amount)}</td>
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
                        <div style={s.sectionTitle}>Submit a Cost</div>
                        <div style={{ fontSize: 11, color: '#AAA' }}>RF-14 · Viewer submits · stored as pending until PM approves</div>
                    </div>

                    <div style={s.infoBox}>
                        Costs submitted here will have <strong>Pending</strong> status.
                        They will only impact official budget metrics after PM approval.
                    </div>

                    <div style={s.formGrid}>
                        <div style={s.formGroup}>
                            <label style={s.label}>Category *</label>
                            <select style={s.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                                <option value="">— Select category (CA-01) —</option>
                                {VALID_CATEGORIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div style={s.formGroup}>
                            <label style={s.label}>Amount (USD, &gt; $0) *</label>
                            <input
                                style={s.input} type="number" min="0.01" step="0.01"
                                placeholder="0.00" value={form.amount}
                                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                            />
                        </div>

                        <div style={{ ...s.formGroup, gridColumn: '1 / -1' }}>
                            <label style={s.label}>Description *</label>
                            <input
                                style={s.input} type="text"
                                placeholder="What is this cost for? Be specific."
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                            />
                        </div>

                        <div style={s.formGroup}>
                            <label style={s.label}>Date *</label>
                            <input
                                style={s.input} type="date" value={form.spend_date}
                                onChange={e => setForm(f => ({ ...f, spend_date: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                        <button style={s.btnCancel} onClick={() => setForm({ category: '', amount: '', description: '', spend_date: '' })}>
                            Cancel
                        </button>
                        <button style={s.btnSubmit} onClick={handleSubmit} disabled={submitting}>
                            {submitting ? 'Submitting...' : 'Submit'}
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
    body:        { padding: '28px 32px', maxWidth: 1200 },
    title:       { fontSize: 24, fontWeight: 700, marginBottom: 20 },
    msgOk:       { padding: '10px 14px', backgroundColor: '#F1F8E9', border: '1px solid #C5E1A5', borderRadius: 6, color: '#33691E', fontSize: 13, marginBottom: 16 },
    msgErr:      { padding: '10px 14px', backgroundColor: '#FFF5F5', border: '1px solid #FFCDD2', borderRadius: 6, color: '#B71C1C', fontSize: 13, marginBottom: 16 },
    kpiRow:      { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 },
    kpi:         { backgroundColor: '#FFF', border: '1px solid #E8E8E6', borderRadius: 8, padding: '18px 20px' },
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
    tr:          { borderBottom: '1px solid #F7F5F0' },
    td:          { padding: '12px 12px', verticalAlign: 'middle' },
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
    editBtn:     { background: 'none', border: 'none', fontSize: 14, color: '#AAA', cursor: 'pointer', padding: '0 4px' },
};