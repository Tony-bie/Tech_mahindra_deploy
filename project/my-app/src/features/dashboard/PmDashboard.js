import { useState, useEffect } from 'react';
import api from '../../config/api';
import ws from '../../config/ws';
import { styles, fmtMoney, fmtPct } from './dashboard.utils';
import WorkItemsSection from './WorkItemsSection';
import CostsSection from './CostsSection';
import SprintsSection from './SprintsSection';
import UpcomingSection from './UpcomingSection';
import ProjectsTable from './ProjectsTable';

function KpiCard({ label, value, sub, accent }) {
    return (
        <div style={s.card}>
            <div style={s.label}>{label}</div>
            <div style={{ ...s.value, color: accent || '#1A1A1A' }}>{value}</div>
            {sub && <div style={s.sub}>{sub}</div>}
        </div>
    );
}

function PmKpiStrip({ summary }) {
    if (!summary) return null;
    return (
        <>
            <div style={styles.grid4}>
                <KpiCard label="Mis proyectos"    value={summary.total_projects} />
                <KpiCard label="Sprints activos"  value={summary.active_sprints} />
                <KpiCard
                    label="Avance promedio"
                    value={summary.avance_promedio != null ? fmtPct(summary.avance_promedio) : 'N/D'}
                />
                <KpiCard
                    label="% work items completados"
                    value={summary.completion_rate != null ? fmtPct(summary.completion_rate) : 'N/D'}
                    accent="#3C9A57"
                />
            </div>
            <div style={styles.grid4}>
                <KpiCard label="Work items totales" value={summary.total_work_items} />
                <KpiCard
                    label="Costos por aprobar"
                    value={summary.pending_costs_count}
                    sub={fmtMoney(summary.pending_costs_amount)}
                    accent={summary.pending_costs_count > 0 ? '#E08F00' : undefined}
                />
                <KpiCard
                    label="Ítems vencidos"
                    value={summary.overdue_items_count}
                    accent={summary.overdue_items_count > 0 ? '#B94A48' : undefined}
                />
                <KpiCard
                    label="Riesgos activos"
                    value={summary.total_riesgos_activos ?? 0}
                    accent={summary.total_riesgos_activos > 0 ? '#B94A48' : undefined}
                />
            </div>
        </>
    );
}

export default function PmDashboard() {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState('');

    useEffect(() => {
        function handleWsMessage(e) {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === 'risk_update') load();
            } catch { /* ignorar */ }
        }
        ws.addEventListener('message', handleWsMessage);

        async function load() {
            setLoading(true);
            setError('');
            try {
                const { res, data: payload } = await api.get('/dashboard/pm');
                if (!res.ok) {
                    setError(payload.error || payload.message || `Error ${res.status}`);
                    return;
                }
                setData(payload);
            } catch {
                setError('Error de conexión con el servidor');
            } finally {
                setLoading(false);
            }
        }
        load();
        return () => ws.removeEventListener('message', handleWsMessage);
    }, []);

    if (loading) {
        return (
            <div style={styles.page}>
                <div style={styles.topBar}><span style={styles.crumbCurrent}>Inicio</span></div>
                <div style={styles.body}><p style={styles.muted}>Cargando dashboard...</p></div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <div style={styles.topBar}>
                <span style={styles.crumbCurrent}>Inicio</span>
            </div>
            <div style={styles.body}>
                <h1 style={styles.title}>Dashboard — Mis proyectos</h1>
                <p style={styles.subtitle}>Resumen de los proyectos que gestionas.</p>

                {error && <div style={styles.errorBox}>{error}</div>}

                {data && (
                    <>
                        <PmKpiStrip      summary={data.summary} />
                        <ProjectsTable   projects={data.projects} />
                        <div style={{ height: 24 }} />
                        <WorkItemsSection charts={data.charts} />
                        <SprintsSection   charts={data.charts} />
                        <CostsSection     charts={data.charts} />
                        <UpcomingSection  lists={data.lists} />
                    </>
                )}
            </div>
        </div>
    );
}

const s = {
    card:  { backgroundColor: '#FFF', border: '1px solid #E8E8E6', borderRadius: 8, padding: '16px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' },
    label: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 },
    value: { fontSize: 28, fontWeight: 700 },
    sub:   { fontSize: 11, color: '#888', marginTop: 4 },
};
