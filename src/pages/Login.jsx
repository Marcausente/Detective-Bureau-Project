import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
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
            navigate('/dashboard');
        }
    };

    return (
        <div className="app-container">
            {/* Background */}
            <div className="background-container">
                <img src="/indeximage.png" alt="Background" className="background-image" />
            </div>

            {/* Header */}
            <header className="header">
                <img src="/LOGO_SAPD.png" alt="SAPD Logo" className="header-logo" />
                <div className="header-title-container">
                    <h1 className="header-title">Los Santos Police Department</h1>
                    <div className="header-subtitle">Detective Bureau</div>
                </div>
                <img src="/dblogo.png" alt="Detective Bureau Logo" className="header-logo" />
            </header>

            {/* Main Content */}
            <main className="main-content">
                <div className="login-card">
                    <div className="login-header">
                        <h2>Authorized Access</h2>
                        <p>Please identify yourself, Detective.</p>
                    </div>

                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label">Email:</label>
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
                            <label className="form-label">Password</label>
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
                            {loading ? 'Authenticating...' : 'Access System'}
                        </button>
                    </form>
                </div>
            </main>
        </div>
    );
}

export default Login;
