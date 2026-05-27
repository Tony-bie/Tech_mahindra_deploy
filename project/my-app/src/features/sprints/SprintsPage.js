import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../config/api';
import { useAuthContext } from '../../shared/context/AuthContext';
import CreateSprint from './CreateSprint';
import './SprintsPage.css';
import ws from '../../config/ws';


function statusLabel(status) {
    return { planned: 'Planificado', active: 'Activo', done: 'Completado', cancelled: 'Cancelado' }[status] || status;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysRemaining(deadline, status) {
    if (!deadline || status === 'done' || status === 'cancelled') return null;
    const diff = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
}

export default function SprintsPage() {
    const { user }     = useAuthContext();
    const navigate     = useNavigate();
    const location     = useLocation();
    const { id }       = useParams();

    const [tasksByStatus, setTasksByStatus] = useState(null);
    const [loading, setLoading]             = useState(true);
    const [isPanelOpen, setIsPanelOpen]     = useState(false);
    const [statusFilter, setStatusFilter]   = useState('all_sprints');

    const projectName = location.state?.projectName || `Proyecto ${id}`;

    function buildFilterStatus(data) {
        return {
            all_sprints: data,
            planned:     data.filter(t => t.status === 'planned'),
            active:      data.filter(t => t.status === 'active'),
            cancelled:   data.filter(t => t.status === 'cancelled'),
            done:        data.filter(t => t.status === 'done'),
        };
    }

    useEffect(() => {
        async function consultSprint() {
            try {
                const sprint = await api.get(`/sprints/${id}/get-sprints`);
                if (!sprint) return;
                const data = sprint.data.data;
                if (!data) return;
                setTasksByStatus(buildFilterStatus(data));
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        }
        consultSprint();

        const handler = ({ data }) => {
            const mensaje = JSON.parse(data);
            if (mensaje.type === 'SPRINT_CREATED') {
                const newSprint = mensaje.data[0];
                setTasksByStatus(prev => ({
                    ...prev,
                    all_sprints: [...prev.all_sprints, newSprint],
                    [newSprint.status]: [...prev[newSprint.status], newSprint],
                }));
            }
        };

        ws.addEventListener('message', handler);
        return () => ws.removeEventListener('message', handler);
    }, [id]);

    const filteredSprints = tasksByStatus?.[statusFilter] ?? [];

    return (
        <>
            <div className="topBar">
                <div className="breadCrumb">
                    <button className="crumbBtn" onClick={() => navigate('/projects')}>
                        Proyectos
                    </button>
                    <span className="sep">/</span>
                    <button
                        className="crumbBtn"
                        onClick={() => navigate(`/projects/${id}/view`, { state: { projectName } })}
                    >
                        {projectName}
                    </button>
                    <span className="sep">/</span>
                    <span className="crumbCurrent">Sprints</span>
                </div>

                {(user.role === 'pm' || user.role === 'admin') && (
                    <button className="btn-new-sprint" onClick={() => setIsPanelOpen(true)}>
                        + Crear sprint
                    </button>
                )}
            </div>

            <div className="sprint-layout">
                <div className="sprint-page-header">
                    <h1 className="sprint-header">Sprints</h1>
                    {tasksByStatus && (
                        <span className="sprint-count">{tasksByStatus.all_sprints.length} sprint{tasksByStatus.all_sprints.length !== 1 ? 's' : ''}</span>
                    )}
                </div>

                <div className="sprint-toolbar">
                    <div className="sprint-toolbar-left">
                        <label htmlFor="status">Filtrar por estado</label>
                        <select id="status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                            <option value="all_sprints">Todos</option>
                            <option value="planned">Planificado</option>
                            <option value="active">Activo</option>
                            <option value="cancelled">Cancelado</option>
                            <option value="done">Completado</option>
                        </select>
                    </div>
                </div>

                <div className="sprint-table-card">
                    {loading ? (
                        <div className="sprint-state">Cargando sprints...</div>
                    ) : filteredSprints.length === 0 ? (
                        <div className="sprint-state">
                            No hay sprints {statusFilter !== 'all_sprints' ? `con el filtro seleccionado` : 'en este proyecto'}.
                        </div>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Sprint</th>
                                    <th>Inicio</th>
                                    <th>Fin</th>
                                    <th>SP estimados</th>
                                    <th>Estado</th>
                                    <th>Tiempo</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSprints.map(sprint => {
                                    const days = daysRemaining(sprint.deadline, sprint.status);
                                    return (
                                        <tr key={sprint.id_sprint} className="sprint-row">
                                            <td className="sprint-name">{sprint.name}</td>
                                            <td>{formatDate(sprint.begin_at)}</td>
                                            <td>{formatDate(sprint.deadline)}</td>
                                            <td>
                                                {sprint.SP_estimated != null ? `${sprint.SP_estimated} SP` : '—'}
                                            </td>
                                            <td>
                                                <span className={`badge badge-${sprint.status}`}>
                                                    {statusLabel(sprint.status)}
                                                </span>
                                            </td>
                                            <td>
                                                {days === null ? (
                                                    <span className="days-neutral">—</span>
                                                ) : days < 0 ? (
                                                    <span className="days-overdue">Vencido hace {Math.abs(days)} día{Math.abs(days) !== 1 ? 's' : ''}</span>
                                                ) : days === 0 ? (
                                                    <span className="days-warning">Vence hoy</span>
                                                ) : days <= 3 ? (
                                                    <span className="days-warning">{days} día{days !== 1 ? 's' : ''} restante{days !== 1 ? 's' : ''}</span>
                                                ) : (
                                                    <span className="days-ok">{days} días restantes</span>
                                                )}
                                            </td>
                                            <td>
                                                <Link
                                                    to={`/projects/${id}/sprint-board/${sprint.id_sprint}`}
                                                    state={{ sprint }}
                                                >
                                                    <button className="btn-view">Ver tablero →</button>
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {isPanelOpen && <CreateSprint onClose={() => setIsPanelOpen(false)} />}
            </div>
        </>
    );
}
