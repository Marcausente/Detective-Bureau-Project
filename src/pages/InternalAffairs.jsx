import { useNavigate } from 'react-router-dom';
import '../index.css';

function InternalAffairs() {
    const navigate = useNavigate();

    return (
        <div className="documentation-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 className="page-title" style={{ marginBottom: '2rem', color: '#f87171' }}>INTERNAL AFFAIRS DIVISION</h1>

            <div className="dashboard-grid">
                <div className="dashboard-card" onClick={() => navigate('/internal-affairs/cases')}>
                    <h3>📁 Internal Investigations</h3>
                    <p>Manage confidential case files against department members.</p>
                </div>
                <div className="dashboard-card" onClick={() => navigate('/internal-affairs/docs')}>
                    <h3>🗄️ IA Documentation</h3>
                    <p>Standard operating procedures and classified protocols.</p>
                </div>
                {/* 
                <div className="dashboard-card" onClick={() => navigate('/internal-affairs/interrogations')}>
                    <h3>📝 Interrogation Registry</h3>
                    <p>Record and access interrogation logs for IA matters.</p>
                </div>
                <div className="dashboard-card" onClick={() => navigate('/internal-affairs/sanctions')}>
                    <h3>⚖️ Sanctions Registry</h3>
                    <p>Log disciplinary actions, warnings, and suspensions.</p>
                </div>
                 */}
                <div className="dashboard-card" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                    <h3>📝 Interrogation Registry (Coming Soon)</h3>
                    <p>Record and access interrogation logs for IA matters.</p>
                </div>
                <div className="dashboard-card" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                    <h3>⚖️ Sanctions Registry (Coming Soon)</h3>
                    <p>Log disciplinary actions, warnings, and suspensions.</p>
                </div>
            </div>
        </div>
    );
}

export default InternalAffairs;
