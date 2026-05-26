import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';
import './ViewerProjectsTable.css';

/* Semáforo HU-16 — consume campo `semaforo` calculado en el backend */
function getSemaphore(prog) {
    if (!prog || !prog.semaforo) return { label: '—',         color: '#AAA',     bg: '#F5F5F4',  dot: '#CCC'     };
    if (prog.semaforo === 'rojo')     return { label: 'Rojo',     color: '#B71C1C',  bg: '#FDECEC',  dot: '#CC0000'  };
    if (prog.semaforo === 'amarillo') return { label: 'Amarillo', color: '#8A5A00',  bg: '#FFF3D9',  dot: '#E8A000'  };
    return                                   { label: 'Verde',    color: '#2E7D32',  bg: '#E7F6EA',  dot: '#3C9A57'  };
}

/* ─── Viewer Management Modal ───────────────────────────────────────── */
function ViewersModal({ project, onClose }) {
    const [viewers,    setViewers]    = useState([]);
    const [allViewers, setAllViewers] = useState([]);
    const [selected,   setSelected]   = useState('');
    const [loading,    setLoading]    = useState(true);
    const [adding,     setAdding]     = useState(false);

    const loadViewers = useCallback(async () => {
        try {
            const { res, data } = await api.get(`/projects/${project.id_project}/viewers`);
            if (res.ok) setViewers(data.viewers || []);
        } catch {}
    }, [project.id_project]);

    useEffect(() => {
        async function init() {
            setLoading(true);
            try {
                const [pvRes, avRes] = await Promise.all([
                    api.get(`/projects/${project.id_project}/viewers`),
                    api.get('/projects/viewers'),
                ]);
                if (pvRes.res.ok)  setViewers(pvRes.data.viewers   || []);
                if (avRes.res.ok)  setAllViewers(avRes.data.viewers || []);
            } catch {}
            setLoading(false);
        }
        init();
    }, [project.id_project]);

    const available = allViewers.filter(v => !viewers.find(pv => pv.id_user === v.id_user));

    async function handleAdd() {
        if (!selected) return;
        setAdding(true);
        try {
            const { res } = await api.post(`/projects/${project.id_project}/viewers`, {
                viewer_id: parseInt(selected),
            });
            if (res.ok) { setSelected(''); loadViewers(); }
        } catch {}
        setAdding(false);
    }

    async function handleRemove(viewerId) {
        try {
            await api.delete(`/projects/${project.id_project}/viewers/${viewerId}`);
            loadViewers();
        } catch {}
    }

    return (
        <div style={ms.overlay} onClick={onClose}>
            <div style={ms.modal} onClick={e => e.stopPropagation()}>
                <div style={ms.header}>
                    <div>
                        <div style={ms.title}>Gestionar visores</div>
                        <div style={ms.sub}>{project.project_name}</div>
                    </div>
                    <button style={ms.closeBtn} onClick={onClose}>✕</button>
                </div>

                {loading ? (
                    <div style={ms.loading}>Cargando...</div>
                ) : (
                    <>
                        <div style={ms.sectionLabel}>VISORES ASIGNADOS ({viewers.length})</div>
                        {viewers.length === 0 ? (
                            <div style={ms.empty}>Sin visores asignados aún.</div>
                        ) : (
                            viewers.map(v => (
                                <div key={v.id_user} style={ms.viewerRow}>
                                    <div>
                                        <span style={ms.viewerName}>{v.username}</span>
                                        <span style={ms.viewerEmail}> · {v.email}</span>
                                    </div>
                                    <button style={ms.removeBtn} onClick={() => handleRemove(v.id_user)}>
                                        Quitar
                                    </button>
                                </div>
                            ))
                        )}

                        <div style={ms.addSection}>
                            <div style={ms.sectionLabel}>AGREGAR VISOR</div>
                            {available.length === 0 ? (
                                <div style={ms.empty}>No hay más visores disponibles.</div>
                            ) : (
                                <div style={ms.addRow}>
                                    <select
                                        style={ms.select}
                                        value={selected}
                                        onChange={e => setSelected(e.target.value)}
                                    >
                                        <option value="">— Seleccionar visor —</option>
                                        {available.map(v => (
                                            <option key={v.id_user} value={v.id_user}>
                                                {v.username} · {v.email}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        style={ms.addBtn}
                                        onClick={handleAdd}
                                        disabled={!selected || adding}
                                    >
                                        {adding ? '...' : 'Agregar'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

const ms = {
    overlay:      { position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' },
    modal:        { backgroundColor:'#FFF', borderRadius:8, padding:28, width:520, maxWidth:'90vw', maxHeight:'80vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.18)' },
    header:       { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 },
    title:        { fontSize:16, fontWeight:700, color:'#1A1A1A' },
    sub:          { fontSize:12, color:'#888', marginTop:2 },
    closeBtn:     { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#888', padding:'0 4px' },
    sectionLabel: { fontSize:11, fontWeight:600, color:'#555', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:10 },
    loading:      { padding:20, textAlign:'center', color:'#888', fontSize:13 },
    empty:        { fontSize:13, color:'#AAA', padding:'8px 0', marginBottom:16 },
    viewerRow:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #F5F5F4', fontSize:13 },
    viewerName:   { fontWeight:500, color:'#1A1A1A' },
    viewerEmail:  { color:'#999' },
    removeBtn:    { height:26, padding:'0 10px', backgroundColor:'transparent', color:'#CC0000', border:'1px solid #FFCDD2', borderRadius:4, fontSize:11, cursor:'pointer' },
    addSection:   { marginTop:20 },
    addRow:       { display:'flex', gap:8 },
    select:       { flex:1, height:32, padding:'0 8px', fontSize:12, border:'1px solid #E0E0DE', borderRadius:4, backgroundColor:'#FAFAFA' },
    addBtn:       { height:32, padding:'0 16px', backgroundColor:'#1A1A1A', color:'#FFF', border:'none', borderRadius:4, fontSize:12, cursor:'pointer' },
};

/* ─── Main Component ────────────────────────────────────────────────── */
export default function ViewerProjectsTable({ user }) {
    const navigate = useNavigate();
    const isPM     = user?.role === 'pm' || user?.role === 'admin';

    const [projects,     setProjects]     = useState([]);
    const [query,        setQuery]        = useState('');
    const [loading,      setLoading]      = useState(true);
    const [error,        setError]        = useState('');
    const [viewersModal, setViewersModal] = useState(null);
    const [progressMap,  setProgressMap]  = useState({}); // { [id_project]: data | null }
    const [risksMap,     setRisksMap]     = useState({}); // { [id_project]: count }
    const [filters, setFilters] = useState('all');

    useEffect(() => {
        async function loadProjects() {
            try {
                setLoading(true);
                setError('');
                const { res, data } = await api.get('/projects');
                if (!res.ok) {
                    setProjects([]);
                    setError(data.message || 'No se pudieron cargar los proyectos');
                    return;
                }
                const list = Array.isArray(data) ? data : [];
                setProjects(list);

                // Fetch progreso y riesgos de todos los proyectos en paralelo
                const [progressEntries, riskEntries] = await Promise.all([
                    Promise.all(
                        list.map(async (p) => {
                            try {
                                const { res: pr, data: pd } = await api.get(`/projects/${p.id_project}/progress`);
                                return [p.id_project, pr.ok ? pd : null];
                            } catch {
                                return [p.id_project, null];
                            }
                        })
                    ),
                    Promise.all(
                        list.map(async (p) => {
                            try {
                                const { res: rr, data: rd } = await api.get(`/risks?project_id=${p.id_project}`);
                                const count = rr.ok
                                    ? (rd.risks || []).filter(r => r.status === 'active').length
                                    : 0;
                                return [p.id_project, count];
                            } catch {
                                return [p.id_project, 0];
                            }
                        })
                    ),
                ]);
                setProgressMap(Object.fromEntries(progressEntries));
                setRisksMap(Object.fromEntries(riskEntries));
            } catch {
                setProjects([]);
                setError('Error de conexión con el servidor');
            } finally {
                setLoading(false);
            }
        }
        loadProjects();
    }, []);

    const filtered = useMemo(() => {
        let result = projects;
        
        const q = query.trim().toLowerCase();
        if (q) result = result.filter(p =>
            String(p.project_name || '').toLowerCase().includes(q) ||
            String(p.client_name  || '').toLowerCase().includes(q)
        );

        if (filters === 'solo_rojo') {
            result = result.filter(p => progressMap[p.id_project]?.semaforo === 'rojo');
        }

        if (filters === 'desviacion_negativa') {
            result = result.filter(p => (progressMap[p.id_project]?.desviacion ?? 0) < 0);
        }

        const order = { rojo: 0, amarillo: 1, verde: 2 };
        if (filters === 'mayor_riesgo') {
            result = result.sort((a, b) => {
                const sa = order[progressMap[a.id_project]?.semaforo] ?? 3;
                const sb = order[progressMap[b.id_project]?.semaforo] ?? 3;
                if (sa !== sb) return sa - sb;
                // desempate: más negativo primero
                const da = progressMap[a.id_project]?.desviacion ?? 0;
                const db = progressMap[b.id_project]?.desviacion ?? 0;
                return da - db;
            });
        }
        if (filters === 'menor_riesgo') {
            result = result.sort((a, b) => {
                const sa = order[progressMap[a.id_project]?.semaforo] ?? 3;
                const sb = order[progressMap[b.id_project]?.semaforo] ?? 3;
                return sb - sa;
            });
        }
        if (filters === 'Riesgos_actvos'){
            result = result.filter(p => (risksMap[p.id_project] ?? 0) > 0);
        }
        return result;
    }, [projects, query, filters, progressMap]);

    if (loading) return <div className="vpt-empty">Cargando proyectos...</div>;
    if (error)   return <div className="vpt-error">{error}</div>;

    return (
        <>
            {viewersModal && (
                <ViewersModal project={viewersModal} onClose={() => setViewersModal(null)} />
            )}

            <div className="vpt-card-wrap">
                <div className="vpt-header-row">
                    <div className="vpt-block-title">Todos los proyectos — Vista consolidada</div>
                    <div className="vpt-actions">
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Buscar proyectos..."
                            className="vpt-search"
                        />
                            <select
                                value={filters}
                                onChange={e => setFilters(e.target.value)}
                                className='vpt-search'
                            >
                                <option value={"all"}>Filtrar</option>
                                <option value="mayor_riesgo">Mayor riesgo primero</option>
                                <option value="menor_riesgo">Menor riesgo primero</option>
                                <option value="solo_rojo">Solo Rojo</option>
                                <option value="desviacion_negativa">Desviación negativa</option>
                                <option value="Riesgos_actvos">Riesgos activos</option>
                            </select>
                        <button className="vpt-btn-ghost">Exportar</button>
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div className="vpt-empty">
                        {projects.length === 0
                            ? 'No tienes proyectos asignados por el momento.'
                            : 'No hay resultados para la búsqueda.'}
                    </div>
                ) : (
                    <div className="vpt-table-container">
                        <table className="vpt-table">
                            <thead>
                                <tr>
                                    <th className="vpt-th">PROYECTO</th>
                                    <th className="vpt-th">CLIENTE</th>
                                    <th className="vpt-th">PM</th>
                                    <th className="vpt-th">ESTADO</th>
                                    <th className="vpt-th">AVANCE REAL</th>
                                    <th className="vpt-th">ESPERADO</th>
                                    <th className="vpt-th">DESVIACIÓN</th>
                                    <th className="vpt-th">COSTO APROBADO</th>
                                    <th className="vpt-th">RIESGOS ACTIVOS</th>
                                    <th className="vpt-th">SEMÁFORO</th>
                                    <th className="vpt-th">ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((project) => {
                                    const prog           = progressMap[project.id_project] ?? null;
                                    const semaphore      = getSemaphore(prog);
                                    const deviation      = prog?.desviacion ?? null;
                                    const deviationClass = deviation === null ? '' : deviation < 0 ? 'vpt-deviation-negative' : 'vpt-deviation-positive';
                                    const progressColor  = deviation !== null && deviation < -10 ? '#C62828' : '#E07A00';
                                    const deviacionStr   = deviation === null
                                        ? '—'
                                        : deviation > 0
                                            ? `+${deviation.toFixed(2)}%`
                                            : `${deviation.toFixed(2)}%`;

                                    return (
                                        <tr key={project.id_project}>
                                            <td className="vpt-td vpt-project-cell">{project.project_name}</td>
                                            <td className="vpt-td">{project.client_name || 'N/A'}</td>
                                            <td className="vpt-td">PM #{project.id_pm}</td>
                                            <td className="vpt-td">
                                                <span className="vpt-active-pill">Activo</span>
                                            </td>
                                            <td className="vpt-td">
                                                <div className="vpt-progress-wrap">
                                                    <div className="vpt-progress-track">
                                                        <div
                                                            className="vpt-progress-fill"
                                                            style={{
                                                                width: `${prog?.avance_real ?? 0}%`,
                                                                '--vpt-progress-color': progressColor,
                                                            }}
                                                        />
                                                    </div>
                                                    <span>{prog ? `${prog.avance_real.toFixed(2)}%` : '—'}</span>
                                                </div>
                                            </td>
                                            <td className="vpt-td">{prog ? `${prog.avance_esperado.toFixed(2)}%` : '—'}</td>
                                            <td className={`vpt-td ${deviationClass}`}>{deviacionStr}</td>
                                            <td className="vpt-td">
                                                {prog?.costo_aprobado != null
                                                    ? `$${prog.costo_aprobado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                    : <span style={{ color: '#AAA' }}>—</span>
                                                }
                                            </td>
                                            <td className="vpt-td">
                                                {(() => {
                                                    const count = risksMap[project.id_project] ?? null;
                                                    if (count === null) return <span style={{ color: '#AAA' }}>—</span>;
                                                    const label = count > 0
                                                        ? <span style={{ color: '#C62828', fontWeight: 600 }}>{count}</span>
                                                        : <span style={{ color: '#AAA' }}>0</span>;
                                                    if (!isPM) return label;
                                                    return (
                                                        <button
                                                            onClick={() => navigate(`/projects/${project.id_project}/risks`, { state: { projectName: project.project_name } })}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
                                                        >
                                                            {label}
                                                        </button>
                                                    );
                                                })()}
                                            </td>
                                            <td className="vpt-td">
                                                <span
                                                    className="vpt-semaphore-pill"
                                                    style={{
                                                        '--vpt-semaphore-color': semaphore.color,
                                                        '--vpt-semaphore-bg':    semaphore.bg,
                                                    }}
                                                >
                                                    <span
                                                        className="vpt-semaphore-dot"
                                                        style={{ backgroundColor: semaphore.dot }}
                                                    />
                                                    {semaphore.label}
                                                </span>
                                            </td>
                                            <td className="vpt-td">
                                                <div style={{ display:'flex', gap:5 }}>
                                                    <button
                                                        className="vpt-btn-view"
                                                        onClick={() =>
                                                            navigate(`/projects/${project.id_project}/view`, {
                                                                state: { projectName: project.project_name },
                                                            })
                                                        }
                                                    >
                                                        Ver
                                                    </button>

                                                    {isPM && (
                                                        <>
                                                            <button
                                                                className="vpt-btn-view vpt-btn-pm"
                                                                onClick={() => setViewersModal(project)}
                                                            >
                                                                Visores
                                                            </button>
                                                            <button
                                                                className="vpt-btn-view vpt-btn-pm"
                                                                onClick={() =>
                                                                    navigate(`/projects/${project.id_project}/work-items`, {
                                                                        state: { projectName: project.project_name },
                                                                    })
                                                                }
                                                            >
                                                                Items
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="vpt-footer-row">
                    Mostrando {filtered.length} de {projects.length} proyectos
                </div>
            </div>
        </>
    );
}