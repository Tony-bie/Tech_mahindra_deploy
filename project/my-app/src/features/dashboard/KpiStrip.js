import { fmtMoney, fmtPct, styles } from './dashboard.utils';

function KpiCard({ label, value, sub, accent }) {
    return (
        <div style={s.card}>
            <div style={s.label}>{label}</div>
            <div style={{ ...s.value, color: accent || '#1A1A1A' }}>{value}</div>
            {sub && <div style={s.sub}>{sub}</div>}
        </div>
    );
}

export default function KpiStrip({ summary }) {
    if (!summary) return null;

    return (
        <>
            <div style={styles.grid4}>
                <KpiCard label="Proyectos"          value={summary.total_projects} />
                <KpiCard label="Usuarios"           value={summary.total_users} />
                <KpiCard label="Sprints activos"    value={summary.active_sprints} />
                <KpiCard
                    label="Avance promedio"
                    value={summary.avance_promedio != null ? fmtPct(summary.avance_promedio) : 'N/D'}
                />
            </div>
            <div style={styles.grid4}>
                <KpiCard label="Work items"         value={summary.total_work_items} />
                <KpiCard
                    label="% completados"
                    value={summary.completion_rate != null ? fmtPct(summary.completion_rate) : 'N/D'}
                    accent="#3C9A57"
                />
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
            </div>
            <div style={styles.grid4}>
                <KpiCard
                    label="Riesgos activos"
                    value={summary.total_riesgos_activos ?? 0}
                    accent={summary.total_riesgos_activos > 0 ? '#B94A48' : undefined}
                />
            </div>
        </>
    );
}

const s = {
    card:  { backgroundColor: '#FFF', border: '1px solid #E8E8E6', borderRadius: 8, padding: '16px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' },
    label: { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 },
    value: { fontSize: 28, fontWeight: 700 },
    sub:   { fontSize: 11, color: '#888', marginTop: 4 },
};
