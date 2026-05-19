import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { COLORS, prettyRole, styles } from './dashboard.utils';

const ROLE_COLORS = {
    admin:  COLORS.primary,
    pm:     COLORS.accent,
    viewer: COLORS.success,
};

export default function TeamSection({ charts }) {
    const roles = (charts?.users_by_role || []).map(d => ({
        name: prettyRole(d.role),
        value: d.n,
        raw: d.role,
    }));

    const contributors = (charts?.top_contributors || []).map(d => ({
        name: d.full_name || d.username,
        eventos: d.events,
    }));

    return (
        <>
            <div style={styles.sectionTitle}>Equipo</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 24 }}>
                <div style={styles.card}>
                    <div style={styles.cardTitle}>Usuarios por rol</div>
                    {roles.length === 0
                        ? <div style={styles.muted}>Sin datos.</div>
                        : (
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie data={roles} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                                        {roles.map((d, i) => <Cell key={i} fill={ROLE_COLORS[d.raw] || COLORS.palette[i]} />)}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                </div>

                <div style={styles.card}>
                    <div style={styles.cardTitle}>Top 10 colaboradores por actividad</div>
                    {contributors.length === 0
                        ? <div style={styles.muted}>Sin actividad registrada.</div>
                        : (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={contributors} layout="vertical" margin={{ left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={130} />
                                    <Tooltip />
                                    <Bar dataKey="eventos" fill={COLORS.accent} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                </div>
            </div>
        </>
    );
}
