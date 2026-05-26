// project/my-app/src/features/audit/AuditTable.js
import { ENTITY_COLORS, ENTITY_LABELS, formatWhen, formatValue } from './audit.utils';

export default function AuditTable({ rows, loading, onSelectRow }) {
    if (loading) {
        return <div style={s.empty}>Cargando…</div>;
    }
    if (!rows || rows.length === 0) {
        return <div style={s.empty}>Sin eventos para los filtros actuales.</div>;
    }

    return (
        <div style={s.tableWrap}>
            <table style={s.table}>
                <thead>
                    <tr>
                        <th style={s.th}>Cuándo</th>
                        <th style={s.th}>Usuario</th>
                        <th style={s.th}>Acción</th>
                        <th style={s.th}>Entidad</th>
                        <th style={s.th}>Proyecto</th>
                        <th style={s.th}>Valor anterior</th>
                        <th style={s.th}>Valor nuevo</th>
                        <th style={s.th}></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={r.id} style={s.tr}>
                            <td style={s.td}>{formatWhen(r.when)}</td>
                            <td style={s.td}>{r.who.username || `#${r.who.id ?? '—'}`}</td>
                            <td style={s.td}>{r.action_label}</td>
                            <td style={s.td}>
                                <span style={{ ...s.badge, backgroundColor: ENTITY_COLORS[r.entity] || '#999' }}>
                                    {ENTITY_LABELS[r.entity] || r.entity}
                                </span>
                            </td>
                            <td style={s.td}>{r.project_name || (r.project_id ? `#${r.project_id}` : '—')}</td>
                            <td style={s.tdMono}>{formatValue(r.before)}</td>
                            <td style={s.tdMono}>{formatValue(r.after)}</td>
                            <td style={s.td}>
                                <button style={s.linkBtn} onClick={() => onSelectRow(r)}>Detalle</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

const s = {
    tableWrap: { background:'#FFF', border:'1px solid #E5E5E3', borderRadius:8, overflow:'auto' },
    table:     { width:'100%', borderCollapse:'collapse', fontSize:13 },
    th:        { textAlign:'left', padding:'12px 14px', borderBottom:'1px solid #E5E5E3', fontWeight:600, color:'#555', background:'#FAFAF9', whiteSpace:'nowrap' },
    tr:        { borderBottom:'1px solid #F0F0EE' },
    td:        { padding:'12px 14px', verticalAlign:'top' },
    tdMono:    { padding:'12px 14px', verticalAlign:'top', fontFamily:'ui-monospace, monospace', fontSize:12, color:'#444', maxWidth:280, wordBreak:'break-word' },
    badge:     { display:'inline-block', padding:'2px 8px', borderRadius:4, color:'#FFF', fontSize:11, fontWeight:500 },
    linkBtn:   { background:'none', border:'none', color:'#3B82F6', cursor:'pointer', fontSize:13, padding:0 },
    empty:     { padding:32, textAlign:'center', color:'#888', background:'#FFF', border:'1px solid #E5E5E3', borderRadius:8 },
};
