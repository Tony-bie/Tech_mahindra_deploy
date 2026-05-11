import { useEffect, useState, useCallback } from 'react';
import "./SprintBoard.css";
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '../../config/api';
import { useAuthContext } from '../../shared/context/AuthContext';

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const TYPE_LABEL = { user_story: 'User Story', task: 'Task', bug: 'Bug' };

const COL_TO_STATUS = { todo: 'todo', inprogress: 'in_progress', done: 'done' };

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');

// Determina si el usuario puede mover una tarjeta del Kanban.
// - admin / pm: cualquier tarjeta del proyecto (backend valida ownership del PM)
// - viewer: solo si la tarjeta está asignada a él
function canMoveCard(user, card) {
    const role = user?.role;
    if (role === 'admin' || role === 'pm') return true;
    if (role === 'viewer') {
        const uid = user?.id_user ?? user?.id;
        return uid != null && String(card.assignee) === String(uid);
    }
    return false;
}

/**
 * Convierte el array de work_items que devuelve el API
 * a la estructura de columnas que usa el Kanban.
 */
function mapWorkItemsToColumns(items = []) {
    const cols = {
        todo:       { id: 'todo',       label: 'TO DO',       color: 'neutral', cards: [] },
        inprogress: { id: 'inprogress', label: 'IN PROGRESS', color: 'blue',    cards: [] },
        done:       { id: 'done',       label: 'DONE',        color: 'green',   cards: [] },
    };

    for (const wi of items) {
        // 'in_progress' → 'inprogress' (nombre de columna)
        const colKey = wi.status === 'in_progress' ? 'inprogress' : wi.status;
        if (!cols[colKey]) continue;

        cols[colKey].cards.push({
            id:       String(wi.id_work_item),
            type:     TYPE_LABEL[wi.type] || wi.type,
            title:    wi.title,
            assignee: wi.assignee_id ? String(wi.assignee_id) : '?',
            sp:       wi.story_points ?? 0,
            due:      fmtDate(wi.end_date),
            closed:   `Closed ${fmtDate(wi.updated_at || wi.end_date)}`,
            tag:      null,
        });
    }
    return cols;
}

const EMPTY_COLUMNS = mapWorkItemsToColumns([]);

// ─── ICONS ────────────────────────────────────────────────────────────────────
const IconPlus   = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>;
const IconClock  = () => <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
const IconCheck  = () => <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>;
const IconWarn   = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>;
const IconAlert  = () => <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 3.5L19.5 20h-15L12 5.5zM11 10v5h2v-5h-2zm0 7v2h2v-2h-2z" /></svg>;

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────
const Avatar = ({ id }) => {
    const label = String(id).slice(0, 2).toUpperCase();
    const colors = ['#5e3ea1', '#1d5fa8', '#b05c00', '#d4382a', '#2a7d4f', '#8b4513'];
    const bg = colors[Number(id) % colors.length] || '#888';
    return <div className="avatar" style={{ background: bg }}>{label}</div>;
};

const BADGE_CLASS = {
    'User Story': 'badge--user-story',
    'Task':       'badge--task',
    'Bug':        'badge--bug',
};

const Badge = ({ type }) => (
    <span className={`badge ${BADGE_CLASS[type] || 'badge--task'}`}>{type}</span>
);

const Card = ({ card, done = false, draggable = false, onDragStart }) => (
    <div
        className={`card${done ? ' card--done' : ''}`}
        draggable={draggable}
        onDragStart={draggable ? onDragStart : undefined}
        style={draggable ? { cursor: 'grab' } : { cursor: 'default' }}
    >
        <div className="card__top">
            <Badge type={card.type} />
            <span className="card__id">#{card.id}</span>
        </div>
        <div className={`card__title${done ? ' card__title--done' : ''}`}>{card.title}</div>

        {card.tag === 'blocker' && (
            <div className="tag-wrap">
                <span className="tag tag--blocker"><IconWarn />{card.blockerMsg}</span>
            </div>
        )}
        {card.tag === 'critical' && (
            <div className="tag-wrap">
                <span className="tag tag--critical"><IconAlert />Critical blocker</span>
            </div>
        )}

        <div className="card__footer">
            <Avatar id={card.assignee} />
            <div className="card__meta">
                {done ? (
                    <>
                        <span className="closed-tag"><IconCheck />{card.closed}</span>
                        {card.bonus && <span className="bonus-tag">(+bonus)</span>}
                    </>
                ) : (
                    <><IconClock />{card.sp} SP · Due {card.due}</>
                )}
            </div>
        </div>
    </div>
);

