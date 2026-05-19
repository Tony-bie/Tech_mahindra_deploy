import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar,
} from 'recharts';
import { COLORS, prettyAction, styles } from './dashboard.utils';

export default function ActivitySection({ charts }) {
    const activity = (charts?.activity_by_day || []).map(d => ({
        // Mostrar DD/MM solamente para que quepa en el eje
        day: d.day.slice(5),
        events: d.events,
    }));

    const actions = (charts?.actions_top || []).map(d => ({
        name: prettyAction(d.action),
        eventos: d.n,
    }));

    return (
        <>
            <div style={styles.sectionTitle}>Actividad y operación</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={styles.card}>
                    <div style={styles.cardTitle}>Eventos por día (últimos 30)</div>
                    {activity.every(d => d.events === 0)
                        ? <div style={styles.muted}>Sin actividad reciente.</div>
                        : (
                            <ResponsiveContainer width="100%" height={240}>
                                <AreaChart data={activity}>
                                    <defs>
                                        <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.4} />
                                            <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} />
                                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="events" stroke={COLORS.accent} fill="url(#activityFill)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                </div>

                <div style={styles.card}>
                    <div style={styles.cardTitle}>Acciones más comunes</div>
                    {actions.length === 0
                        ? <div style={styles.muted}>Sin datos.</div>
                        : (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={actions} layout="vertical" margin={{ left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={130} />
                                    <Tooltip />
                                    <Bar dataKey="eventos" fill={COLORS.primary} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                </div>
            </div>
        </>
    );
}
