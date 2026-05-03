import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../config/api';
import { useAuthContext } from '../../shared/context/AuthContext';
import CreateSprint from './CreateSprint'
import './SprintsPage.css'
import ws from '../../config/ws';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';


export default function SprintsPage(){
    const { user } = useAuthContext()
    const navigate    = useNavigate();
    const location    = useLocation();
    const { id } = useParams();
    const [tasksByStatus, setTasksByStatus] = useState(null);
    const [, setLoading] = useState(true);
    const [isPanelOpen, setIsPanelOpen] = useState(false)
    const [statusFilter, setStatusFilter] = useState('All_sprints');

    const projectName = location.state?.projectName || `Proyecto ${id}`;

    
    function buildFilterStatus(data){        
        return {
            all_sprints: data,
            planned: data.filter(t => t.status === 'planned'),
            active: data.filter(t => t.status === 'active'),
            cancelled: data.filter(t => t.status === 'cancelled'),
            done: data.filter(t => t.status === 'done'),
        };
    }

    useEffect(() => {
        async function consultSprint() {
            try{
                console.log(id)

                const sprint = await api.get(`/sprints/${id}/get-sprints`)

                console.log(sprint)

                if (!sprint){
                    return null
                }

                const data = sprint.data.data

                console.log("Data consult", data)
                if (!data){
                    return null
                }
                setTasksByStatus(buildFilterStatus(data))
            }
            catch(error){
                console.error(error)
            } finally {
                setLoading(false)
            }
        }
        consultSprint();

        const handler = ({ data }) => {
            const mensaje = JSON.parse(data)
            if (mensaje.type === 'SPRINT_CREATED') {
                const newSprint = mensaje.data[0]
                setTasksByStatus(prev => ({
                    ...prev,
                    all_sprints: [...prev.all_sprints, newSprint],
                    [newSprint.status]: [...prev[newSprint.status], newSprint]
                    }))
                }
            }

        ws.addEventListener('message', handler)

        return () => ws.removeEventListener('message', handler)
        
    }, [id])




    const filteredSprints = statusFilter === 'All_sprints'
        ? tasksByStatus?.all_sprints
        : tasksByStatus?.[statusFilter]

    return(
        <>
        <div className='topBar'>
                <div className='breadCrumb'>
                    <button className='crumbBtn' onClick={() => navigate('/projects')}>
                        Proyectos
                    </button>
                    <span className='sep'>/</span>
                    <button
                        className='crumbBtn'
                        onClick={() =>
                            navigate(`/projects/${id}/view`, { state: { projectName } })
                        }
                    >
                        {projectName}
                    </button>
                    <span className='sep'>/</span>
                    <span className='crumbCurrent'>Sprint page</span>
                </div>

                {(user.role === "pm" || user.role === "admin") && (
                <button className="btn-new-sprint" onClick={() => setIsPanelOpen(true)}>
                + Crear sprint
                </button>
            )}
            </div>
        <div className='sprint-layout'>
        <div>
            <h1 className="sprint-header">Sprints</h1>
        </div>
            <div className="sprint-toolbar">
            <div className="sprint-toolbar-left">
                <label htmlFor="status">Filter state of sprints</label>
                <select id="status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="All_sprints">All sprints</option>
                <option value="planned">Planned</option>
                <option value="active">Active</option>
                <option value="cancelled">Cancelled</option>
                <option value="done">Done</option>
                </select>
            </div>
            </div>

            {/* En la tabla agrega el botón View */}
            <div className="sprint-table-card">
            <table>
                <thead>
                <tr>
                    <th>Sprint</th><th>Start</th><th>End</th><th>Status</th><th>Actions</th>
                </tr>
                </thead>
                <tbody>
                {filteredSprints?.map(sprint => (
                    <tr key={sprint.id_sprint}>
                    <td>{sprint.name}</td>
                    <td>{sprint.begin_at ? sprint.begin_at.slice(0, 10) : '—'}</td>
                    <td>{sprint.deadline ? sprint.deadline.slice(0, 10) : '—'}</td>
                    <td><span className={`badge badge-${sprint.status}`}>{sprint.status}</span></td>
                    <td>
                    <Link
                        key={sprint.id_sprint}
                        to={`/projects/${id}/sprint-board/${sprint.id_sprint}`}
                        state={{ sprint: sprint }}
                    >
                        <button className="btn-view">View</button>
                    </Link>
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>

        {isPanelOpen && <CreateSprint onClose={() => setIsPanelOpen(false)} /> }

        </div>
        </>
        
    );
}

