import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { COLORS, prettyStatus, prettyType, styles } from './dashboard.utils';

const STATUS_COLORS = {
    todo:        COLORS.muted,
    in_progress: COLORS.accent,
    done:        COLORS.success,
};

export default function WorkItemsSection({ charts }) {
    const statusData = (charts?.work_items_by_status || []).map(d => ({
        name: prettyStatus(d.status),
        value: d.n,
        raw: d.status,
    }));

    const typeData = (charts?.work_items_by_type || []).map(d => ({
        name: prettyType(d.type),
        value: d.n,
        raw: d.type,
    }));

    const spData = (charts?.project_sp_progress || [])
        .slice()
        .sort((a, b) => (b.done_sp + b.total_sp) - (a.done_sp + a.total_sp))
        .slice(0, 9)
        .map(d => ({
            name: d.project_name?.length > 18 ? d.project_name.slice(0, 16) + '…' : d.project_name,
            Completado: d.done_sp,
            Pendiente: Math.max(0, d.total_sp - d.done_sp),
            Estimado: d.estimated_sp,
        }));

    return (
        <>
            <div style={styles.sectionTitle}>Estado del trabajo</div>
            <div style={styles.grid3}>
                <div style={styles.card}>
                    <div style={styles.cardTitle}>Work items por estado</div>
                    {statusData.length === 0
                        ? <div style={styles.muted}>Sin datos.</div>
                        : (
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                                        {statusData.map((d, i) => (
                                            <Cell key={i} fill={STATUS_COLORS[d.raw] || COLORS.palette[i]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                </div>

                <div style={styles.card}>
                    <div style={styles.cardTitle}>Work items por tipo</div>
                    {typeData.length === 0
                        ? <div style={styles.muted}>Sin datos.</div>
                        : (
                            <ResponsiveContainer width="100%" height={220}>
                                <PieChart>
                                    <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                                        {typeData.map((_, i) => <Cell key={i} fill={COLORS.palette[i % COLORS.palette.length]} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                </div>

                <div style={styles.card}>
                    <div style={styles.cardTitle}>Story Points por proyecto</div>
                    {spData.length === 0
                        ? <div style={styles.muted}>Sin datos.</div>
                        : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={spData} layout="vertical" margin={{ left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 11 }} />
                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                                    <Tooltip />
                                    <Legend wrapperStyle={{ fontSize: 11 }} />
                                    <Bar dataKey="Completado" stackId="a" fill={COLORS.success} />
                                    <Bar dataKey="Pendiente" stackId="a" fill={COLORS.muted} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                </div>
            </div>
        </>
    );
}
