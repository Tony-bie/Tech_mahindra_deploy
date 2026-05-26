// project/my-app/src/features/audit/AuditPage.js
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../config/api';
import AuditFilters from './AuditFilters';
import AuditTable from './AuditTable';
import AuditDetailModal from './AuditDetailModal';

const PAGE_SIZE = 50;

function buildEmptyFilters(fixedProjectId) {
    return {
        entity:     '',
        action:     '',
        project_id: fixedProjectId ?? '',
        user_id:    '',
        from:       '',
        to:         '',
        limit:      PAGE_SIZE,
        offset:     0,
    };
}

export default function AuditPage() {
    const params           = useParams();
    const fixedProjectId   = params.id ? parseInt(params.id, 10) : null;
    const isPerProject     = fixedProjectId !== null && !Number.isNaN(fixedProjectId);

    const initial = useMemo(() => buildEmptyFilters(isPerProject ? fixedProjectId : null), [isPerProject, fixedProjectId]);

    const [filters, setFilters]   = useState(initial);
    const [rows, setRows]         = useState([]);
    const [total, setTotal]       = useState(0);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState(null);
    const [selected, setSelected] = useState(null);

    // Reinicia filtros cuando cambia el proyecto (navegar de /projects/1/audit a /projects/2/audit)
    useEffect(() => { setFilters(initial); }, [initial]);

    const fetchAudit = useCallback(async (f) => {
        setLoading(true);
        setError(null);
        const qs = Object.entries(f)
            .filter(([, v]) => v !== '' && v !== null && v !== undefined)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');
        const { res, data } = await api.get(`/audit?${qs}`);
        if (!res.ok) {
            setError(data.message || 'Error cargando bitácora');
            setRows([]);
            setTotal(0);
        } else {
            setRows(data.rows || []);
            setTotal(data.total || 0);
        }
        setLoading(false);
    }, []);

    useEffect(() => { fetchAudit(filters); }, [filters, fetchAudit]);

    // En modo por-proyecto, cualquier reseteo desde filtros DEBE conservar el project_id fijo.
    const handleFiltersChange = (next) => {
        if (isPerProject) {
            setFilters({ ...next, project_id: fixedProjectId });
        } else {
            setFilters(next);
        }
    };

    const handleReset = () => setFilters(initial);

    const nextPage = () => setFilters(f => ({ ...f, offset: f.offset + PAGE_SIZE }));
    const prevPage = () => setFilters(f => ({ ...f, offset: Math.max(0, f.offset - PAGE_SIZE) }));

    const start = filters.offset + 1;
    const end   = Math.min(filters.offset + rows.length, total);

    const title    = isPerProject ? 'Bitácora del proyecto' : 'Bitácora de auditoría';
    const subtitle = isPerProject
        ? `Eventos del proyecto #${fixedProjectId}. Solo lectura.`
        : 'Registro inmutable de cambios sensibles. Solo lectura.';

    return (
        <div style={s.page}>
            <div style={s.topBar}>
                <div style={s.breadcrumb}>
                    {isPerProject ? (
                        <>
                            <span>Inicio</span>
                            <span style={{ color:'#CCC' }}>/</span>
                            <span>Proyectos</span>
                            <span style={{ color:'#CCC' }}>/</span>
                            <span>#{fixedProjectId}</span>
                            <span style={{ color:'#CCC' }}>/</span>
                            <span style={{ color:'#1A1A1A', fontWeight:500 }}>Bitácora</span>
                        </>
                    ) : (
                        <>
                            <span>Inicio</span>
                            <span style={{ color:'#CCC' }}>/</span>
                            <span style={{ color:'#1A1A1A', fontWeight:500 }}>Bitácora</span>
                        </>
                    )}
                </div>
            </div>

            <div style={s.body}>
                <h1 style={s.h1}>{title}</h1>
                <p style={s.subtitle}>{subtitle}</p>

                <AuditFilters
                    value={filters}
                    onChange={handleFiltersChange}
                    onReset={handleReset}
                    hideProjectId={isPerProject}
                />

                {error && <div style={s.error}>{error}</div>}

                <AuditTable rows={rows} loading={loading} onSelectRow={setSelected} />

                <div style={s.pager}>
                    <span style={s.pagerInfo}>
                        {total === 0 ? 'Sin resultados' : `Mostrando ${start}–${end} de ${total}`}
                    </span>
                    <div style={{ display:'flex', gap:8 }}>
                        <button style={s.pageBtn} onClick={prevPage} disabled={filters.offset === 0}>← Anterior</button>
                        <button style={s.pageBtn} onClick={nextPage} disabled={filters.offset + rows.length >= total}>Siguiente →</button>
                    </div>
                </div>

                <AuditDetailModal row={selected} onClose={() => setSelected(null)} />
            </div>
        </div>
    );
}

const s = {
    page:       { minHeight:'100vh', backgroundColor:'#F5F5F4', fontFamily:"'DM Sans',sans-serif" },
    topBar:     { backgroundColor:'#FFF', borderBottom:'1px solid #E5E5E3', padding:'0 32px', height:56, display:'flex', alignItems:'center' },
    breadcrumb: { display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#888' },
    body:       { padding:32 },
    h1:         { fontSize:22, fontWeight:700, marginBottom:4 },
    subtitle:   { fontSize:13, color:'#888', marginBottom:24 },
    error:      { padding:12, background:'#FEE2E2', color:'#991B1B', borderRadius:6, marginBottom:16, fontSize:13 },
    pager:      { display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16 },
    pagerInfo:  { fontSize:13, color:'#666' },
    pageBtn:    { padding:'8px 14px', border:'1px solid #E5E5E3', borderRadius:6, background:'#FFF', cursor:'pointer', fontSize:13 },
};
