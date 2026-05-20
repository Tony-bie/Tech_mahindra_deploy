import { useNavigate } from 'react-router-dom';
import { fmtMoney, fmtPct, styles } from './dashboard.utils';

function getSemaphore(semaforo) {
    if (semaforo === 'rojo')     return { label: 'Rojo',     color: '#B71C1C', bg: '#FDECEC', dot: '#CC0000'  };
    if (semaforo === 'amarillo') return { label: 'Amarillo', color: '#8A5A00', bg: '#FFF3D9', dot: '#E8A000'  };
    if (semaforo === 'verde')    return { label: 'Verde',    color: '#2E7D32', bg: '#E7F6EA', dot: '#3C9A57'  };
    return null;
}

export default function ProjectsTable({ projects }) {
    const navigate = useNavigate();

    if (!projects || projects.length === 0) {
        return (
            <>
                <div style={styles.sectionTitle}>Proyectos</div>
                <div style={s.empty}>No hay proyectos.</div>
            </>
        );
    }

    return (
        <>
            <div style={styles.sectionTitle}>Proyectos</div>
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
                                            <span style={styles.muted}>No disponible</span>
                                        )}
                                    </td>
                                    <td style={s.td}>
                                        {p.desviacion != null ? (
                                            <span style={{ color: p.desviacion < 0 ? '#C62828' : '#2E7D32', fontWeight: 600 }}>
                                                {p.desviacion > 0 ? '+' : ''}{Number(p.desviacion).toFixed(2)}%
                                            </span>
                                        ) : (
                                            <span style={styles.muted}>—</span>
                                        )}
                                    </td>
                                    <td style={s.td}>
                                        {(() => {
                                            const sm = getSemaphore(p.semaforo);
                                            if (!sm) return <span style={styles.muted}>—</span>;
                                            return (
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    borderRadius: 999, padding: '2px 10px',
                                                    fontSize: 10, fontWeight: 700,
                                                    color: sm.color, backgroundColor: sm.bg,
                                                }}>
                                                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: sm.dot, flexShrink: 0 }} />
                                                    {sm.label}
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td style={s.td}>{fmtMoney(p.costo_aprobado)}</td>
                                    <td style={s.td}>
                                        {p.riesgos_activos > 0
                                            ? <span style={s.riskBadge}>{p.riesgos_activos}</span>
                                            : <span style={styles.muted}>0</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </>
    );
}

const s = {
    empty:         { padding: 48, textAlign: 'center', backgroundColor: '#FFF', border: '1px dashed #E0E0DE', borderRadius: 6, color: '#888', fontSize: 13 },
    tableCard:     { backgroundColor: '#FFF', border: '1px solid #E8E8E6', borderRadius: 6, overflow: 'hidden' },
    table:         { width: '100%', borderCollapse: 'collapse' },
    th:            { textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: '#555', letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #F0F0EE' },
    row:           { cursor: 'pointer', borderBottom: '1px solid #F5F5F4' },
    td:            { padding: '12px 16px', fontSize: 13 },
    progressWrap:  { display: 'flex', alignItems: 'center', gap: 8 },
    progressTrack: { width: 80, height: 6, backgroundColor: '#EEE', borderRadius: 3, overflow: 'hidden' },
    progressFill:  { height: '100%', backgroundColor: '#3C9A57' },
    progressLabel: { fontSize: 12, color: '#555' },
    riskBadge:     { display: 'inline-block', minWidth: 20, padding: '2px 8px', backgroundColor: '#FCE9E9', color: '#B94A48', borderRadius: 999, fontSize: 12, fontWeight: 600, textAlign: 'center' },
};
