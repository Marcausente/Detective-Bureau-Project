import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function InternalAffairs() {
    const navigate = useNavigate();
    const { isLSSD } = useTheme();
    const { language } = useLanguage();

    const modules = [
        {
            id: 'cases',
            path: '/internal-affairs/cases',
            title: language === 'es' ? 'Investigaciones Internas' : 'Internal Investigations',
            desc: language === 'es' ? 'Gestionar archivos de casos e indagaciones activas de la división.' : 'Manage case files and active inquiries.',
            color: '#ef4444',
            bgGlow: 'rgba(239, 68, 68, 0.12)',
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
            )
        },
        {
            id: 'docs',
            path: '/internal-affairs/docs',
            title: language === 'es' ? 'Documentación de IA' : 'IA Documentation',
            desc: language === 'es' ? 'Protocolos, normativas internas y recursos clasificados.' : 'Classified protocols and resources.',
            color: '#f59e0b',
            bgGlow: 'rgba(245, 158, 11, 0.12)',
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
            )
        },
        {
            id: 'interrogations',
            path: '/internal-affairs/interrogations',
            title: language === 'es' ? 'Interrogatorios' : 'Interrogations',
            desc: language === 'es' ? 'Registro y actas de entrevistas a sujetos bajo investigación.' : 'Subject interviews registry.',
            color: '#14b8a6',
            bgGlow: 'rgba(20, 184, 166, 0.12)',
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
            )
        },
        {
            id: 'sanctions',
            path: '/internal-affairs/sanctions',
            title: language === 'es' ? 'Sanciones Disciplinarias' : 'Disciplinary Sanctions',
            desc: language === 'es' ? 'Registro de acciones disciplinarias y expediente de agentes.' : 'Disciplinary actions log.',
            color: '#8b5cf6',
            bgGlow: 'rgba(139, 92, 246, 0.12)',
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v18"/>
                    <path d="M5 8l7-5 7 5"/>
                    <path d="M5 12h14"/>
                    <path d="M3 20h18"/>
                </svg>
            )
        },
        {
            id: 'receptor',
            path: '/internal-affairs/receptor-denuncias',
            title: language === 'es' ? 'Receptor de Denuncias' : 'Complaints Receiver',
            desc: language === 'es' ? 'Recibir y gestionar denuncias de Asuntos Internos.' : 'Receive and manage Internal Affairs complaints.',
            color: '#38bdf8',
            bgGlow: 'rgba(56, 189, 248, 0.12)',
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                </svg>
            )
        }
    ];

    return (
        <div className="mac-dashboard-container">
            {/* Command Header Banner */}
            <div className="mac-command-banner" style={{ marginBottom: '2.5rem', background: 'linear-gradient(135deg, rgba(30, 27, 38, 0.75), rgba(15, 23, 42, 0.85))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <img
                        src={isLSSD ? "/logowebp/IALSSD.webp" : "/logowebp/ialogo.webp"}
                        alt="IA Division Logo"
                        style={{
                            height: '75px',
                            width: 'auto',
                            filter: `drop-shadow(0 4px 16px ${isLSSD ? 'rgba(74, 222, 128, 0.4)' : 'rgba(239, 68, 68, 0.45)'})`
                        }}
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span className="mac-status-dot" style={{ backgroundColor: '#ef4444', boxShadow: '0 0 10px #ef4444' }}></span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {isLSSD ? "Sheriff Internal Affairs Division" : "Internal Affairs Bureau"}
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.2rem 0 0.4rem 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {language === 'es' ? 'ASUNTOS INTERNOS' : 'INTERNAL AFFAIRS'}
                        </h1>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.4rem 0.9rem', borderRadius: '20px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f87171', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {language === 'es' ? 'Solo Personal Autorizado' : 'Authorized Personnel Only'}
                    </span>
                </div>
            </div>

            {/* Dashboard Modules Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '1.5rem'
            }}>
                {modules.map(mod => (
                    <div
                        key={mod.id}
                        className="mac-widget-card"
                        onClick={() => navigate(mod.path)}
                        style={{
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '1.6rem',
                            position: 'relative',
                            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, border-color 0.25s ease',
                            borderLeft: `4px solid ${mod.color}`,
                            overflow: 'hidden'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = `0 16px 36px -8px ${mod.bgGlow}`;
                            e.currentTarget.style.borderColor = mod.color;
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        }}
                    >
                        {/* Module Icon Container */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '1.25rem'
                        }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '16px',
                                background: mod.bgGlow,
                                border: `1px solid ${mod.color}35`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: mod.color
                            }}>
                                {mod.icon}
                            </div>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64748b' }}>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                                <polyline points="12 5 19 12 12 19"/>
                            </svg>
                        </div>

                        {/* Title & Description */}
                        <h3 style={{
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            margin: '0 0 0.5rem 0',
                            letterSpacing: '-0.01em'
                        }}>
                            {mod.title}
                        </h3>
                        <p style={{
                            fontSize: '0.85rem',
                            color: '#94a3b8',
                            lineHeight: '1.5',
                            margin: 0
                        }}>
                            {mod.desc}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default InternalAffairs;
