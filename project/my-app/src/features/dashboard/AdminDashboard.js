import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';

const fmtMoney = n => `$${Number(n || 0).toLocaleString('es-MX')}`;
// `v` viene como ratio 0-1 desde el backend (ver docs/hu05-dashboard-formulas.md).
const fmtPct = v => `${Math.round(v * 100)}%`;

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function load() {
            setLoading(true);
            setError('');
            try {
                const { res, data } = await api.get('/dashboard/admin');
                if (!res.ok) {
                    setError(data.error || data.message || `Error ${res.status}`);
                    return;
                }
                setProjects(data.projects || []);
                setSummary(data.summary || null);
            } catch {
                setError('Error de conexión con el servidor');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) {
        return (
            <div style={s.page}>
                <div style={s.topBar}><span style={s.crumbCurrent}>Inicio</span></div>
                <div style={s.body}><p style={s.muted}>Cargando dashboard...</p></div>
            </div>
        );
    }

    return (
        <div style={s.page}>
            <div style={s.topBar}>
                <span style={s.crumbCurrent}>Inicio</span>
            </div>
            <div style={s.body}>
                <h1 style={s.title}>Dashboard consolidado</h1>
                <p style={s.subtitle}>Vista global de todos los proyectos.</p>

                {error && <div style={s.errorBox}>{error}</div>}

                {summary && (
                    <div style={s.kpiRow}>
                        <div style={s.kpiCard}>
                            <div style={s.kpiLabel}>Proyectos</div>
                            <div style={s.kpiValue}>{summary.total_projects}</div>
                        </div>
                        <div style={s.kpiCard}>
                            <div style={s.kpiLabel}>Costo aprobado total</div>
                            <div style={s.kpiValue}>{fmtMoney(summary.total_costo_aprobado)}</div>
                        </div>
                        <div style={s.kpiCard}>
                            <div style={s.kpiLabel}>Riesgos activos</div>
                            <div style={s.kpiValue}>{summary.total_riesgos_activos}</div>
                        </div>
                        <div style={s.kpiCard}>
                            <div style={s.kpiLabel}>Avance promedio</div>
                            <div style={s.kpiValue}>
                                {summary.avance_promedio != null ? fmtPct(summary.avance_promedio) : 'No disponible'}
                            </div>
                        </div>
                    </div>
                )}

                {projects.length === 0 ? (
                    <div style={s.empty}>No hay proyectos.</div>
                ) : (
                    <div style={s.tableCard}>
                        <table style={s.table}>
                            <thead>
                                <tr>
                                    <th style={s.th}>Proyecto</th>
                                    <th style={s.th}>Cliente</th>
                                    <th style={s.th}>Avance real</th>
                                    <th style={s.th}>Desviación</th>
                                    <th style={s.th}>Semáforo</th>
                                    <th style={s.th}>Costo aprobado</th>
                                    <th style={s.th}>Riesgos activos</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projects.map(p => {
                                    const openProject = () => navigate(`/projects/${p.id_project}/view`);
                                    return (
                                    <tr
                                        key={p.id_project}
                                        style={s.row}
                                        role="button"
                                        tabIndex={0}
                                        onClick={openProject}
                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProject(); } }}
                                    >
                                        <td style={s.td}>{p.project_name}</td>
                                        <td style={s.td}>{p.client_name}</td>
                                        <td style={s.td}>
                                            {p.avance_real != null ? (
                                                <div style={s.progressWrap}>
                                                    <div style={s.progressTrack}>
                                                        <div style={{
                                                            ...s.progressFill,
                                                            width: `${Math.min(100, Math.round(p.avance_real * 100))}%`,
                                                        }} />
                                                    </div>
                                                    <span style={s.progressLabel}>{fmtPct(p.avance_real)}</span>
                                                </div>
                                            ) : (
                                                <span style={s.muted}>No disponible</span>
                                            )}
                                        </td>
                                        <td style={s.td}><span style={s.muted} title="Pendiente de Sprint 3 (requiere avance esperado)">No disponible</span></td>
                                        <td style={s.td}><span style={s.muted} title="Pendiente de Sprint 3 (requiere Risk Score)">No disponible</span></td>
                                        <td style={s.td}>{fmtMoney(p.costo_aprobado)}</td>
                                        <td style={s.td}>
                                            {p.riesgos_activos > 0
                                                ? <span style={s.riskBadge}>{p.riesgos_activos}</span>
                                                : <span style={s.muted}>0</span>}
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

const s = {
    page:         { minHeight: '100vh', backgroundColor: '#F5F5F4', fontFamily: "'DM Sans',sans-serif", color: '#1A1A1A' },
    topBar:       { backgroundColor: '#FFF', borderBottom: '1px solid #E5E5E3', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center' },
    crumbCurrent: { fontSize: 13, color: '#1A1A1A', fontWeight: 500 },
    body:         { padding: 32 },
    title:        { fontSize: 22, fontWeight: 700, marginBottom: 4 },
    subtitle:     { fontSize: 13, color: '#888', marginBottom: 24 },
    muted:        { fontSize: 13, color: '#AAA' },
    errorBox:     { padding: '12px 16px', backgroundColor: '#FFF5F5', border: '1px solid #FFCDD2', borderRadius: 4, color: '#B71C1C', fontSize: 13, marginBottom: 16 },
    kpiRow:       { display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
    kpiCard:      { flex: '1 1 180px', backgroundColor: '#FFF', border: '1px solid #E8E8E6', borderRadius: 6, padding: '16px 20px' },
    kpiLabel:     { fontSize: 12, color: '#888', marginBottom: 6 },
    kpiValue:     { fontSize: 22, fontWeight: 700 },
    empty:        { padding: 48, textAlign: 'center', backgroundColor: '#FFF', border: '1px dashed #E0E0DE', borderRadius: 6, color: '#888', fontSize: 13 },
    tableCard:    { backgroundColor: '#FFF', border: '1px solid #E8E8E6', borderRadius: 6, overflow: 'hidden' },
    table:        { width: '100%', borderCollapse: 'collapse' },
    th:           { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: '#555', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #F0F0EE' },
    row:          { cursor: 'pointer', borderBottom: '1px solid #F5F5F4' },
    td:           { padding: '12px 16px', fontSize: 13 },
    progressWrap: { display: 'flex', alignItems: 'center', gap: 8 },
    progressTrack:{ width: 80, height: 6, backgroundColor: '#EEE', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#3C9A57' },
    progressLabel:{ fontSize: 12, color: '#555' },
    riskBadge:    { display: 'inline-block', minWidth: 20, padding: '2px 8px', backgroundColor: '#FCE9E9', color: '#B94A48', borderRadius: 999, fontSize: 12, fontWeight: 600, textAlign: 'center' },
};
