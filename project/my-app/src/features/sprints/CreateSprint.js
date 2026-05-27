import { useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../config/api';
import ws from '../../config/ws';
import './CreateSprint.css';

export default function CreateSprint({ onClose }) {
    const { id } = useParams();
    const [form, setForm] = useState({
        nombre:      '',
        fecha_inicio: '',
        estado:      'planned',
        fecha_final: '',
        SP:          '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');

    function handleChange(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
        setError('');
    }

    async function handleSubmit() {
        if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return; }
        if (!form.fecha_inicio)  { setError('La fecha de inicio es obligatoria.'); return; }
        if (!form.fecha_final)   { setError('La fecha de fin es obligatoria.'); return; }
        if (form.fecha_final < form.fecha_inicio) { setError('La fecha de fin debe ser posterior a la de inicio.'); return; }

        setLoading(true);
        try {
            const sprint = await api.post(`/sprints/${id}/create-sprint`, form);
            ws.send(JSON.stringify({ type: 'SPRINT_CREATED', data: sprint.data.data }));
            onClose();
        } catch {
            setError('Error al crear el sprint. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="cs-overlay" onClick={onClose}>
            <div className="cs-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="cs-header">
                    <div>
                        <h2 className="cs-title">Nuevo sprint</h2>
                        <p className="cs-subtitle">Completa los datos para crear el sprint</p>
                    </div>
                    <button className="cs-close" onClick={onClose}>✕</button>
                </div>

                {/* Body */}
                <div className="cs-body">
                    <div className="cs-field">
                        <label className="cs-label">Nombre</label>
                        <input
                            className="cs-input"
                            type="text"
                            placeholder="Ej. Sprint 1 — Análisis"
                            value={form.nombre}
                            onChange={e => handleChange('nombre', e.target.value)}
                        />
                    </div>

                    <div className="cs-field">
                        <label className="cs-label">Estado inicial</label>
                        <select
                            className="cs-input"
                            value={form.estado}
                            onChange={e => handleChange('estado', e.target.value)}
                        >
                            <option value="planned">Planificado</option>
                            <option value="active">Activo</option>
                        </select>
                    </div>

                    <div className="cs-row">
                        <div className="cs-field">
                            <label className="cs-label">Fecha inicio</label>
                            <input
                                className="cs-input"
                                type="date"
                                value={form.fecha_inicio}
                                onChange={e => handleChange('fecha_inicio', e.target.value)}
                            />
                        </div>
                        <div className="cs-field">
                            <label className="cs-label">Fecha fin</label>
                            <input
                                className="cs-input"
                                type="date"
                                value={form.fecha_final}
                                onChange={e => handleChange('fecha_final', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="cs-field">
                        <label className="cs-label">SP estimados</label>
                        <input
                            className="cs-input"
                            type="number"
                            min="0"
                            placeholder="Ej. 40"
                            value={form.SP}
                            onChange={e => handleChange('SP', e.target.value)}
                        />
                    </div>

                    {error && <div className="cs-error">{error}</div>}
                </div>

                {/* Footer */}
                <div className="cs-footer">
                    <button className="cs-btn-cancel" onClick={onClose} disabled={loading}>
                        Cancelar
                    </button>
                    <button className="cs-btn-submit" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Creando...' : 'Crear sprint'}
                    </button>
                </div>
            </div>
        </div>
    );
}
