import { useState, useEffect } from 'react';
import api from '../../config/api';
import { styles } from './dashboard.utils';
import KpiStrip from './KpiStrip';
import WorkItemsSection from './WorkItemsSection';
import ActivitySection from './ActivitySection';
import TeamSection from './TeamSection';
import CostsSection from './CostsSection';
import SprintsSection from './SprintsSection';
import UpcomingSection from './UpcomingSection';
export default function AdminDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function load() {
            setLoading(true);
            setError('');
            try {
                const { res, data: payload } = await api.get('/dashboard/admin');
                if (!res.ok) {
                    setError(payload.error || payload.message || `Error ${res.status}`);
                    return;
                }
                setData(payload);
            } catch {
                setError('Error de conexión con el servidor');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) {
        return (
            <div style={styles.page}>
                <div style={styles.topBar}><span style={styles.crumbCurrent}>Inicio</span></div>
                <div style={styles.body}><p style={styles.muted}>Cargando dashboard...</p></div>
            </div>
        );
    }

    return (
        <div style={styles.page}>
            <div style={styles.topBar}>
                <span style={styles.crumbCurrent}>Inicio</span>
            </div>
            <div style={styles.body}>
                <h1 style={styles.title}>Dashboard consolidado</h1>
                <p style={styles.subtitle}>Vista global de la operación.</p>

                {error && <div style={styles.errorBox}>{error}</div>}

                {data && (
                    <>
                        <KpiStrip         summary={data.summary} />
                        <WorkItemsSection charts={data.charts} />
                        <ActivitySection  charts={data.charts} />
                        <TeamSection      charts={data.charts} />
                        <CostsSection     charts={data.charts} />
                        <SprintsSection   charts={data.charts} />
                        <UpcomingSection  lists={data.lists} />

                    </>
                )}
            </div>
        </div>
    );
}
