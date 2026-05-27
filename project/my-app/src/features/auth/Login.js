import { useState, useRef, useCallback } from 'react';
import './Login.css';

function Login({ onLogin }) {
    const [form, setForm] = useState({ email_user: '', password: '' });
    const [mensaje, setMensaje] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const errorTimer = useRef(null);

    function showError(msg) {
        setMensaje(msg);
        clearTimeout(errorTimer.current);
        errorTimer.current = setTimeout(() => setMensaje(''), 4000);
    }

    function handleChange(field, value) {
        setForm(prev => ({ ...prev, [field]: value }));
        setMensaje('');
        clearTimeout(errorTimer.current);
    }

    async function login_proccess() {
        const result = await onLogin(form);
        if (!result.ok) {
            showError('Credenciales incorrectas. Intenta de nuevo.');
        }
    }

    return (
        <div className='login-layout'>
            <main className='login-form'>
                <h1>Iniciar sesión</h1>
                <div>
                    <label className='login-credential' htmlFor="EmailUsername">CORREO O USUARIO</label>
                    <input
                        className='login-input'
                        type="text"
                        id="EmailUsername"
                        name="email_user"
                        value={form.email_user}
                        onChange={(e) => handleChange('email_user', e.target.value)}
                    />
                </div>
                <div>
                    <label className='login-credential' htmlFor="Password">CONTRASEÑA</label>
                    <div className='login-password-wrap'>
                        <input
                            className='login-input login-input-password'
                            type={showPassword ? 'text' : 'password'}
                            id="Password"
                            name="password"
                            value={form.password}
                            onChange={(e) => handleChange('password', e.target.value)}
                        />
                        <button
                            type="button"
                            className='login-eye-btn'
                            onClick={() => setShowPassword(v => !v)}
                            tabIndex={-1}
                            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                            {showPassword ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                                    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                                    <line x1="1" y1="1" x2="23" y2="23"/>
                                </svg>
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                            )}
                        </button>
                    </div>
                </div>
                <button className='login-button' onClick={login_proccess}>Entrar</button>
                {mensaje && <p className='login-error'>{mensaje}</p>}
            </main>
        </div>
    );
}

export default Login;
