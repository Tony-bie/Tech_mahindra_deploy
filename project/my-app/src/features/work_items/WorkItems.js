import { useState, useEffect, useCallback } from 'react';
import api from '../../config/api';
import ws from '../../config/ws';
import './WorkItems.css';

function getInitials(username = '') {
    return username.slice(0, 2).toUpperCase() || '?';
}

function StatusPill({ status }) {
    const labels = { todo: 'Por hacer', in_progress: 'En progreso', done: 'Completado' };
    const label = labels[status] || status;
    return (
        <span className={`wi-status wi-status--${status}`}>{label}</span>
    );
}

export default function WorkItems({ projectId, projectName }) {
    const [items,           setItems]           = useState([]);
    const [sprints,         setSprints]         = useState([]);
    const [assignableUsers, setAssignableUsers] = useState([]);
    const [loading,         setLoading]         = useState(true);
    const [message,         setMessage]         = useState({ text: '', type: '' });

    const [newTitle,       setNewTitle]       = useState('');
    const [newDesc,        setNewDesc]        = useState('');
    const [selectedSprint, setSelectedSprint] = useState('');
    const [creating,       setCreating]       = useState(false);

    const loadItems = useCallback(async () => {
        try {
            const { res, data } = await api.get(`/work-items?project_id=${projectId}`);
            if (res.ok) setItems(data.items || []);
            else showMsg(data.message || 'Error cargando ítems', 'error');
        } catch {
            showMsg('Error de conexión al cargar ítems', 'error');
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

    useEffect(() => {
        const handler = ({ data }) => {
            const msg = JSON.parse(data);
            if (msg.type === 'WORK_ITEM_CREATED') {
                setItems(prev => [...prev, msg.data]);
            }
        };
        ws.addEventListener('message', handler);
        return () => ws.removeEventListener('message', handler);
    }, []);

    function showMsg(text, type = 'success') {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    }

    async function handleCreate(e) {
        e.preventDefault();
        if (!newTitle.trim())  { showMsg('El título es obligatorio', 'error'); return; }
        if (!selectedSprint)   { showMsg('Selecciona un sprint', 'error'); return; }

        setCreating(true);
        try {
            const { res, data } = await api.post('/work-items', {
                id_project:  parseInt(projectId),
                id_sprint:   parseInt(selectedSprint),
                title:       newTitle.trim(),
                description: newDesc.trim() || null,
            });
            if (res.ok) {
                setNewTitle('');
                setNewDesc('');
                showMsg('Ítem creado correctamente');
                loadItems();
                ws.send(JSON.stringify({ type: 'WORK_ITEM_CREATED', data: data.item }));
            } else {
                showMsg(data.message || 'Error creando ítem', 'error');
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

    if (loading) return <div className="wi-loading">Cargando ítems...</div>;

    return (
        <div>
            {/* Encabezado */}
            <div className="wi-heading">
                <h1>Ítems de trabajo — {projectName}</h1>
                <p>Asigna ítems a los visores vinculados al proyecto o a ti mismo.</p>
            </div>

            {/* Toast */}
            {message.text && (
                <div className={`wi-toast wi-toast--${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* Formulario de creación */}
            <div className="wi-card">
                <div className="wi-card-header">
                    <div className="wi-section-label">Nuevo ítem</div>
                </div>
                <form className="wi-form" onSubmit={handleCreate}>
                    <div className="wi-form-grid">
                        <div className="wi-form-field">
                            <label>Sprint</label>
                            <select
                                className="wi-select"
                                value={selectedSprint}
                                onChange={e => setSelectedSprint(e.target.value)}
                            >
                                <option value="">— Seleccionar —</option>
                                {sprints.map(sp => (
                                    <option key={sp.id_sprint} value={sp.id_sprint}>
                                        {sp.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="wi-form-field">
                            <label>Título *</label>
                            <input
                                className="wi-input"
                                type="text"
                                placeholder="Nombre del ítem"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                            />
                        </div>

                        <div className="wi-form-field">
                            <label>Descripción</label>
                            <input
                                className="wi-input"
                                type="text"
                                placeholder="Opcional"
                                value={newDesc}
                                onChange={e => setNewDesc(e.target.value)}
                            />
                        </div>

                        <button className="wi-btn-create" type="submit" disabled={creating}>
                            {creating ? 'Creando...' : 'Crear ítem'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Tabla de ítems */}
            <div className="wi-card">
                <div className="wi-count-row">
                    <span className="wi-count">Ítems del proyecto</span>
                    <span className="wi-section-label">{items.length} ítems</span>
                </div>

                {items.length === 0 ? (
                    <div className="wi-empty">
                        <div className="wi-empty-icon">◻</div>
                        <p>No hay ítems todavía. Crea el primero arriba.</p>
                    </div>
                ) : (
                    <div className="wi-table-wrap">
                        <table className="wi-table">
                            <thead>
                                <tr>
                                    <th className="wi-th wi-th--num">#</th>
                                    <th className="wi-th">Título</th>
                                    <th className="wi-th">Descripción</th>
                                    <th className="wi-th wi-th--sm">Sprint</th>
                                    <th className="wi-th wi-th--sm">Estado</th>
                                    <th className="wi-th wi-th--med">Responsable</th>
                                    <th className="wi-th wi-th--med">Reasignar</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => {
                                    const sprint = sprints.find(sp => sp.id_sprint === item.id_sprint);
                                    return (
                                        <tr key={item.id_work_item} className="wi-tr">
                                            <td className="wi-td wi-td--num">{idx + 1}</td>
                                            <td className="wi-td wi-td--title">{item.title}</td>
                                            <td className="wi-td wi-td--desc">
                                                <span>{item.description || '—'}</span>
                                            </td>
                                            <td className="wi-td">
                                                <span className="wi-sprint-tag">
                                                    {sprint?.name || `Sprint #${item.id_sprint}`}
                                                </span>
                                            </td>
                                            <td className="wi-td">
                                                <StatusPill status={item.status} />
                                            </td>
                                            <td className="wi-td">
                                                {item.assignee ? (
                                                    <div className="wi-assignee">
                                                        <div className="wi-assignee-avatar">
                                                            {getInitials(item.assignee.username)}
                                                        </div>
                                                        <span className="wi-assignee-name">
                                                            {item.assignee.username}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="wi-unassigned">Sin asignar</span>
                                                )}
                                            </td>
                                            <td className="wi-td">
                                                <select
                                                    className="wi-reassign-select"
                                                    value={item.assignee_id || ''}
                                                    onChange={e => handleAssign(item.id_work_item, e.target.value)}
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
