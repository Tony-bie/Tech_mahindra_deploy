import { useEffect, useState } from 'react';
import api from '../../config/api';
import './ProjectProgressCard.css';

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDaysDiff(diff) {
    if (diff === null || diff === undefined) return null;
    if (diff === 0) return 'justo en el deadline';
    if (diff < 0)   return `${Math.abs(diff)} día(s) antes del deadline`;
    return `${diff} día(s) después del deadline`;
}

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

    const { avance_real, avance_esperado, desviacion, sp_completados, sp_esperados, sp_totales, semaforo, risk_score, semaforo_overrides, prediction } = progress;

    const sign = desviacion > 0 ? '+' : '';
    const desviacionStr = `${sign}${desviacion.toFixed(2)}%`;

    const statusLabel = desviacion > 1 ? 'Adelantado' : desviacion < -1 ? 'Atrasado' : 'En tiempo';
    const statusMod   = desviacion > 1 ? 'ahead'       : desviacion < -1 ? 'behind'    : 'ontime';

    const semMap = {
        rojo:     { label: 'Rojo',     dot: '#CC0000',  color: '#B71C1C' },
        amarillo: { label: 'Amarillo', dot: '#E8A000',  color: '#8A5A00' },
        verde:    { label: 'Verde',    dot: '#3C9A57',  color: '#2E7D32' },
    };
    const sm = semMap[semaforo] || null;

    const overrideLabels = {
        deadline_vencido:        'Deadline vencido con avance < 100%',
        costo_excedido:          'Costo aprobado supera el presupuesto',
        bloqueador_critico_3dias:'Bloqueador crítico activo por más de 3 días',
    };

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
                            fontSize: 11, fontWeight: 700, color: sm.color,
                        }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: sm.dot, flexShrink: 0 }} />
                            {sm.label}
                        </span>
                    )}
                    <span className={`ppc-badge ppc-badge--${statusMod}`}>{statusLabel}</span>
                </div>
            </div>

            {semaforo_overrides && semaforo_overrides.length > 0 && (
                <div className="ppc-override-banner">
                    <span className="ppc-override-icon">⚠</span>
                    <div>
                        <span className="ppc-override-title">Semáforo ajustado por alerta:</span>
                        <ul className="ppc-override-list">
                            {semaforo_overrides.map(key => (
                                <li key={key}>{overrideLabels[key] || key}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

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

            {prediction && prediction.confidence !== 'SIN_DATOS' && (
                <div className="ppc-prediction-section">
                    <div className="ppc-prediction-header">
                        <span className="ppc-prediction-label">Predicción temporal</span>
                        <span className={`ppc-prediction-confidence ppc-prediction-confidence--${prediction.confidence.toLowerCase()}`}>
                            Confianza {prediction.confidence.toLowerCase()}
                        </span>
                    </div>

                    <div className="ppc-prediction-grid">
                        <div className="ppc-prediction-meta">
                            <span className="ppc-prediction-meta-label">Fin estimado</span>
                            <span className="ppc-prediction-meta-value">{formatDate(prediction.estimated_finish)}</span>
                            {formatDaysDiff(prediction.days_diff) && (
                                <span className="ppc-prediction-meta-sub">{formatDaysDiff(prediction.days_diff)}</span>
                            )}
                        </div>

                        <div className="ppc-prediction-meta">
                            <span className="ppc-prediction-meta-label">Velocidad efectiva</span>
                            <span className="ppc-prediction-meta-value">
                                {prediction.velocity_effective != null
                                    ? `${prediction.velocity_effective.toFixed(1)} SP/sprint`
                                    : '—'}
                            </span>
                            {prediction.blocker_penalty < 1 && (
                                <span className="ppc-prediction-meta-sub">
                                    −{Math.round((1 - prediction.blocker_penalty) * 100)}% por bloqueadores
                                </span>
                            )}
                        </div>

                        <div className="ppc-prediction-meta">
                            <span className="ppc-prediction-meta-label">SP restantes</span>
                            <span className="ppc-prediction-meta-value">{prediction.remaining_sp}</span>
                            {prediction.stuck_sprints_excluded > 0 && (
                                <span className="ppc-prediction-meta-sub">
                                    {prediction.stuck_sprints_excluded} sprint(s) anómalo(s) excluido(s)
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {risk_score != null && (
                <div className="ppc-score-section">
                    <div className="ppc-score-header">
                        <span className="ppc-score-label">Score de riesgo</span>
                        <span className="ppc-score-value">
                            {risk_score}
                            <span className="ppc-score-max"> / 100</span>
                        </span>
                    </div>
                    <div className="ppc-score-track">
                        <div
                            className="ppc-score-fill"
                            style={{
                                width: animated ? `${risk_score}%` : '0%',
                                background: risk_score >= 70 ? '#CC0000' : risk_score >= 40 ? '#E8A000' : '#3C9A57',
                            }}
                        />
                    </div>
                    <div className="ppc-factors">
                        {[
                            { label: 'Desviación de avance', desc: 'retraso vs. sprints vencidos',    max: 25 },
                            { label: 'Cercanía al deadline', desc: 'días restantes al cierre',         max: 20 },
                            { label: 'Presupuesto',          desc: 'gasto aprobado vs. total',         max: 20 },
                            { label: 'Bloqueadores',         desc: 'críticos o medios activos',        max: 15 },
                            { label: 'Riesgos activos',      desc: 'nivel alto / medio / bajo',        max: 10 },
                            { label: 'Velocidad de cierre',  desc: 'SP cerrados en los últimos 7 días', max: 10 },
                        ].map(f => (
                            <div key={f.label} className="ppc-factor">
                                <span className="ppc-factor-name">{f.label}</span>
                                <span className="ppc-factor-desc">{f.desc}</span>
                                <span className="ppc-factor-max">+{f.max}</span>
                            </div>
                        ))}
                    </div>
                    <div className="ppc-score-legend">
                        <span style={{ color: '#3C9A57', fontWeight: 700 }}>Verde 0–39</span>
                        <span className="ppc-legend-sep">·</span>
                        <span style={{ color: '#8A5A00', fontWeight: 700 }}>Amarillo 40–69</span>
                        <span className="ppc-legend-sep">·</span>
                        <span style={{ color: '#B71C1C', fontWeight: 700 }}>Rojo 70–100</span>
                    </div>
                </div>
            )}
        </div>
    );
}
