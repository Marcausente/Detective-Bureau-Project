import { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import PracticeArchive from '../../components/Training/PracticeArchive';
import PracticeSchedule from '../../components/Training/PracticeSchedule';
import PracticeCount from '../../components/Training/PracticeCount';
import './Training.css';

function TrainingBase() {
    const [activeTab, setActiveTab] = useState('archive');
    const [isAuthorized, setIsAuthorized] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    
    const isAyudante = userProfile?.rol?.toLowerCase() === 'ayudante';
    const isHighCommand = ['coordinador', 'comisionado', 'administrador', 'superadmin'].includes(userProfile?.rol?.toLowerCase());
    const isDTP = userProfile?.divisions && userProfile.divisions.includes('DTP');
    const canManageDTP = isDTP || isHighCommand;

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setIsAuthorized(false);
                return;
            }
            
            const { data: profile } = await supabase
                .from('users')
                .select('id, nombre, apellido, rango, rol, divisions')
                .eq('id', session.user.id)
                .single();
                
            if (profile) {
                setUserProfile(profile);
                
                const isHighCommand = ['coordinador', 'comisionado', 'administrador', 'superadmin'].includes(profile.rol?.toLowerCase());
                const isDTP = profile.divisions && profile.divisions.includes('DTP');
                const canManage = isDTP || isHighCommand;
                const isAyu = profile.rol?.toLowerCase() === 'ayudante';

                if (isAyu || !canManage) {
                    setActiveTab('schedule');
                } else {
                    setActiveTab('archive');
                }
                
                if (profile.rol === 'Administrador' || profile.rol === 'superadmin') {
                    setIsAuthorized(true);
                    return;
                }
                
                const hasDivision = profile.divisions && (profile.divisions.includes('Detective Bureau') || profile.divisions.includes('DTP'));
                const allowedRoles = ['detective', 'coordinador', 'ayudante', 'comisionado'];
                const userRole = profile.rol ? profile.rol.toLowerCase() : '';
                
                if (hasDivision && allowedRoles.includes(userRole)) {
                    setIsAuthorized(true);
                } else {
                    setIsAuthorized(false);
                }
            } else {
                setIsAuthorized(false);
            }
        };
        checkAuth();
    }, []);

    if (isAuthorized === null) {
        return (
            <div className="dtp-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#94a3b8', fontSize: '0.95rem' }}>
                    <div style={{ width: '18px', height: '18px', border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                    Verificando credenciales DTP...
                </div>
            </div>
        );
    }

    if (isAuthorized === false) {
        return (
            <div className="dtp-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <div className="dtp-glass-card" style={{ padding: '2.5rem', textAlign: 'center', maxWidth: '480px' }}>
                    <svg width="50" height="50" fill="none" stroke="#f87171" viewBox="0 0 24 24" style={{ marginBottom: '1rem' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                    </svg>
                    <h2 style={{ color: '#f87171', marginBottom: '0.75rem', fontSize: '1.4rem', fontWeight: 800 }}>Acceso Restringido</h2>
                    <p style={{ color: '#94a3b8', lineHeight: '1.6', fontSize: '0.88rem' }}>El Detective Training Program es un módulo clasificado. Se requiere pertenecer al Detective Bureau y tener rango de Detective o superior para acceder a esta información.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dtp-container">
            {/* Header Title Bar with Apple Status LED Banner */}
            <header className="dtp-header">
                <div className="dtp-brand">
                    <span className="dtp-status-led" title="Sistema DTP Activo" />
                    <img src="/logowebp/DTP logo.webp" alt="DTP Logo" className="dtp-logo" />
                    <div className="dtp-title-wrapper">
                        <h1>Detective Training Program</h1>
                        <p>Departamento de Instrucción y Capacitación Continua</p>
                    </div>
                </div>
            </header>
            
            {/* Apple macOS Glass Segmented Tabs (NO EMOJIS) */}
            <div className="dtp-tabs-bar">
                {canManageDTP && (
                    <button 
                        type="button"
                        className={`dtp-tab-btn ${activeTab === 'archive' ? 'active' : ''}`}
                        onClick={() => setActiveTab('archive')}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                        Archive
                    </button>
                )}
                <button 
                    type="button"
                    className={`dtp-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
                    onClick={() => setActiveTab('schedule')}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Schedule
                </button>
                <button 
                    type="button"
                    className={`dtp-tab-btn ${activeTab === 'count' ? 'active' : ''}`}
                    onClick={() => setActiveTab('count')}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    Conteo
                </button>
            </div>

            <div className="tab-content" style={{ animation: 'macFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
                {activeTab === 'archive' && canManageDTP && <PracticeArchive userProfile={userProfile} />}
                {activeTab === 'schedule' && <PracticeSchedule userProfile={userProfile} />}
                {activeTab === 'count' && <PracticeCount />}
            </div>
        </div>
    );
}

export default TrainingBase;
