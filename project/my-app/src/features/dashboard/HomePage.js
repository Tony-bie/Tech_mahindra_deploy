import { useAuthContext } from '../../shared/context/AuthContext';
import AdminDashboard  from './AdminDashboard';
import PmDashboard     from './PmDashboard';
import ViewerDashboard from './ViewerDashboard';

export default function HomePage() {
    const { user } = useAuthContext();

    if (user?.role === 'admin')  return <AdminDashboard />;
    if (user?.role === 'pm')     return <PmDashboard />;
    if (user?.role === 'viewer') return <ViewerDashboard />;

    return null;
}
