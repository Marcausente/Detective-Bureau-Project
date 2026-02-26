import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import PracticeArchive from '../../components/Training/PracticeArchive';
import PracticeSchedule from '../../components/Training/PracticeSchedule';
import './Training.css'; // Import the new CSS file

function TrainingBase() {
    const [activeTab, setActiveTab] = useState('archive');
    const [isAuthorized, setIsAuthorized] = useState(null);

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                setIsAuthorized(false);
                return;
            }
            
            const { data: profile } = await supabase
                .from('users')
                .select('rol, divisions')
                .eq('id', session.user.id)
                .single();
                
            if (profile) {
                if (profile.rol === 'Administrador' || profile.rol === 'superadmin') {
                    setIsAuthorized(true);
                    return;
                }
                
                const hasDivision = profile.divisions && profile.divisions.includes('Detective Bureau');
                const allowedRoles = ['detective', 'coordinador'];
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
            <div className="dtp-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div style={{ color: '#63b3ed', fontSize: '1.2rem' }}>Verificando credenciales...</div>
            </div>
        );
    }

    if (isAuthorized === false) {
        return (
            <div className="dtp-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="dtp-glass-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '500px' }}>
                    <svg width="60" height="60" fill="none" stroke="#fc8181" viewBox="0 0 24 24" style={{ marginBottom: '1rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    <h2 style={{ color: '#fc8181', marginBottom: '1rem' }}>Acceso Restringido</h2>
                    <p style={{ color: '#a0aec0', lineHeight: '1.6' }}>El Detective Training Program es un módulo clasificado. Se requiere pertenecer a la Detective Bureau y tener rango de Detective o superior para acceder a esta información.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="dtp-container">
            <header className="dtp-header">
                <img src="/DTP%20logo.png" alt="DTP Logo" className="dtp-logo" />
                <div className="dtp-title-wrapper">
                    <h1>Detective Training Program</h1>
                    <p>Departamento de Instrucción y Capacitación Continua</p>
                </div>
            </header>
            
            <div className="dtp-tabs">
                <button 
                    className={`dtp-tab-btn ${activeTab === 'archive' ? 'active' : ''}`}
                    onClick={() => setActiveTab('archive')}
                >
                    <i className="fas fa-folder-open" style={{marginRight: '8px'}}></i> Archive
                </button>
                <button 
                    className={`dtp-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
                    onClick={() => setActiveTab('schedule')}
                >
                    <i className="fas fa-calendar-alt" style={{marginRight: '8px'}}></i> Schedule
                </button>
            </div>

            <div className="tab-content" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                {activeTab === 'archive' && <PracticeArchive />}
                {activeTab === 'schedule' && <PracticeSchedule />}
            </div>
        </div>
    );
}

export default TrainingBase;
