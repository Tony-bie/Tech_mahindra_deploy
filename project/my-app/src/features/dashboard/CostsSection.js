import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { COLORS, fmtMoney, prettyStatus, styles } from './dashboard.utils';

const STATUS_COLORS = {
    pending:  COLORS.warning,
    approved: COLORS.success,
    rejected: COLORS.danger,
};

export default function CostsSection({ charts }) {
    const byCat = (charts?.spends_by_category || []).map(d => ({
        name: d.category,
        value: Number(d.approved_total),
    }));

    const byStatus = (charts?.spends_by_status || []).map(d => ({
        name: prettyStatus(d.status),
        raw: d.status,
        count: d.n,
        Monto: Number(d.total),
    }));

    return (
        <>
            <div style={styles.sectionTitle}>Costos</div>
            <div style={styles.grid2}>
                <div style={styles.card}>
                    <div style={styles.cardTitle}>Gasto aprobado por categoría</div>
                    {byCat.length === 0
                        ? <div style={styles.muted}>Sin gastos aprobados aún.</div>
                        : (
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie
                                        data={byCat}
                                        dataKey="value"
                                        nameKey="name"
                                        outerRadius={80}
                                        innerRadius={45}
                                        paddingAngle={2}
                                    >
                                        {byCat.map((_, i) => <Cell key={i} fill={COLORS.palette[i % COLORS.palette.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={v => fmtMoney(v)} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                </div>

                <div style={styles.card}>
                    <div style={styles.cardTitle}>Gastos por estado (monto)</div>
                    {byStatus.every(d => d.count === 0)
                        ? <div style={styles.muted}>Sin gastos registrados.</div>
                        : (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={byStatus}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtMoney} />
                                    <Tooltip formatter={v => fmtMoney(v)} />
                                    <Bar dataKey="Monto">
                                        {byStatus.map((d, i) => <Cell key={i} fill={STATUS_COLORS[d.raw] || COLORS.muted} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                </div>
            </div>
        </>
    );
}
