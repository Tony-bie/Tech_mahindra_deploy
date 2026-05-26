// project/my-app/src/features/audit/AuditDetailModal.js
import { formatWhen } from './audit.utils';

export default function AuditDetailModal({ row, onClose }) {
    if (!row) return null;
    return (
        <div style={s.backdrop} onClick={onClose}>
            <div style={s.modal} onClick={e => e.stopPropagation()}>
                <div style={s.header}>
                    <h2 style={s.title}>Detalle del evento</h2>
                    <button style={s.close} onClick={onClose} aria-label="Cerrar">×</button>
                </div>
                <div style={s.body}>
                    <Field label="Cuándo"  value={formatWhen(row.when)} />
                    <Field label="Usuario" value={row.who.username || `#${row.who.id ?? '—'}`} />
                    <Field label="Acción"  value={`${row.action_label} (${row.action})`} />
                    <Field label="Entidad" value={`${row.entity} #${row.entity_id || '—'}`} />
                    <Field label="Proyecto" value={row.project_name || (row.project_id ? `#${row.project_id}` : '—')} />
                    <div style={s.diffWrap}>
                        <div style={s.diffCol}>
                            <div style={s.diffLabel}>Valor anterior</div>
                            <pre style={s.pre}>{row.before ? JSON.stringify(row.before, null, 2) : '—'}</pre>
                        </div>
                        <div style={s.diffCol}>
                            <div style={s.diffLabel}>Valor nuevo</div>
                            <pre style={s.pre}>{row.after ? JSON.stringify(row.after, null, 2) : '—'}</pre>
                        </div>
                    </div>
                    <details style={s.details}>
                        <summary style={s.summary}>Payload completo (debug)</summary>
                        <pre style={s.pre}>{JSON.stringify(row.raw_payload, null, 2)}</pre>
                    </details>
                </div>
            </div>
        </div>
    );
}

function Field({ label, value }) {
    return (
        <div style={s.field}>
            <span style={s.fieldLabel}>{label}</span>
            <span style={s.fieldValue}>{value}</span>
        </div>
    );
}

const s = {
    backdrop:   { position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
    modal:      { background:'#FFF', borderRadius:8, width:'min(720px,90vw)', maxHeight:'90vh', overflow:'auto', boxShadow:'0 10px 40px rgba(0,0,0,0.2)' },
    header:     { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 24px', borderBottom:'1px solid #E5E5E3' },
    title:      { margin:0, fontSize:18, fontWeight:600 },
    close:      { background:'none', border:'none', fontSize:24, cursor:'pointer', color:'#888', lineHeight:1 },
    body:       { padding:24 },
    field:      { display:'flex', gap:12, marginBottom:8, fontSize:13 },
    fieldLabel: { fontWeight:600, minWidth:90, color:'#555' },
    fieldValue: { color:'#1A1A1A' },
    diffWrap:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16 },
    diffCol:    { background:'#FAFAF9', border:'1px solid #E5E5E3', borderRadius:6, padding:12 },
    diffLabel:  { fontSize:12, fontWeight:600, color:'#555', marginBottom:6 },
    pre:        { margin:0, fontSize:12, fontFamily:'ui-monospace, monospace', whiteSpace:'pre-wrap', wordBreak:'break-word', color:'#1A1A1A' },
    details:    { marginTop:16 },
    summary:    { cursor:'pointer', fontSize:13, color:'#3B82F6', marginBottom:8 },
};
