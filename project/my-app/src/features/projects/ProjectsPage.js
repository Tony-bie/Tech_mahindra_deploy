import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../shared/context/AuthContext';
import ViewerProjectsTable from './ViewerProjectsTable';

export default function ProjectsPage() {
    const { user }  = useAuthContext();
    const navigate  = useNavigate();
    const isPM      = user?.role === 'pm' || user?.role === 'admin';

    return (
        <div style={s.page}>
            <div style={s.topBar}>
                <div style={s.breadcrumb}>
                    <span>Inicio</span>
                    <span style={{ color: '#CCC' }}>/</span>
                    <span style={{ color: '#1A1A1A', fontWeight: 500 }}>Proyectos</span>
                </div>
                {isPM && (
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button style={s.btnPrimary} onClick={() => navigate('/projects/new')}>
                            + Nuevo proyecto
                        </button>
                        {user?.role === 'admin' && (
                            <button style={s.btnSecondary} onClick={() => navigate('/users')}>
                                Gestión de usuarios
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Todos los roles ven la misma tabla consolidada.
                El componente recibe `user` y adapta las acciones según el rol. */}
            <div style={s.body}>
                <ViewerProjectsTable user={user} />
            </div>
        </div>
    );
}

const s = {
    page:         { minHeight: '100vh', backgroundColor: '#F5F5F4', fontFamily: "'DM Sans','Helvetica Neue',sans-serif", color: '#1A1A1A' },
    topBar:       { backgroundColor: '#FFF', borderBottom: '1px solid #E5E5E3', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    breadcrumb:   { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#888' },
    body:         { padding: '32px 32px 24px', width: '100%', maxWidth: 'none' },
    btnPrimary:   { height: 36, padding: '0 16px', backgroundColor: '#CC0000', color: '#FFF', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
    btnSecondary: { height: 36, padding: '0 16px', backgroundColor: 'transparent', color: '#555', border: '1px solid #D0D0CE', borderRadius: 4, fontSize: 13, cursor: 'pointer' },
};