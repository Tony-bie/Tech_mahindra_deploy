import { useState, useEffect, useCallback } from 'react';
import api from '../../config/api';
import ws from '../../config/ws';

/**
 * HU-09 — Asignación de work items a viewer o al propio PM
 *
 * Props:
 *   - projectId:   id del proyecto
 *   - projectName: nombre para el encabezado
 *   - currentUser: { id_user | id, username, role }
 */
function WorkItems({ projectId, projectName }) {
    const [items,           setItems]           = useState([]);
    const [sprints,         setSprints]         = useState([]);
    const [assignableUsers, setAssignableUsers] = useState([]);
    const [loading,         setLoading]         = useState(true);
    const [message,         setMessage]         = useState({ text: '', type: '' });

    // Form estado
    const [newTitle,       setNewTitle]       = useState('');
    const [newDesc,        setNewDesc]        = useState('');
    const [selectedSprint, setSelectedSprint] = useState('');
    const [creating,       setCreating]       = useState(false);

    /* ── Loaders ──────────────────────────────────────────── */

    const loadItems = useCallback(async () => {
        try {
            const { res, data } = await api.get(`/work-items?project_id=${projectId}`);
            if (res.ok) setItems(data.items || []);
            else showMsg(data.message || 'Error cargando items', 'error');
        } catch {
            showMsg('Error de conexión al cargar items', 'error');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    const loadSprints = useCallback(async () => {
        try {
            const res = await api.get(`/sprints/${projectId}/get-sprints`);
            const data = res.data?.data || res.data || [];
            setSprints(Array.isArray(data) ? data : []);
        } catch {}
    }, [projectId]);

    const loadAssignableUsers = useCallback(async () => {
        try {
            const { res, data } = await api.get(`/projects/${projectId}/assignable`);
            if (res.ok) setAssignableUsers(data.assignable || []);
        } catch {}
    }, [projectId]);

    useEffect(() => {
        loadItems();
        loadSprints();
        loadAssignableUsers();
    }, [loadItems, loadSprints, loadAssignableUsers]);

    /* ── Helpers ──────────────────────────────────────────── */

    function showMsg(text, type = 'success') {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    }

    /* ── Acciones ─────────────────────────────────────────── */

    async function handleCreate(e) {
        e.preventDefault();
        if (!newTitle.trim())   { showMsg('El título es obligatorio', 'error'); return; }
        if (!selectedSprint)    { showMsg('Selecciona un sprint', 'error'); return; }

        setCreating(true);
        try {
            const { res, data } = await api.post('/work-items', {
                id_project:  parseInt(projectId),
                id_sprint:   parseInt(selectedSprint),
                title:       newTitle.trim(),
                description: newDesc.trim() || null,
            });
            console.log('res: ',res, 'data: ', data)
            if (res.ok) {
                setNewTitle('');
                setNewDesc('');
                showMsg('Item creado correctamente');
                loadItems();
                ws.send(JSON.stringify({type: "WORK_ITEM_CREATED", data: data.item}))
            } else {
                showMsg(data.message || 'Error creando item', 'error');
            }
        } catch {
            showMsg('Error de conexión', 'error');
        } finally {
            setCreating(false);
        }
    }

    async function handleAssign(itemId, newAssigneeId) {
        const payload = { assignee_id: newAssigneeId === '' ? null : parseInt(newAssigneeId) };
        try {
            const { res, data } = await api.patch(`/work-items/${itemId}/assignee`, payload);
            if (res.ok) {
                showMsg('Responsable actualizado');
                loadItems();
            } else {
                showMsg(data.message || 'Error reasignando', 'error');
            }
        } catch {
            showMsg('Error de conexión', 'error');
        }
    }

    useEffect(() => {
        const work_item_handler = ({data}) => {
            const message = JSON.parse(data)
            if(message.type === 'WORK_ITEM_CREATED') {
                const newWorkITem = message.data
                setItems(prev => [...prev, newWorkITem])
            }
        }

        ws.addEventListener('message', work_item_handler)

        return() => ws.removeEventListener('message', work_item_handler)
    }, [])

    /* ── Render ───────────────────────────────────────────── */

    if (loading) return <div style={s.loading}>Cargando items...</div>;

    return (
        <div>
            <h1 style={s.title}>Work Items — {projectName}</h1>
            <p style={s.subtitle}>
                Asigna items a los visores vinculados al proyecto o a ti mismo (HU-09).
            </p>

            {message.text && (
                <div style={message.type === 'error' ? s.msgError : s.msgSuccess}>
                    {message.text}
                </div>
            )}

            {/* ── Crear item ──────────────────────────────── */}
            <div style={s.card}>
                <div style={s.sectionLabel}>NUEVO ITEM</div>
                <div style={s.formRow}>
                    {/* Sprint selector */}
                    <select
                        style={{ ...s.input, minWidth: 180, flex: 'none' }}
                        value={selectedSprint}
                        onChange={e => setSelectedSprint(e.target.value)}
                    >
                        <option value="">— Sprint * —</option>
                        {sprints.map(sp => (
                            <option key={sp.id_sprint} value={sp.id_sprint}>
                                {sp.name}
                            </option>
                        ))}
                    </select>

                    <input
                        type="text"
                        placeholder="Título del item *"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        style={s.input}
                    />
                    <input
                        type="text"
                        placeholder="Descripción (opcional)"
                        value={newDesc}
                        onChange={e => setNewDesc(e.target.value)}
                        style={s.input}
                    />
                    <button onClick={handleCreate} style={s.btnPrimary} disabled={creating}>
                        {creating ? 'Creando...' : 'Crear item'}
                    </button>
                </div>
            </div>

            {/* ── Lista de items ──────────────────────────── */}
            <div style={s.card}>
                <div style={s.sectionLabel}>ITEMS DEL PROYECTO ({items.length})</div>
                {items.length === 0 ? (
                    <div style={s.emptyMsg}>No hay items todavía. Crea el primero arriba.</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={s.table}>
                            <thead>
                                <tr>
                                    <th style={s.th}>#</th>
                                    <th style={s.th}>Título</th>
                                    <th style={s.th}>Descripción</th>
                                    <th style={s.th}>Sprint</th>
                                    <th style={s.th}>Estado</th>
                                    <th style={s.th}>Responsable actual</th>
                                    <th style={s.th}>Reasignar a</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => {
                                    const sprint = sprints.find(sp => sp.id_sprint === item.id_sprint);
                                    return (
                                        <tr key={item.id_work_item} style={idx % 2 === 0 ? {} : { backgroundColor: '#FAFAF9' }}>
                                            <td style={{ ...s.td, color: '#AAA', width: 28 }}>{idx + 1}</td>
                                            <td style={{ ...s.td, fontWeight: 500 }}>{item.title}</td>
                                            <td style={{ ...s.td, color: '#888' }}>{item.description || '—'}</td>
                                            <td style={{ ...s.td, color: '#555', fontSize: 11 }}>
                                                {sprint?.name || `#${item.id_sprint}`}
                                            </td>
                                            <td style={s.td}>
                                                <span style={statusStyle(item.status)}>
                                                    {statusLabel(item.status)}
                                                </span>
                                            </td>
                                            <td style={s.td}>
                                                {item.assignee
                                                    ? <span style={s.assigneeBadge}>{item.assignee.username}</span>
                                                    : <span style={s.unassigned}>Sin asignar</span>}
                                            </td>
                                            <td style={s.td}>
                                                <select
                                                    value={item.assignee_id || ''}
                                                    onChange={e => handleAssign(item.id_work_item, e.target.value)}
                                                    style={s.select}
                                                >
                                                    <option value="">— Sin asignar —</option>
                                                    {assignableUsers.map(u => (
                                                        <option key={u.id_user} value={u.id_user}>
                                                            {u.username} ({u.projectRole === 'pm' ? 'PM' : 'Visor'})
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function statusLabel(s) {
    return { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }[s] || s;
}

function statusStyle(status) {
    const base = { display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600 };
    if (status === 'done')        return { ...base, backgroundColor: '#E7F6EA', color: '#2E7D32' };
    if (status === 'in_progress') return { ...base, backgroundColor: '#E7EEFF', color: '#2453C9' };
    return { ...base, backgroundColor: '#F5F5F4', color: '#666' };
}

const s = {
    title:         { fontSize: 22, fontWeight: 700, marginBottom: 4 },
    subtitle:      { fontSize: 13, color: '#888', marginBottom: 28 },
    loading:       { padding: 40, textAlign: 'center', color: '#888' },
    msgError:      { padding: '10px 14px', backgroundColor: '#FFF5F5', border: '1px solid #FFCDD2', borderRadius: 6, color: '#B71C1C', fontSize: 13, marginBottom: 20 },
    msgSuccess:    { padding: '10px 14px', backgroundColor: '#F1F8E9', border: '1px solid #C5E1A5', borderRadius: 6, color: '#33691E', fontSize: 13, marginBottom: 20 },
    card:          { backgroundColor: '#FFF', border: '1px solid #E8E8E6', borderRadius: 8, padding: '20px 24px', marginBottom: 20 },
    sectionLabel:  { fontSize: 11, fontWeight: 700, color: '#555', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 },
    formRow:       { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
    input:         { flex: 1, minWidth: 140, height: 34, padding: '0 10px', fontSize: 13, border: '1px solid #E0E0DE', borderRadius: 4, backgroundColor: '#FAFAFA' },
    btnPrimary:    { height: 34, padding: '0 20px', backgroundColor: '#CC0000', color: '#FFF', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
    table:         { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 },
    th:            { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #E8E8E6', fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em' },
    td:            { padding: '10px 10px', borderBottom: '1px solid #F0EEE8', verticalAlign: 'middle' },
    assigneeBadge: { display: 'inline-block', padding: '2px 10px', backgroundColor: '#E7EEFF', color: '#2453C9', borderRadius: 999, fontSize: 11, fontWeight: 600 },
    unassigned:    { color: '#BBB', fontStyle: 'italic', fontSize: 12 },
    select:        { height: 28, padding: '0 6px', fontSize: 12, border: '1px solid #E0E0DE', borderRadius: 4, backgroundColor: '#FAFAFA', maxWidth: 200 },
    emptyMsg:      { fontSize: 13, color: '#AAA', padding: '16px 0' },
};

export default WorkItems;