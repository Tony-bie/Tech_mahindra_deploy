// project/my-app/src/features/projects/PredictionCard.js
import { useEffect, useState } from 'react';
import api from '../../config/api';
import './PredictionCard.css';

const STATUS_CONFIG = {
    VERDE:     { className: 'pred-status--verde',    title: 'En curso',         badge: 'VERDE' },
    AMARILLO:  { className: 'pred-status--amarillo', title: 'En riesgo',        badge: 'AMARILLO' },
    ROJO:      { className: 'pred-status--rojo',     title: 'Retraso previsto', badge: 'ROJO' },
    SIN_DATOS: { className: 'pred-status--sindatos', title: 'Sin datos',        badge: 'SIN DATOS' },
};

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatVelocity(v) {
    if (v === null || v === undefined) return '—';
    return `${Math.round(v * 10) / 10} SP/sprint`;
}

export default function PredictionCard({ projectId }) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
            const { res, data: payload } = await api.get(`/projects/${projectId}/prediction`);
            if (cancelled) return;
            if (!res.ok) {
                setError(payload.message || 'Error cargando la predicción.');
                setData(null);
            } else {
                setData(payload);
            }
            setLoading(false);
        }
        load();
        return () => { cancelled = true; };
    }, [projectId]);

    if (loading) {
        return <div className="pred-loading">Calculando predicción…</div>;
    }
    if (error) {
        return <div className="pred-error">{error}</div>;
    }
    if (!data) {
        return null;
    }

    const cfg = STATUS_CONFIG[data.classification] || STATUS_CONFIG.SIN_DATOS;

    return (
        <div className="pred-card">
            <div className={`pred-status ${cfg.className}`}>{cfg.badge}</div>
            <div className="pred-body">
                <h3 className="pred-title">Predicción de cumplimiento — {cfg.title}</h3>
                <p className="pred-message">{data.message}</p>
                <div className="pred-meta">
                    <div><span className="pred-meta-label">Deadline:</span><span className="pred-meta-value">{formatDate(data.deadline)}</span></div>
                    <div><span className="pred-meta-label">Fin estimado:</span><span className="pred-meta-value">{formatDate(data.estimated_finish)}</span></div>
                    <div><span className="pred-meta-label">Velocidad:</span><span className="pred-meta-value">{formatVelocity(data.velocity)}</span></div>
                    <div><span className="pred-meta-label">Sprints pasados:</span><span className="pred-meta-value">{data.completed_sprints}</span></div>
                    <div><span className="pred-meta-label">SP completados:</span><span className="pred-meta-value">{data.done_sp} / {data.total_sp}</span></div>
                    <div><span className="pred-meta-label">SP restantes:</span><span className="pred-meta-value">{data.remaining_sp}</span></div>
                </div>
            </div>
        </div>
    );
}