const Column = ({ col, user, onMoveCard }) => {
    const isDone = col.id === 'done';
    const [isOver, setIsOver] = useState(false);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!isOver) setIsOver(true);
    };
    const handleDragLeave = () => setIsOver(false);
    const handleDrop = (e) => {
        e.preventDefault();
        setIsOver(false);
        const itemId  = e.dataTransfer.getData('text/plain');
        const fromCol = e.dataTransfer.getData('source-col');
        if (itemId && fromCol && fromCol !== col.id) {
            onMoveCard?.(itemId, fromCol, col.id);
        }
    };

    return (
        <div
            className={`column column--${col.color}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={isOver ? { outline: '2px dashed #CC0000', outlineOffset: -4 } : undefined}
        >
            <div className="column__header">
                <span>{col.label}</span>
                <span className="column__count">{col.cards.length}</span>
            </div>
            <div className="column__body">
                {col.cards.length === 0 && (
                    <p style={{ color: '#bbb', fontSize: 13, textAlign: 'center', marginTop: 24 }}>
                        No items
                    </p>
                )}
                {col.cards.map(card => {
                    const draggable = canMoveCard(user, card);
                    return (
                        <Card
                            key={card.id}
                            card={card}
                            done={isDone}
                            draggable={draggable}
                            onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', card.id);
                                e.dataTransfer.setData('source-col', col.id);
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
};

// ─── FORM ─────────────────────────────────────────────────────────────────────
const FormField = ({ label, required, children }) => (
    <div className="form-group">
        <label className="form-label">{label}{required && <span> *</span>}</label>
        {children}
    </div>
);

/**
 * Props requeridos: sprint, user, onCancel, onAdded
 */
const AddWorkItemForm = ({ sprint, user, onCancel, onAdded }) => {
    const { id, id_sprint } = useParams();

    const [form, setForm] = useState({
        type: '', assignee: '', title: '', sp: 8, weight: 2,
        start_date: '', target_date: '', description: '',
        created_by: user?.id_user ?? user?.id ?? '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError]           = useState('');
    const [assignableUsers, setAssignableUsers] = useState([]);

    useEffect(() => {
        const uid = user?.id_user ?? user?.id;
        if (uid) setForm(f => ({ ...f, created_by: uid }));
    }, [user]);

    useEffect(() => {
        if (!id) return;
        api.get(`/projects/${id}/assignable`)
            .then(({ res, data }) => {
                if (res?.ok) {
                    setAssignableUsers(data.assignable || []);
                } else {
                    console.error('[assignable] HTTP', res?.status, data);
                    setError(data?.message || `No se pudo cargar la lista de miembros (HTTP ${res?.status}).`);
                }
            })
            .catch(err => {
                console.error('[assignable] network error', err);
                setError('Error de conexión al cargar miembros del proyecto.');
            });
    }, [id]);

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    async function handleSubmit() {
        if (!form.type || !form.title.trim() || !form.assignee) {
            setError('Tipo, título y asignado son obligatorios.');
            return;
        }
        setError('');
        setSubmitting(true);
        try {
            const { res, data } = await api.post(`/sprintBoard/${id_sprint}/createWorkItem`, form);
            if (res?.ok) {
                onAdded?.();
                onCancel();
            } else {
                setError(data?.message || 'Error al crear el item.');
            }
        } catch {
            setError('Error de conexión.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="add-form">
            <div className="add-form__header">
                <span className="add-form__title">Agregar work item</span>
            </div>

            <div className="add-form__body">
                {error && <div className="form-error">{error}</div>}

                <div className="form-row">
                    <FormField label="Type" required>
                        <select className="form-control" value={form.type} onChange={e => set('type', e.target.value)}>
                            <option value="">Select type…</option>
                            <option value="user_story">User Story</option>
                            <option value="task">Task</option>
                            <option value="bug">Bug</option>
                        </select>
                    </FormField>

                    <FormField label="Sprint" required>
                        <input
                            className="form-control"
                            type="text"
                            value={sprint?.name || `Sprint ${id_sprint}`}
                            readOnly
                            style={{ backgroundColor: '#F5F4F0', color: '#9e9b92' }}
                        />
                    </FormField>

                    <FormField label="Asignado a" required>
                        <select className="form-control" value={form.assignee} onChange={e => set('assignee', e.target.value)}>
                            <option value="">— Selecciona un miembro —</option>
                            {assignableUsers.map(u => (
                                <option key={u.id_user} value={u.id_user}>
                                    {u.username} ({u.projectRole === 'pm' ? 'PM' : 'Visor'})
                                </option>
                            ))}
                        </select>
                        {assignableUsers.length === 0 && (
                            <span style={{ fontSize: 11, color: '#AAA', marginTop: 3 }}>
                                Sin miembros vinculados al proyecto
                            </span>
                        )}
                        {assignableUsers.length === 1 && assignableUsers[0].projectRole === 'pm' && (
                            <span style={{ fontSize: 11, color: '#AAA', marginTop: 3 }}>
                                Solo tú estás vinculado a este proyecto. Vincula visores para poder asignarles items.
                            </span>
                        )}
                    </FormField>
                </div>

                <FormField label="Title" required>
                    <input
                        className="form-control"
                        type="text"
                        placeholder="Describe this work item clearly…"
                        value={form.title}
                        onChange={e => set('title', e.target.value)}
                    />
                </FormField>

                <div className="form-row">
                    <FormField label="Story Points (≥0)" required>
                        <input className="form-control" type="number" min={0} value={form.sp}
                            onChange={e => set('sp', e.target.value)} />
                    </FormField>

                    <FormField label="Gamification Weight (>0)" required>
                        <input className="form-control" type="number" min={1} value={form.weight}
                            onChange={e => set('weight', e.target.value)} />
                    </FormField>

                    <FormField label="Target Date" required>
                        <input className="form-control" type="date" value={form.target_date}
                            onChange={e => set('target_date', e.target.value)} />
                    </FormField>
                </div>

                <FormField label="Description">
                    <textarea
                        className="form-control"
                        placeholder="Detailed description of the work item…"
                        value={form.description}
                        onChange={e => set('description', e.target.value)}
                    />
                </FormField>
            </div>

            <div className="add-form__footer">
                <button className="btn-cancel" onClick={onCancel} disabled={submitting}>Cancel</button>
                <button className="btn-submit" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? 'Adding…' : 'Add to Sprint'}
                </button>
            </div>
        </div>
    );
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function SprintBoard() {
    const location          = useLocation();
    const navigate          = useNavigate();
    const { id, id_sprint } = useParams();
    const { user }          = useAuthContext();

    const isPM = user?.role === 'pm' || user?.role === 'admin';

    const [sprint,      setSprint]      = useState(location.state?.sprint || null);
    const [projectName, setProjectName] = useState(location.state?.projectName || null);
    const [columns,     setColumns]     = useState(EMPTY_COLUMNS);
    const [showForm,    setShowForm]    = useState(false);
    const [search,      setSearch]      = useState('');
    const [loading,     setLoading]     = useState(true);

    // ── Carga sprint desde API si no vino por navigation state ───────────────
    useEffect(() => {
        if (sprint) return;
        async function fetchSprint() {
            try {
                const { res, data } = await api.get(`/sprintBoard/${id_sprint}/getSprintInfo`);
                if (res?.ok && data?.data) setSprint(data.data);
            } catch {}
        }
        fetchSprint();
    }, [id_sprint, sprint]);

    // ── Carga work items siempre que cambia el sprint ─────────────────────────
    const fetchWorkItems = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/sprintBoard/${id_sprint}/getWorkItems`);
            // Backend devuelve { message, data: supabaseResponse }
            // supabaseResponse = { data: [...workItems], error }
            const items = data?.data?.data ?? [];
            setColumns(mapWorkItemsToColumns(items));
        } catch {
            setColumns(EMPTY_COLUMNS);
        } finally {
            setLoading(false);
        }
    }, [id_sprint]);

    useEffect(() => {
        fetchWorkItems();
    }, [fetchWorkItems]);

    // ── Drag & drop: mover work item entre columnas ──────────────────────────
    const handleMoveCard = useCallback(async (itemId, fromCol, toCol) => {
        const newStatus = COL_TO_STATUS[toCol];
        if (!newStatus) return;

        // Snapshot para revertir si el backend rechaza el cambio
        let snapshot;
        setColumns(prev => {
            snapshot = prev;
            const idx = prev[fromCol]?.cards.findIndex(c => c.id === itemId);
            if (idx == null || idx === -1) return prev;
            const moved = prev[fromCol].cards[idx];
            return {
                ...prev,
                [fromCol]: { ...prev[fromCol], cards: prev[fromCol].cards.filter((_, i) => i !== idx) },
                [toCol]:   { ...prev[toCol],   cards: [...prev[toCol].cards, moved] },
            };
        });

        try {
            const { res, data } = await api.patch(`/work-items/${itemId}/status`, { status: newStatus });
            if (!res?.ok) {
                console.error('[move] backend rechazó el cambio:', res?.status, data);
                if (snapshot) setColumns(snapshot);
                fetchWorkItems();
            }
        } catch (err) {
            console.error('[move] error de conexión:', err);
            if (snapshot) setColumns(snapshot);
            fetchWorkItems();
        }
    }, [fetchWorkItems]);

    // ── Carga nombre del proyecto si no vino por state ───────────────────────
    useEffect(() => {
        if (projectName) return;
        async function fetchProject() {
            try {
                const { res, data } = await api.get(`/projects/${id}`);
                if (res?.ok && data?.project_name) setProjectName(data.project_name);
            } catch {}
        }
        fetchProject();
    }, [id, projectName]);

    // ── Métricas ─────────────────────────────────────────────────────────────
    const spEstimated = sprint?.SP_estimated ?? 0;
    const spCompleted = columns.done.cards.reduce((acc, c) => acc + (c.sp || 0), 0);
    const pct         = spEstimated > 0 ? Math.min(100, Math.round((spCompleted / spEstimated) * 100)) : 0;

    const projectLabel = projectName || `Project ${id}`;
    const sprintLabel  = sprint?.name || `Sprint ${id_sprint}`;
    const sprintNum    = sprint?.name?.replace(/[^0-9]/g, '') || id_sprint;

    // ── Filtro por búsqueda ───────────────────────────────────────────────────
    const filteredColumns = search.trim()
        ? Object.fromEntries(
            Object.entries(columns).map(([key, col]) => [
                key,
                {
                    ...col,
                    cards: col.cards.filter(c =>
                        c.title.toLowerCase().includes(search.toLowerCase()) ||
                        c.type.toLowerCase().includes(search.toLowerCase())
                    ),
                },
            ])
          )
        : columns;

    if (!sprint && loading) {
        return (
            <div className="sprint-board" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <p style={{ color: '#9e9b92', fontSize: 14 }}>Cargando sprint…</p>
            </div>
        );
    }

    return (
        <div className="sprint-board">

            {/* ── Breadcrumb ──────────────────────────────────────────────── */}
            <nav className="breadcrumb">
                <span
                    className="breadcrumb__link"
                    onClick={() => navigate(`/projects/${id}/view`, { state: { projectName: projectLabel } })}
                >
                    {projectLabel}
                </span>
                <span className="breadcrumb__sep">›</span>
                <span
                    className="breadcrumb__link"
                    onClick={() => navigate(`/projects/${id}/sprints`)}
                >
                    Backlog
                </span>
            </nav>

            {/* ── Page Header ─────────────────────────────────────────────── */}
            <div className="page-header">
                <h1 className="page-header__title">
                    Sprint {sprintNum} Board — {projectLabel}
                </h1>
                <div className="page-header__actions">
                    <input
                        className="header-search"
                        placeholder="Search…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {isPM && (
                        <button className="btn-add" onClick={() => setShowForm(v => !v)}>
                            <IconPlus />
                            Add
                        </button>
                    )}
                </div>
            </div>

            {/* ── Sprint Meta ─────────────────────────────────────────────── */}
            <div className="sprint-meta">
                <div className="meta-item">
                    <span className="meta-item__label">Sprint</span>
                    <span className="meta-item__value">{sprintLabel}</span>
                </div>
                <div className="meta-sep" />
                <div className="meta-item">
                    <span className="meta-item__label">Dates</span>
                    <span className="meta-item__value">
                        {fmtDate(sprint?.begin_at)} — {fmtDate(sprint?.deadline)}
                    </span>
                </div>
                <div className="meta-sep" />
                <div className="meta-item">
                    <span className="meta-item__label">Planned SP</span>
                    <span className="meta-item__value">{spEstimated} SP</span>
                </div>
                <div className="meta-sep" />
                <div className="meta-item">
                    <span className="meta-item__label">Completed SP</span>
                    <span className="meta-item__value meta-item__value--accent">
                        {spCompleted} / {spEstimated}
                    </span>
                </div>
                <div className="meta-progress">
                    <div className="progress-bar">
                        <div className="progress-bar__fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="progress-label">{pct}%</span>
                </div>
            </div>

            {/* ── Kanban Board ─────────────────────────────────────────────── */}
            {loading ? (
                <p style={{ color: '#9e9b92', fontSize: 13, textAlign: 'center', marginTop: 32 }}>
                    Cargando work items…
                </p>
            ) : (
                <div className="board">
                    {Object.values(filteredColumns).map(col => (
                        <Column key={col.id} col={col} user={user} onMoveCard={handleMoveCard} />
                    ))}
                </div>
            )}

            {/* ── Add Work Item Form ───────────────────────────────────────── */}
            {showForm && (
                <AddWorkItemForm
                    sprint={sprint}
                    user={user}
                    onCancel={() => setShowForm(false)}
                    onAdded={() => {
                        setShowForm(false);
                        fetchWorkItems();
                    }}
                />
            )}

        </div>
    );
}