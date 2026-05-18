import { useAuthContext } from '../../shared/context/AuthContext';
import AdminDashboard from './AdminDashboard';

export default function HomePage() {
    const { user } = useAuthContext();

    if (user?.role === 'admin') {
        return <AdminDashboard />;
    }

    // PM y viewer: placeholder actual (fuera de alcance de HU-05)
    return (
        <div style={s.page}>
            <div style={s.topBar}>
                <span style={{ fontSize: 13, color: '#1A1A1A', fontWeight: 500 }}>Inicio</span>
            </div>
            <div style={s.body}>
                <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
                <p style={{ fontSize: 13, color: '#888' }}>Vista general — próximamente disponible.</p>
            </div>
        </div>
    );
}

const s = {
    page:   { minHeight: '100vh', backgroundColor: '#F5F5F4', fontFamily: "'DM Sans',sans-serif" },
    topBar: { backgroundColor: '#FFF', borderBottom: '1px solid #E5E5E3', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center' },
    body:   { padding: 32 },
};
