import { useNavigate } from 'react-router-dom';
import '../index.css';

function DOJ() {
    const navigate = useNavigate();

    return (
        <div className="documentation-container" style={{
            padding: '1rem 2rem 4rem',
            maxWidth: '1200px',
            margin: '0 auto',
            minHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
        }}>

            {/* Hero Section */}
            <div style={{ textAlign: 'center', marginBottom: '3rem', animation: 'fadeIn 1s ease-out' }}>
                <img
                    src="/doj-logo.png"
                    alt="DOJ Logo"
                    style={{
                        width: '120px',
                        height: 'auto',
                        marginBottom: '1rem',
                        filter: 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.4))'
                    }}
                />
                <h1 style={{
                    fontSize: '2.5rem',
                    fontWeight: '800',
                    letterSpacing: '4px',
                    color: '#f8fafc',
                    marginBottom: '0.2rem',
                    textShadow: '0 4px 10px rgba(0,0,0,0.5)'
                }}>
                    DEPARTMENT OF JUSTICE
                </h1>
                <h2 style={{
                    fontSize: '0.9rem',
                    color: '#3b82f6',
                    textTransform: 'uppercase',
                    letterSpacing: '4px',
                    borderTop: '1px solid #1e3a8a',
                    borderBottom: '1px solid #1e3a8a',
                    display: 'inline-block',
                    padding: '0.3rem 1.5rem',
                    background: 'rgba(0,0,0,0.2)'
                }}>
                    Authorized Personnel Only
                </h2>
            </div>

            {/* Dashboard Grid */}
            <div className="dashboard-grid" style={{
                width: '100%',
                gap: '2.5rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
            }}>

                {/* Active Module: Cases */}
                <div
                    className="ia-card"
                    onClick={() => navigate('/doj/cases')}
                    style={{
                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '2rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-5px)';
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(59, 130, 246, 0.3)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <div style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        borderRadius: '50%',
                        width: '70px',
                        height: '70px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1.5rem',
                        color: '#3b82f6',
                        fontSize: '2rem'
                    }}>
                        📁
                    </div>
                    <h3 style={{ color: '#f8fafc', fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: '600', letterSpacing: '1px' }}>Legal Investigations</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>Manage case files and active inquiries.</p>
                </div>

                {/* Active Module: Documentation */}
                <div
                    className="ia-card"
                    onClick={() => navigate('/doj/docs')}
                    style={{
                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '2rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-5px)';
                        e.currentTarget.style.borderColor = '#f59e0b';
                        e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(245, 158, 11, 0.3)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <div style={{
                        background: 'rgba(245, 158, 11, 0.1)',
                        borderRadius: '50%',
                        width: '70px',
                        height: '70px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1.5rem',
                        color: '#f59e0b',
                        fontSize: '2rem'
                    }}>
                        🗄️
                    </div>
                    <h3 style={{ color: '#f8fafc', fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: '600', letterSpacing: '1px' }}>DOJ Documentation</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>Legal protocols and resources.</p>
                </div>

                {/* Active Module: Interrogations */}
                <div
                    className="ia-card"
                    onClick={() => navigate('/doj/interrogations')}
                    style={{
                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '2rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-5px)';
                        e.currentTarget.style.borderColor = '#14b8a6';
                        e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(20, 184, 166, 0.3)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <div style={{
                        background: 'rgba(20, 184, 166, 0.1)',
                        borderRadius: '50%',
                        width: '70px',
                        height: '70px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1.5rem',
                        color: '#14b8a6',
                        fontSize: '2rem'
                    }}>
                        📝
                    </div>
                    <h3 style={{ color: '#f8fafc', fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: '600', letterSpacing: '1px' }}>Interrogations</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>Subject interviews registry.</p>
                </div>

                {/* Active Module: Sanctions */}
                <div
                    className="ia-card"
                    onClick={() => navigate('/doj/sanctions')}
                    style={{
                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.4), rgba(15, 23, 42, 0.6))',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '2rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-5px)';
                        e.currentTarget.style.borderColor = '#8b5cf6';
                        e.currentTarget.style.boxShadow = '0 10px 30px -10px rgba(139, 92, 246, 0.3)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <div style={{
                        background: 'rgba(139, 92, 246, 0.1)',
                        borderRadius: '50%',
                        width: '70px',
                        height: '70px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1.5rem',
                        color: '#8b5cf6',
                        fontSize: '2rem'
                    }}>
                        ⚖️
                    </div>
                    <h3 style={{ color: '#f8fafc', fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: '600', letterSpacing: '1px' }}>Sanctions</h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: '1.5' }}>Legal actions log.</p>
                </div>

            </div>
        </div>
    );
}

export default DOJ;
