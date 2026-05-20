import { useEffect, useState } from 'react';
import api from '../../config/api';
import './ProjectProgressCard.css';

export default function ProjectProgressCard({ projectId }) {
    const [progress, setProgress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [animated, setAnimated] = useState(false);

    useEffect(() => {
        async function fetchProgress() {
            try {
                const { res, data } = await api.get(`/projects/${projectId}/progress`);
                if (res.ok) {
                    setProgress(data);
                    setTimeout(() => setAnimated(true), 60);
                } else {
                    setProgress(null);
                }
            } catch {
                setProgress(null);
            } finally {
                setLoading(false);
            }
        }
        fetchProgress();
        const interval = setInterval(fetchProgress, 30000);
        return () => clearInterval(interval);
    }, [projectId]);

    if (loading) {
        return (
            <div className="ppc-card">
                <div className="ppc-skeleton" />
            </div>
        );
    }

    if (!progress) return null;

    const { avance_real, avance_esperado, desviacion, sp_completados, sp_esperados, sp_totales, semaforo } = progress;

    const sign = desviacion > 0 ? '+' : '';
    const desviacionStr = `${sign}${desviacion.toFixed(2)}%`;

    const statusLabel = desviacion > 1 ? 'Adelantado' : desviacion < -1 ? 'Atrasado' : 'En tiempo';
    const statusMod   = desviacion > 1 ? 'ahead'       : desviacion < -1 ? 'behind'    : 'ontime';

    const semMap = {
        rojo:     { label: 'Rojo',     dot: '#CC0000',  color: '#B71C1C', bg: '#FDECEC' },
        amarillo: { label: 'Amarillo', dot: '#E8A000',  color: '#8A5A00', bg: '#FFF3D9' },
        verde:    { label: 'Verde',    dot: '#3C9A57',  color: '#2E7D32', bg: '#E7F6EA' },
    };
    const sm = semMap[semaforo] || null;

    return (
        <div className="ppc-card">
            <div className="ppc-header">
                <div>
                    <div className="ppc-kicker">Avance del proyecto</div>
                    <div className="ppc-card-title">Planificado vs Real</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {sm && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            borderRadius: 999, padding: '3px 10px',
                            fontSize: 10, fontWeight: 700,
                            color: sm.color, backgroundColor: sm.bg,
                        }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: sm.dot, flexShrink: 0 }} />
                            {sm.label}
                        </span>
                    )}
                    <span className={`ppc-badge ppc-badge--${statusMod}`}>{statusLabel}</span>
                </div>
            </div>

            <div className="ppc-body">
                <div className="ppc-bars">
                    <div className="ppc-bar-row">
                        <span className="ppc-bar-label">
                            <span className="ppc-dot ppc-dot--real" />
                            Avance real
                        </span>
                        <div className="ppc-track">
                            <div
                                className="ppc-fill ppc-fill--real"
                                style={{ width: animated ? `${Math.min(avance_real, 100)}%` : '0%' }}
                            />
                        </div>
                        <span className="ppc-bar-pct">{avance_real.toFixed(2)}%</span>
                    </div>

                    <div className="ppc-bar-row">
                        <span className="ppc-bar-label">
                            <span className="ppc-dot ppc-dot--expected" />
                            Avance esperado
                        </span>
                        <div className="ppc-track">
                            <div
                                className="ppc-fill ppc-fill--expected"
                                style={{ width: animated ? `${Math.min(avance_esperado, 100)}%` : '0%' }}
                            />
                        </div>
                        <span className="ppc-bar-pct">{avance_esperado.toFixed(2)}%</span>
                    </div>
                </div>

                <div className="ppc-metrics">
                    <div className="ppc-metric">
                        <span className="ppc-metric-label">Avance real</span>
                        <span className="ppc-metric-num ppc-metric-num--real">{avance_real.toFixed(2)}%</span>
                        <span className="ppc-metric-sub">{sp_completados} de {sp_totales} SP</span>
                    </div>

                    <div className="ppc-metric-divider" />

                    <div className="ppc-metric">
                        <span className="ppc-metric-label">Avance esperado</span>
                        <span className="ppc-metric-num ppc-metric-num--expected">{avance_esperado.toFixed(2)}%</span>
                        <span className="ppc-metric-sub">{sp_esperados} de {sp_totales} SP</span>
                    </div>

                    <div className="ppc-metric-divider" />

                    <div className="ppc-metric">
                        <span className="ppc-metric-label">Desviación</span>
                        <span className={`ppc-metric-num ppc-metric-num--${statusMod}`}>{desviacionStr}</span>
                        <span className="ppc-metric-sub">puntos porcentuales</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
