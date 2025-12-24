import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../index.css';

function Dashboard() {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    return (
        <div className="main-content" style={{ flexDirection: 'column', color: 'var(--text-primary)' }}>
            <h1>Detective Bureau Dashboard</h1>
            <p>Welcome, Detective.</p>
            <br />
            <button onClick={handleLogout} className="login-button" style={{ maxWidth: '200px' }}>
                Log Out
            </button>
        </div>
    );
}

export default Dashboard;
