import React, { useEffect, useState, useCallback } from 'react';
import api from '../../config/api';
import './UserManagement.css';

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', role: 'viewer' });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (user, newRole) => {
    if (newRole === user.role?.status) return;
    setSaving(s => ({ ...s, [user.id_user + '_role']: true }));
    const { res } = await api.put(`/users/role/${user.id_user}`, { role: newRole });
    setSaving(s => ({ ...s, [user.id_user + '_role']: false }));
    if (res.ok) {
      showToast(`Rol actualizado a ${newRole}`);
      fetchUsers();
    } else {
      showToast('Error al actualizar el rol', 'error');
    }
  };

  const handleStatusChange = async (user, newStatus) => {
    if (newStatus === user.status) return;
    setSaving(s => ({ ...s, [user.id_user + '_status']: true }));
    const { res } = await api.put(`/users/status/${user.id_user}`, { status: newStatus });
    setSaving(s => ({ ...s, [user.id_user + '_status']: false }));
    if (res.ok) {
      showToast(`Usuario ${newStatus === 'Active' ? 'activado' : 'desactivado'}`);
      fetchUsers();
    } else {
      showToast('Error al actualizar el estado', 'error');
    }
  };

  const handleCreateUser = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      showToast('El nombre y el correo son obligatorios', 'error');
      return;
    }
    const { res, data } = await api.post('/users', form);
    if (!res.ok) {
      if (data.errors?.length > 0) {
        showToast(data.errors.map(e => e.message).join(' · '), 'error');
      } else {
        showToast(data.error || data.message || 'Error al crear usuario', 'error');
      }
      return;
    }
    showToast('Usuario creado correctamente');
    setForm({ full_name: '', email: '', role: 'viewer' });
    setShowForm(false);
    fetchUsers();
  };

  const filteredUsers = users.filter(u =>
    (u.full_name || u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalUsers   = users.length;
  const totalPM      = users.filter(u => u.role?.status === 'pm').length;
  const totalViewers = users.filter(u => u.role?.status === 'viewer').length;
  const totalActive  = users.filter(u => u.status === 'Active').length;

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('es-MX', {
      timeZone: 'America/Monterrey',
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  const getInitials = (name, email) => {
    if (name && name !== 'N/A') return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    return (email || '?')[0].toUpperCase();
  };

  return (
    <div className="um-container">
      {toast && (
        <div className={`um-toast um-toast--${toast.type}`}>
          <span className="um-toast__icon">{toast.type === 'success' ? '✓' : '✕'}</span>
          <span className="um-toast__msg">{toast.message}</span>
          <button className="um-toast__close" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <div className="um-header">
        <div className="um-header-left">
          <h1 className="um-title">Gestión de usuarios</h1>
          <p className="um-subtitle">Administra roles y accesos del sistema</p>
        </div>
        <div className="um-header-right">
          <div className="um-stats">
            <div className="um-stat">
              <span className="um-stat__value">{totalUsers}</span>
              <span className="um-stat__label">Total</span>
            </div>
            <div className="um-stat">
              <span className="um-stat__value">{totalPM}</span>
              <span className="um-stat__label">Gerentes</span>
            </div>
            <div className="um-stat">
              <span className="um-stat__value">{totalViewers}</span>
              <span className="um-stat__label">Visores</span>
            </div>
            <div className="um-stat">
              <span className="um-stat__value">{totalActive}</span>
              <span className="um-stat__label">Activos</span>
            </div>
          </div>
          <button className="um-btn-primary" onClick={() => setShowForm(v => !v)}>
            {showForm ? 'Cancelar' : '+ Nuevo usuario'}
          </button>
        </div>
      </div>

      <div className="um-body">
        {showForm && (
          <div className="um-form-card">
            <h3 className="um-form-title">Nuevo usuario</h3>
            <div className="um-form-grid">
              <div className="um-field">
                <label className="um-label">Nombre completo</label>
                <input
                  className="um-input"
                  placeholder="ej. Juan Pérez"
                  value={form.full_name}
                  onChange={e => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div className="um-field">
                <label className="um-label">Correo electrónico</label>
                <input
                  className="um-input"
                  placeholder="ej. mail@example.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="um-field">
                <label className="um-label">Rol</label>
                <select
                  className="um-input"
                  value={form.role}
                  onChange={e => setForm({ ...form, role: e.target.value })}
                >
                  <option value="admin">Administrador</option>
                  <option value="pm">Gerente de proyecto</option>
                  <option value="viewer">Visor</option>
                </select>
              </div>
            </div>
            <div className="um-form-footer">
              <p className="um-form-hint">Contraseña inicial: <code>ChangeMe123!</code></p>
              <button className="um-btn-primary" onClick={handleCreateUser}>Crear usuario</button>
            </div>
          </div>
        )}

        <div className="um-search-row">
          <div className="um-search-wrap">
            <span className="um-search-icon">⌕</span>
            <input
              className="um-search"
              placeholder="Buscar por nombre o correo…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <span className="um-count">{filteredUsers.length} de {totalUsers}</span>
        </div>

        <div className="um-table-wrap">
          <table className="um-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Último acceso</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => {
                const isSelf = currentUser && u.id_user === currentUser.id;
                return (
                  <tr key={u.id_user} className={`um-row${isSelf ? ' um-row--self' : ''}`}>
                    <td className="um-cell-user">
                      <div className={`um-avatar${isSelf ? ' um-avatar--self' : ''}`}>{getInitials(u.full_name, u.email)}</div>
                      <div className="um-user-info">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="um-user-name">{u.full_name && u.full_name !== 'N/A' ? u.full_name : u.email}</span>
                          {isSelf && <span className="um-you-badge">Tú</span>}
                        </div>
                        <span className="um-user-email">{u.full_name && u.full_name !== 'N/A' ? u.email : ''}</span>
                      </div>
                    </td>
                    <td>
                      {isSelf ? (
                        <span className={`um-select-role um-role--${u.role?.status || 'default'} um-badge-readonly`}>
                          {u.role?.status === 'admin' ? 'Admin' : u.role?.status === 'pm' ? 'PM' : 'Visor'}
                        </span>
                      ) : (
                        <select
                          className={`um-select-role um-role--${u.role?.status || 'default'} ${saving[u.id_user + '_role'] ? 'um-saving' : ''}`}
                          value={u.role?.status || ''}
                          onChange={e => handleRoleChange(u, e.target.value)}
                          disabled={saving[u.id_user + '_role']}
                        >
                          <option value="admin">Admin</option>
                          <option value="pm">PM</option>
                          <option value="viewer">Visor</option>
                        </select>
                      )}
                    </td>
                    <td>
                      {isSelf ? (
                        <span className={`um-select-status um-status--${u.status} um-badge-readonly`}>
                          {u.status === 'Active' ? 'Activo' : 'Inactivo'}
                        </span>
                      ) : (
                        <select
                          className={`um-select-status um-status--${u.status} ${saving[u.id_user + '_status'] ? 'um-saving' : ''}`}
                          value={u.status || 'Active'}
                          onChange={e => handleStatusChange(u, e.target.value)}
                          disabled={saving[u.id_user + '_status']}
                        >
                          <option value="Active">Activo</option>
                          <option value="Inactive">Inactivo</option>
                        </select>
                      )}
                    </td>
                    <td className="um-cell-date">{formatDate(u.last_login)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="um-empty">Ningún usuario coincide con tu búsqueda.</div>
          )}
        </div>
      </div>
    </div>
  );
}
