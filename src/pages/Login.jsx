import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { isLSSD } = useTheme();
    const { t } = useLanguage();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true); //test
        setError(null);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            // Successful login
            navigate('/welcome');
        }
    };

    return (
        <div className="app-container">
            {/* Background */}
            <div className="background-container">
                <img src={isLSSD ? "/lssd/fondolssd.jpg" : "/indeximage.png"} alt="Background" className="background-image" />
            </div>

            {/* Header */}
            <header className="header">
                <img src={isLSSD ? "/lssd/LSSDlogo.png" : "/LOGO_SAPD.png"} alt="Department Logo" className="header-logo" />
                <div className="header-title-container">
                    <h1 className="header-title">{isLSSD ? "Los Santos Sheriff's Department" : "Los Santos Police Department"}</h1>
                    <div className="header-subtitle">{isLSSD ? "Sheriff Criminal Unit Bureau" : "Detective Bureau"}</div>
                </div>
                <img src={isLSSD ? "/lssd/SCUB.png" : "/dblogo.png"} alt="Bureau Logo" className="header-logo" />
            </header>

            {/* Main Content */}
            <main className="main-content">
                <div className="login-card">
                    <div className="login-header">
                        <h2>{t('authAccess')}</h2>
                        <p>{t('identifyYourself')}</p>
                    </div>

                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label">{t('email')}</label>
                            <input
                                type="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Ex: mrosenberg@lspd.com"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('password')}</label>
                            <input
                                type="password"
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

                        <button type="submit" className="login-button" disabled={loading}>
                            {loading ? t('authenticating') : t('accessSystem')}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}

export default Login;
