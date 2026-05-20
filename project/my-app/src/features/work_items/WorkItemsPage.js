import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../shared/context/AuthContext';
import WorkItems from './WorkItems';
import './WorkItems.css';

export default function WorkItemsPage() {
    const { id }       = useParams();
    const location     = useLocation();
    const navigate     = useNavigate();
    const { user }     = useAuthContext();
    const projectName  = location.state?.projectName || `Proyecto ${id}`;

    return (
        <div className="wi-page">
            <div className="wi-topbar">
                <div className="wi-breadcrumb">
                    <button className="wi-breadcrumb-btn" onClick={() => navigate('/projects')}>
                        Proyectos
                    </button>
                    <span className="wi-breadcrumb-sep">/</span>
                    <button
                        className="wi-breadcrumb-btn"
                        onClick={() => navigate(`/projects/${id}/view`, { state: { projectName } })}
                    >
                        {projectName}
                    </button>
                    <span className="wi-breadcrumb-sep">/</span>
                    <span className="wi-breadcrumb-current">Ítems de trabajo</span>
                </div>

                <button className="wi-back-btn" onClick={() => navigate('/projects')}>
                    ← Volver a proyectos
                </button>
            </div>

            <div className="wi-body">
                <WorkItems
                    projectId={id}
                    projectName={projectName}
                    currentUser={user}
                />
            </div>
        </div>
    );
}
