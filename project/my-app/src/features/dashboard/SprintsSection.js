import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { COLORS, prettyStatus, styles } from './dashboard.utils';

const STATUS_COLORS = {
    planned:   COLORS.muted,
    active:    COLORS.accent,
    done:      COLORS.success,
    cancelled: COLORS.danger,
};

const ORDER = ['planned', 'active', 'done', 'cancelled'];

export default function SprintsSection({ charts }) {
    // Asegurar que aparezcan los 4 estatus aun si vienen vacios.
    const raw = Object.fromEntries((charts?.sprints_by_status || []).map(d => [d.status, d.n]));
    const data = ORDER.map(status => ({
        name: prettyStatus(status),
        raw: status,
        sprints: raw[status] || 0,
    }));

    return (
        <>
            <div style={styles.sectionTitle}>Sprints</div>
            <div style={styles.card}>
                <div style={styles.cardTitle}>Sprints por estado</div>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="sprints">
                            {data.map((d, i) => <Cell key={i} fill={STATUS_COLORS[d.raw] || COLORS.muted} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div style={{ height: 24 }} />
        </>
    );
}
