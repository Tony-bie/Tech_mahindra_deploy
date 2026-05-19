import { useNavigate } from 'react-router-dom';
import { styles } from './dashboard.utils';

const fmtDate = d => d ? new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function urgencyColor(daysLeft) {
    if (daysLeft <= 3)  return { bg: '#FCE9E9', color: '#B94A48' }; // rojo
    if (daysLeft <= 7)  return { bg: '#FFF3D9', color: '#8A5A00' }; // ambar
    return { bg: '#EAF3FF', color: '#3162D1' };                     // azul
}

export default function UpcomingSection({ lists }) {
    const navigate = useNavigate();
    const deadlines = lists?.upcoming_deadlines || [];
    const overdue = lists?.overdue_items || [];

    return (
        <>
            <div style={styles.sectionTitle}>Próximos vencimientos</div>
            <div style={styles.grid2}>
                <div style={styles.card}>
                    <div style={styles.cardTitle}>Deadlines de proyecto (próximos 30 días)</div>
                    {deadlines.length === 0 ? (
                        <div style={styles.muted}>No hay deadlines próximos.</div>
                    ) : (
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
                                            <div style={s.title}>{d.project_name}</div>
                                            <div style={s.meta}>{fmtDate(d.deadline)}</div>
                                        </div>
                                        <span style={{ ...s.pill, backgroundColor: c.bg, color: c.color }}>
                                            {d.days_left === 0 ? 'Hoy' : `${d.days_left} días`}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div style={styles.card}>
                    <div style={styles.cardTitle}>Ítems vencidos sin finalizar</div>
                    {overdue.length === 0 ? (
                        <div style={styles.muted}>No hay ítems vencidos.</div>
                    ) : (
                        <ul style={s.list}>
                            {overdue.map(it => (
                                <li key={it.id_work_item} style={s.row}>
                                    <div>
                                        <div style={s.title}>{it.title}</div>
                                        <div style={s.meta}>
                                            {it.project_name}
                                            {it.assignee_username && <> · {it.assignee_username}</>}
                                        </div>
                                    </div>
                                    <span style={{ ...s.pill, backgroundColor: '#FCE9E9', color: '#B94A48' }}>
                                        {it.days_overdue}d
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </>
    );
}

const s = {
    list:  { listStyle: 'none', padding: 0, margin: 0, maxHeight: 280, overflowY: 'auto' },
    row:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid #F0F0EE', cursor: 'pointer' },
    title: { fontSize: 13, fontWeight: 500, color: '#1A1A1A' },
    meta:  { fontSize: 11, color: '#888', marginTop: 2 },
    pill:  { padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600 },
};
