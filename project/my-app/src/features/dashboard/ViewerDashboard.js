import { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';
import ws from '../../config/ws';
import { styles, COLORS, prettyStatus, prettyType, fmtPct } from './dashboard.utils';

const STATUS_COLORS = {
    todo:        COLORS.muted,
    in_progress: COLORS.accent,
    done:        COLORS.success,
};

const fmtDate = d => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function KpiCard({ label, value, sub, accent }) {
    return (
        <div style={s.card}>
            <div style={s.label}>{label}</div>
            <div style={{ ...s.value, color: accent || '#1A1A1A' }}>{value}</div>
            {sub && <div style={s.sub}>{sub}</div>}
        </div>
    );
}

function ViewerKpiStrip({ summary }) {
    if (!summary) return null;
    const completionRate = summary.my_items_total > 0
        ? summary.my_items_done / summary.my_items_total
        : null;
    return (
        <div style={styles.grid4}>
            <KpiCard label="Mis proyectos"      value={summary.my_projects_count} />
            <KpiCard
                label="Mis items completados"
                value={summary.my_items_done}
                sub={completionRate != null ? `${fmtPct(completionRate)} del total` : null}
                accent="#3C9A57"
            />
            <KpiCard
                label="En curso"
                value={summary.my_items_in_progress}
                accent={summary.my_items_in_progress > 0 ? COLORS.accent : undefined}
            />
            <KpiCard
                label="Puntos esta semana"
                value={summary.my_weekly_points}
                accent={summary.my_weekly_points > 0 ? '#9C27B0' : undefined}
            />
        </div>
    );
}

function MyItemsCharts({ charts }) {
    const statusData = (charts?.my_items_by_status || []).map(d => ({
        name: prettyStatus(d.status),
        value: d.n,
        raw: d.status,
    }));
    const typeData = (charts?.my_items_by_type || []).map(d => ({
        name: prettyType(d.type),
        value: d.n,
    }));

    return (
        <>
            <div style={styles.sectionTitle}>Mis work items</div>
            <div style={styles.grid2}>
                <div style={styles.card}>
                    <div style={styles.cardTitle}>Por estado</div>
                    {statusData.length === 0
                        ? <div style={styles.muted}>Sin items asignados.</div>
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
                    <div style={styles.cardTitle}>Por tipo</div>
                    {typeData.length === 0
                        ? <div style={styles.muted}>Sin items asignados.</div>
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
            </div>
        </>
    );
}

function SprintProgressSection({ charts }) {
    const data = (charts?.sprint_progress || []).map(s => ({
        name: s.sprint_name?.length > 22 ? s.sprint_name.slice(0, 20) + '…' : s.sprint_name,
        rawName: s.sprint_name,
        project: s.project_name,
        status: s.status,
        Completado: s.done_sp,
        Pendiente: Math.max(0, s.total_sp - s.done_sp),
    }));

    return (
        <>
            <div style={styles.sectionTitle}>Progreso de sprints</div>
            <div style={styles.card}>
                <div style={styles.cardTitle}>Story Points por sprint</div>
                {data.length === 0
                    ? <div style={styles.muted}>Sin sprints en tus proyectos.</div>
                    : (
                        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 44)}>
                            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 16 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    tick={{ fontSize: 10 }}
                                    width={140}
                                />
                                <Tooltip
                                    formatter={(value, name) => [value, name]}
                                    labelFormatter={(label, payload) => {
                                        const item = payload?.[0]?.payload;
                                        return `${item?.rawName || label} · ${item?.project || ''}`;
                                    }}
                                />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="Completado" stackId="a" fill={COLORS.success} />
                                <Bar dataKey="Pendiente"  stackId="a" fill={COLORS.muted}   />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
            </div>
            <div style={{ height: 24 }} />
        </>
    );
}

function MyOverdueSection({ lists }) {
    const navigate  = useNavigate();
    const overdue   = lists?.my_overdue_items   || [];
    const deadlines = lists?.upcoming_deadlines || [];

    function urgencyColor(daysLeft) {
        if (daysLeft <= 3) return { color: '#B94A48' };
        if (daysLeft <= 7) return { color: '#8A5A00' };
        return { color: '#3162D1' };
    }

    return (
        <>
            <div style={styles.sectionTitle}>Vencimientos y deadlines</div>
            <div style={styles.grid2}>
                <div style={styles.card}>
                    <div style={styles.cardTitle}>Mis ítems vencidos sin finalizar</div>
                    {overdue.length === 0
                        ? <div style={styles.muted}>Sin ítems vencidos.</div>
                        : (
                            <ul style={s.list}>
                                {overdue.map(it => (
                                    <li key={it.id_work_item} style={s.row}>
                                        <div>
                                            <div style={s.itemTitle}>{it.title}</div>
                                            {it.project_name && <div style={s.meta}>{it.project_name}</div>}
                                        </div>
                                        <span style={{ color: '#B94A48', fontWeight: 700, fontSize: 12 }}>
                                            {it.days_overdue}d
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                </div>

                <div style={styles.card}>
                    <div style={styles.cardTitle}>Deadlines de mis proyectos (próximos 30 días)</div>
                    {deadlines.length === 0
                        ? <div style={styles.muted}>No hay deadlines próximos.</div>
                        : (
                            <ul style={s.list}>
                                {deadlines.map(d => {
                                    const c = urgencyColor(d.days_left);
                                    return (
                                        <li
                                            key={d.id_project}
                                            style={s.row}
                                            onClick={() => navigate(`/projects/${d.id_project}/view`)}
                                        >
                                            <div>
                                                <div style={s.itemTitle}>{d.project_name}</div>
                                                <div style={s.meta}>{fmtDate(d.deadline)}</div>
                                            </div>
                                            <span style={{ color: c.color, fontWeight: 700, fontSize: 12 }}>
                                                {d.days_left === 0 ? 'Hoy' : `${d.days_left} días`}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                </div>
            </div>
        </>
    );
}

export default function ViewerDashboard() {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState('');

    useEffect(() => {
        function handleWsMessage(e) {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === 'sprint_update' || msg.type === 'work_item_update') load();
            } catch { /* ignorar */ }
        }
        ws.addEventListener('message', handleWsMessage);

        async function load() {
            setLoading(true);
            setError('');
            try {
                const { res, data: payload } = await api.get('/dashboard/viewer');
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
                <h1 style={styles.title}>Dashboard — Mi actividad</h1>
                <p style={styles.subtitle}>Resumen personal de tu trabajo y proyectos asignados.</p>

                {error && <div style={styles.errorBox}>{error}</div>}

                {data && (
                    <>
                        <ViewerKpiStrip      summary={data.summary} />
                        <MyItemsCharts       charts={data.charts} />
                        <SprintProgressSection charts={data.charts} />
                        <MyOverdueSection    lists={data.lists} />
                    </>
                )}
            </div>
        </div>
    );
}

const s = {
    card:      { backgroundColor: '#FFF', border: '1px solid #E8E8E6', borderRadius: 8, padding: '16px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' },
    label:     { fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 },
    value:     { fontSize: 28, fontWeight: 700 },
    sub:       { fontSize: 11, color: '#888', marginTop: 4 },
    list:      { listStyle: 'none', padding: 0, margin: 0, maxHeight: 280, overflowY: 'auto' },
    row:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid #F0F0EE', cursor: 'pointer' },
    itemTitle: { fontSize: 13, fontWeight: 500, color: '#1A1A1A' },
    meta:      { fontSize: 11, color: '#888', marginTop: 2 },
};
