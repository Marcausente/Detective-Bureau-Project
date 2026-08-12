import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { isLSSD } = useTheme();
    const { t } = useLanguage();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { data, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError(authError.message === 'Invalid login credentials' 
                ? 'Credenciales incorrectas. Comprueba tu correo y contraseña.' 
                : authError.message);
            setLoading(false);
        } else {
            navigate('/welcome');
        }
    };

    return (
        <div className="mac-login-wrapper">
            {/* Background Ambient Mesh & Image */}
            <div className="mac-login-bg">
                <img 
                    src={isLSSD ? "/logowebp/fondolssd.webp" : "/logowebp/indeximage.webp"} 
                    alt="Department Background" 
                    className="mac-login-bg-img" 
                />
                <div className="mac-login-bg-overlay" />
            </div>

            {/* Department Brand Top Header */}
            <div className="mac-login-header">
                <img 
                    src={isLSSD ? "/logowebp/LSSDlogo.webp" : "/logowebp/LSSDlogo.webp"} 
                    alt="Department Logo" 
                    className="mac-login-logo" 
                />
                <div className="mac-login-header-titles">
                    <span className="mac-login-dept-title">
                        {isLSSD ? "Los Santos Sheriff's Department" : "Los Santos Police Department"}
                    </span>
                    <span className="mac-login-bureau-title">
                        {isLSSD ? "Sheriff Criminal Unit Bureau" : "Detective Bureau"}
                    </span>
                </div>
                <img 
                    src={isLSSD ? "/logowebp/SCUB.webp" : "/logowebp/dblogo.webp"} 
                    alt="Bureau Crest" 
                    className="mac-login-logo" 
                />
            </div>

            {/* Central macOS Login Portal Window */}
            <div className="mac-login-card">
                {/* macOS Window Title Header */}
                <div className="mac-login-window-bar">
                    <div className="mac-window-dots">
                        <div className="mac-window-dot close" title="Cerrar"></div>
                        <div className="mac-window-dot min" title="Minimizar"></div>
                        <div className="mac-window-dot max" title="Ampliar"></div>
                    </div>
                    <span className="mac-login-window-title">
                        Terminal de Autenticación Rápida
                    </span>
                    <div style={{ width: 52 }} />
                </div>

                {/* Card Main Body */}
                <div className="mac-login-body">
                    <div className="mac-login-badge-hero">
                        <img 
                            src={isLSSD ? "/logowebp/SCUB.webp" : "/logowebp/dblogo.webp"} 
                            alt="Crest" 
                            className="mac-login-crest-icon" 
                        />
                        <h2 className="mac-login-headline">
                            {t('authAccess') || 'Autenticación de Agente'}
                        </h2>
                        <div className="mac-login-subtext">
                            <span className="mac-status-dot" style={{ width: 7, height: 7 }}></span>
                            <span>{t('identifyYourself') || 'Identifícate con tus credenciales asignadas'}</span>
                        </div>
                    </div>

                    {/* Error Notification Alert */}
                    {error && (
                        <div style={{
                            padding: '0.85rem 1rem',
                            marginBottom: '1.25rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            borderRadius: '16px',
                            color: '#f87171',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            animation: 'macFadeIn 0.2s ease'
                        }}>
                            <span style={{ fontSize: '1rem' }}>✕</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin}>
                        {/* Email Input */}
                        <div className="mac-form-group">
                            <label className="mac-form-label">{t('email') || 'Correo Electrónico Oficial'}</label>
                            <div className="mac-input-with-icon">
                                <span className="mac-input-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                        <polyline points="22,6 12,13 2,6" />
                                    </svg>
                                </span>
                                <input
                                    type="email"
                                    className="mac-form-input has-icon"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder={isLSSD ? "matthewrosenberg@lssd.com" : "matthewrosenberg@lspd.com"}
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="mac-form-group" style={{ marginBottom: '1.75rem' }}>
                            <label className="mac-form-label">{t('password') || 'Contraseña de Acceso'}</label>
                            <div className="mac-input-with-icon">
                                <span className="mac-input-icon">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                </span>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="mac-form-input has-icon"
                                    style={{ paddingRight: '2.5rem' }}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    className="mac-password-toggle-btn"
                                    onClick={() => setShowPassword(prev => !prev)}
                                    title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                >
                                    {showPassword ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit Primary Button */}
                        <button 
                            type="submit" 
                            className="mac-btn mac-btn-primary" 
                            disabled={loading}
                            style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontSize: '0.95rem' }}
                        >
                            {loading ? (
                                <>
                                    <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite' }}></span>
                                    <span>{t('authenticating') || 'Verificando Credenciales...'}</span>
                                </>
                            ) : (
                                <>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                        <polyline points="10 17 15 12 10 7" />
                                        <line x1="15" y1="12" x2="3" y2="12" />
                                    </svg>
                                    <span>{t('accessSystem') || 'Acceder al Sistema'}</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            {/* Footer System Notice */}
            <div className="mac-login-footer-bar">
                <span>{isLSSD ? 'Sheriff Criminal Unit Bureau' : 'Detective Bureau Division'} • Sistema Encifrado y Monitoreado</span>
            </div>
        </div>
    );
}

export default Login;
