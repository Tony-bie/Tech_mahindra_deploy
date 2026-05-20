import { useAuthContext } from '../../shared/context/AuthContext';
import UserManagement from './UserManagement';

export default function UsersPage() {
    const { user } = useAuthContext();
    return (
        <div style={s.page}>
            <div style={s.topBar}>
                <div style={s.breadcrumb}>
                    <span>Inicio</span>
                    <span style={{ color:'#CCC' }}>/</span>
                    <span style={{ color:'#1A1A1A', fontWeight:500 }}>Usuarios</span>
                </div>
            </div>
            <div style={s.body}>
                <UserManagement currentUser={user} />
            </div>
        </div>
    );
}

const s = {
    page:       { minHeight:'100vh', backgroundColor:'#F5F5F4', fontFamily:"'DM Sans','Helvetica Neue',sans-serif", color:'#1A1A1A' },
    topBar:     { backgroundColor:'#FFF', borderBottom:'1px solid #E5E5E3', padding:'0 32px', height:56, display:'flex', alignItems:'center' },
    breadcrumb: { display:'flex', alignItems:'center', gap:8, fontSize:13, color:'#888' },
    body:       { padding: 0 },
};