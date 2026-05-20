import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuthContext } from '../../shared/context/AuthContext';
import api from '../../config/api';
import './ViewerProjectBacklogPage.css';

const STATUS_LABELS = {
    todo: 'Por hacer',
    in_progress: 'En curso',
    done: 'Finalizada',
};

const TYPE_LABELS = {
    user_story: 'Historia',
    task: 'Tarea',
    bug: 'Bug',
};

function statusBadgeColors(status) {
    if (status === 'done') return { color: '#3C9A57', bg: '#E9F7ED' };
    if (status === 'in_progress') return { color: '#3162D1', bg: '#E7EEFF' };
    return { color: '#7E8693', bg: '#EEF1F5' };
}

function typeBadgeColors(type) {
    if (type === 'bug') return { color: '#B94A48', bg: '#FCE9E9' };
    if (type === 'user_story') return { color: '#3162D1', bg: '#E7EEFF' };
    return { color: '#3C9A57', bg: '#E9F7ED' };
}

function initialsFrom(name) {
    const parts = String(name || '').split(' ').filter(Boolean);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

export default function ViewerProjectBacklogPage() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuthContext();
    const projectName = location.state?.projectName || `Proyecto ${id}`;

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ text: '', type: '' });

    const loadItems = useCallback(async () => {
        try {
            const { res, data } = await api.get(`/work-items?project_id=${id}`);
            if (res.ok) {
                setItems(data.items || []);
            } else {
                setMessage({ text: data.message || 'Error cargando items', type: 'error' });
            }
        } catch {
            setMessage({ text: 'Error de conexión con el servidor', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { loadItems(); }, [loadItems]);

    async function handleStatusChange(itemId, newStatus) {
        setMessage({ text: '', type: '' });
        try {
            const { res, data } = await api.patch(`/work-items/${itemId}/status`, { status: newStatus });
            if (res.ok) {
                setMessage({ text: 'Estado actualizado', type: 'success' });
                loadItems();
            } else {
                setMessage({ text: data.message || 'Error actualizando estado', type: 'error' });
            }
        } catch {
            setMessage({ text: 'Error de conexión', type: 'error' });
        }
    }

    if (loading) {
        return (
            <div className="vpb-page">
                <div className="vpb-content-wrap" style={{ textAlign: 'center', paddingTop: 60, color: '#888' }}>
                    Cargando items...
                </div>
            </div>
        );
    }

    return (
        <div className="vpb-page">
            <div className="vpb-top-bar">
                <div className="vpb-breadcrumb">
                    <span className="vpb-crumb-accent">{projectName}</span>
                    <span>/</span>
                    <span>Backlog</span>
                </div>
                <button className="vpb-back-btn" onClick={() => navigate(`/projects`)}>
                    ← Volver a proyectos
                </button>
            </div>

            <div className="vpb-content-wrap">
                <h1 className="vpb-title">Items del proyecto</h1>

                {message.text && (
                    <div style={{
                        padding: '10px 14px',
                        marginBottom: 14,
                        borderRadius: 4,
                        fontSize: 13,
                        backgroundColor: message.type === 'error' ? '#FFF5F5' : '#F1F8E9',
                        border: `1px solid ${message.type === 'error' ? '#FFCDD2' : '#C5E1A5'}`,
                        color: message.type === 'error' ? '#B71C1C' : '#33691E',
                    }}>
                        {message.text}
                    </div>
                )}

                <div className="vpb-table-card">
                    <div className="vpb-table-scroll">
                        <table className="vpb-table">
                            <thead>
                                <tr>
                                    <th className="vpb-th-item">ITEM</th>
                                    <th className="vpb-th">TIPO</th>
                                    <th className="vpb-th">SP</th>
                                    <th className="vpb-th">ESTADO</th>
                                    <th className="vpb-th">RESPONSABLE</th>
                                    <th className="vpb-th">CAMBIAR ESTADO</th>
                                    <th className="vpb-th"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#888', fontSize: 13 }}>
                                            Sin items en este proyecto
                                        </td>
                                    </tr>
                                ) : (
                                    items.map(item => {
                                        const type = typeBadgeColors(item.type);
                                        const status = statusBadgeColors(item.status);
                                        const isMyItem = item.assignee_id === user?.id;
                                        const assigneeName = item.assignee?.username || 'Sin asignar';

                                        return (
                                            <tr key={item.id_work_item} className={isMyItem && item.status === 'in_progress' ? 'vpb-highlight-row' : ''}>
                                                <td className="vpb-td-item">
                                                    <div style={{ fontWeight: 500 }}>{item.title}</div>
                                                    {item.description && (
                                                        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{item.description}</div>
                                                    )}
                                                </td>
                                                <td className="vpb-td">
                                                    <span className="vpb-pill" style={{ color: type.color, backgroundColor: type.bg }}>
                                                        {TYPE_LABELS[item.type] || item.type}
                                                    </span>
                                                </td>
                                                <td className="vpb-td-strong">{item.story_points ?? 0}</td>
                                                <td className="vpb-td">
                                                    <span className="vpb-pill" style={{ color: status.color, backgroundColor: status.bg }}>
                                                        {STATUS_LABELS[item.status] || item.status}
                                                    </span>
                                                </td>
                                                <td className="vpb-td">
                                                    <div className="vpb-assignee-wrap">
                                                        <span className="vpb-avatar">{initialsFrom(assigneeName)}</span>
                                                        <span>{assigneeName}</span>
                                                    </div>
                                                </td>
                                                <td className="vpb-td">
                                                    {isMyItem ? (
                                                        <select
                                                            value={item.status}
                                                            onChange={(e) => handleStatusChange(item.id_work_item, e.target.value)}
                                                            style={{
                                                                height: 28,
                                                                padding: '0 8px',
                                                                fontSize: 11,
                                                                border: '1px solid #DEDAD0',
                                                                borderRadius: 5,
                                                                backgroundColor: '#FFF',
                                                                cursor: 'pointer',
                                                            }}
                                                        >
                                                            <option value="todo">Por hacer</option>
                                                            <option value="in_progress">En curso</option>
                                                            <option value="done">Finalizada</option>
                                                        </select>
                                                    ) : (
                                                        <span style={{ fontSize: 11, color: '#AAA' }}>—</span>
                                                    )}
                                                </td>
                                                <td className="vpb-td">
                                                    <button
                                                        onClick={() => navigate(
                                                            `/projects/${id}/backlog/${item.id_work_item}`,
                                                            { state: { projectName, item } }
                                                        )}
                                                        style={{
                                                            height: 28,
                                                            padding: '0 12px',
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            border: '1px solid #DEDAD0',
                                                            borderRadius: 5,
                                                            backgroundColor: '#FFF',
                                                            color: '#555',
                                                            cursor: 'pointer',
                                                        }}
                                                    >
                                                        Ver
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}