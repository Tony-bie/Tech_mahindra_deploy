// project/my-app/src/features/audit/AuditFilters.js
import { ACTION_OPTIONS, ENTITY_OPTIONS } from './audit.utils';

export default function AuditFilters({ value, onChange, onReset, hideProjectId = false }) {
    const set = (k, v) => onChange({ ...value, [k]: v, offset: 0 });

    return (
        <div style={s.row}>
            <select style={s.input} value={value.entity} onChange={e => set('entity', e.target.value)}>
                {ENTITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <select style={s.input} value={value.action} onChange={e => set('action', e.target.value)}>
                {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {!hideProjectId && (
                <input
                    style={s.input}
                    type="number"
                    min="1"
                    placeholder="ID de proyecto"
                    value={value.project_id}
                    onChange={e => set('project_id', e.target.value)}
                />
            )}

            <input
                style={s.input}
                type="date"
                value={value.from}
                onChange={e => set('from', e.target.value)}
                aria-label="Desde"
            />

            <input
                style={s.input}
                type="date"
                value={value.to}
                onChange={e => set('to', e.target.value)}
                aria-label="Hasta"
            />

            <button style={s.reset} onClick={onReset}>Limpiar</button>
        </div>
    );
}

const s = {
    row:   { display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:16 },
    input: { padding:'8px 10px', border:'1px solid #E5E5E3', borderRadius:6, fontSize:13, fontFamily:'inherit', background:'#FFF' },
    reset: { padding:'8px 14px', border:'1px solid #E5E5E3', borderRadius:6, background:'#FFF', cursor:'pointer', fontSize:13 },
};
