import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { getProfileImage } from '../utils/imageStorage';
import '../index.css';

function SEB() {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ops'); // 'ops' | 'roster' | 'equipment'
    const [personnelList, setPersonnelList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Tactical Operations State (Local + Persistent fallback)
    const [operations, setOperations] = useState([
        {
            id: 'SEB-OP-2026-01',
            title: 'Operación ' + (language === 'es' ? 'Cerbero' : 'Cerberus'),
            location: 'El Burro Heights Industrial District',
            status: 'En Progreso',
            type: 'Asalto Táctico & Rescate',
            leader: 'SEB Agent Martinez',
            teamSize: '6 Agentes',
            date: '2026-08-12',
            description: 'Operación de alta prioridad para neutralizar objetivo fuertemente armado y asegurar rehenes en almacén abandonado.'
        },
        {
            id: 'SEB-OP-2026-02',
            title: 'Operación ' + (language === 'es' ? 'Escudo Dorado' : 'Golden Shield'),
            location: 'Del Perro Freeway Highway Blockade',
            status: 'Completada',
            type: 'Bloqueo & Escolta Táctica',
            leader: 'SEB Agent Vance',
            teamSize: '4 Agentes',
            date: '2026-08-10',
            description: 'Intervención de contingencia y aseguramiento de convoy judicial durante traslado de alto riesgo.'
        },
        {
            id: 'SEB-OP-2026-03',
            title: 'Operación ' + (language === 'es' ? 'Sombra Verde' : 'Green Shadow'),
            location: 'Chiliad Mountain State Wilderness',
            status: 'En Espera',
            type: 'Rastreo & Tiradores de Precisión',
            leader: 'SEB Agent Kowalski',
            teamSize: '3 Agentes',
            date: '2026-08-08',
            description: 'Despliegue de francotiradores y reconocimiento en terreno escarpado ante sospecha de campamento furtivo.'
        }
    ]);

    // Modal state for creating operation
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newOp, setNewOp] = useState({
        title: '',
        location: '',
        status: 'En Progreso',
        type: 'Asalto Táctico & Rescate',
        leader: '',
        teamSize: '4 Agentes',
        description: ''
    });

    useEffect(() => {
        loadUserProfile();
    }, []);

    useEffect(() => {
        if (profile && hasAccess()) {
            fetchSEBPersonnel();
        }
    }, [profile]);

    const loadUserProfile = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                setProfile(data);
            }
        } catch (err) {
            console.error('Error loading profile in SEB page:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSEBPersonnel = async () => {
        try {
            const { data } = await supabase
                .from('users')
                .select('*')
                .order('rango');
            if (data) {
                const filtered = data.filter(u => 
                    u.rango === 'SEB Agent' || 
                    (u.divisions && u.divisions.includes('SEB'))
                );
                setPersonnelList(filtered);
            }
        } catch (err) {
            console.error('Error fetching SEB personnel:', err);
        }
    };

    const hasAccess = () => {
        if (!profile) return false;
        const role = profile.rol ? profile.rol.toLowerCase().trim() : '';
        const isSEBRank = profile.rango === 'SEB Agent';
        const isSEBDivision = profile.divisions && profile.divisions.includes('SEB');
        const allowedRoles = ['coordinador', 'comisionado', 'administrador', 'superadmin', 'admin'];

        return isSEBRank || isSEBDivision || allowedRoles.includes(role);
    };

    const handleCreateOperation = (e) => {
        e.preventDefault();
        if (!newOp.title || !newOp.location) return;

        const opCreated = {
            id: `SEB-OP-${new Date().getFullYear()}-${String(operations.length + 1).padStart(2, '0')}`,
            title: newOp.title,
            location: newOp.location,
            status: newOp.status,
            type: newOp.type,
            leader: newOp.leader || `${profile?.nombre || 'Agente'} ${profile?.apellido || ''}`,
            teamSize: newOp.teamSize,
            date: new Date().toISOString().split('T')[0],
            description: newOp.description
        };

        setOperations([opCreated, ...operations]);
        setIsModalOpen(false);
        setNewOp({
            title: '',
            location: '',
            status: 'En Progreso',
            type: 'Asalto Táctico & Rescate',
            leader: '',
            teamSize: '4 Agentes',
            description: ''
        });
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#cbd5e1' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem', width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#eab308', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <p>{language === 'es' ? 'Cargando credenciales de SEB...' : 'Loading SEB credentials...'}</p>
                </div>
            </div>
        );
    }

    // Access Denied Screen
    if (!hasAccess()) {
        return (
            <div style={{ padding: '3rem 1.5rem', maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
                <div style={{
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '16px',
                    padding: '3rem 2rem',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '2px solid rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem auto'
                    }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                    </div>

                    <h2 style={{ fontSize: '1.75rem', color: '#ffffff', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '1px' }}>
                        {language === 'es' ? 'ACCESO RESTRINGIDO' : 'RESTRICTED ACCESS'}
                    </h2>
                    <h3 style={{ fontSize: '0.95rem', color: '#f87171', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1.25rem', fontWeight: 700 }}>
                        Special Enforcement Bureau (SEB)
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                        {language === 'es' 
                            ? 'Este apartado es de acceso reservado únicamente para agentes asignados al rango/división SEB o personal con rango de Coordinador, Comisionado o Administrador.'
                            : 'This section is strictly reserved for SEB Agent rank/division personnel or Coordination/Commissioner/Admin roles.'}
                    </p>

                    <button
                        onClick={() => navigate('/dashboard')}
                        style={{
                            background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                            color: '#0f172a',
                            border: 'none',
                            padding: '0.75rem 2rem',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(234, 179, 8, 0.3)',
                            transition: 'transform 0.2s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        {language === 'es' ? 'Volver al Inicio' : 'Return to Dashboard'}
                    </button>
                </div>
            </div>
        );
    }

    const filteredOperations = operations.filter(op => 
        op.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="mac-dashboard-container" style={{ maxWidth: '1280px', margin: '0 auto', paddingBottom: '3rem' }}>
            
            {/* Tactical Banner */}
            <div className="mac-command-banner" style={{ 
                marginBottom: '2rem', 
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95))',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                borderRadius: '16px',
                padding: '1.75rem 2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(202, 138, 4, 0.05))',
                        border: '1.5px solid rgba(234, 179, 8, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 20px rgba(234, 179, 8, 0.15)'
                    }}>
                        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                            <span style={{ 
                                display: 'inline-block', 
                                width: '8px', 
                                height: '8px', 
                                borderRadius: '50%', 
                                backgroundColor: '#eab308', 
                                boxShadow: '0 0 8px #eab308' 
                            }}></span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                Special Enforcement Bureau • SEB
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.9rem', fontWeight: 800, margin: 0, color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {language === 'es' ? 'DIVISIÓN OPERATIVA DE ALTO RIESGO' : 'HIGH RISK TACTICAL DIVISION'}
                        </h1>
                        <p style={{ margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                            {language === 'es' ? 'Plataforma táctica, control de despliegues y gestión de operaciones especiales.' : 'Tactical platform, deployment control, and special operations management.'}
                        </p>
                    </div>
                </div>

                {/* Status Pill */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    background: 'rgba(15, 23, 42, 0.7)',
                    padding: '0.6rem 1.2rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>
                            {language === 'es' ? 'Nivel Operativo' : 'Operational Level'}
                        </div>
                        <div style={{ fontSize: '0.95rem', color: '#eab308', fontWeight: 800 }}>
                            DEFCON 1 • SEB READY
                        </div>
                    </div>
                </div>
            </div>

            {/* Tactical Navigation Tabs */}
            <div style={{ 
                display: 'flex', 
                gap: '0.75rem', 
                marginBottom: '1.75rem', 
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)', 
                paddingBottom: '0.75rem' 
            }}>
                <button
                    onClick={() => setActiveTab('ops')}
                    style={{
                        background: activeTab === 'ops' ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(234, 179, 8, 0.05))' : 'rgba(30, 41, 59, 0.4)',
                        border: activeTab === 'ops' ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.08)',
                        color: activeTab === 'ops' ? '#ffffff' : '#94a3b8',
                        padding: '0.6rem 1.4rem',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                        <polyline points="2 17 12 22 22 17"/>
                        <polyline points="2 12 12 17 22 12"/>
                    </svg>
                    {language === 'es' ? 'Operaciones Tácticas' : 'Tactical Operations'} ({operations.length})
                </button>

                <button
                    onClick={() => setActiveTab('roster')}
                    style={{
                        background: activeTab === 'roster' ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(234, 179, 8, 0.05))' : 'rgba(30, 41, 59, 0.4)',
                        border: activeTab === 'roster' ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.08)',
                        color: activeTab === 'roster' ? '#ffffff' : '#94a3b8',
                        padding: '0.6rem 1.4rem',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    {language === 'es' ? 'Cuadrilla SEB' : 'SEB Squad Roster'} ({personnelList.length})
                </button>

                <button
                    onClick={() => setActiveTab('equipment')}
                    style={{
                        background: activeTab === 'equipment' ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(234, 179, 8, 0.05))' : 'rgba(30, 41, 59, 0.4)',
                        border: activeTab === 'equipment' ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.08)',
                        color: activeTab === 'equipment' ? '#ffffff' : '#94a3b8',
                        padding: '0.6rem 1.4rem',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                    {language === 'es' ? 'Arsenal & Equipamiento' : 'Armory & Equipment'}
                </button>
            </div>

            {/* TAB 1: OPERATIONS */}
            {activeTab === 'ops' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
                            <input
                                type="text"
                                placeholder={language === 'es' ? 'Buscar operaciones tácticas...' : 'Search tactical operations...'}
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '10px',
                                    padding: '0.65rem 1rem 0.65rem 2.5rem',
                                    color: '#ffffff',
                                    fontSize: '0.88rem'
                                }}
                            />
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }}>
                                <circle cx="11" cy="11" r="8"/>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                        </div>

                        <button
                            onClick={() => setIsModalOpen(true)}
                            style={{
                                background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                                color: '#0f172a',
                                border: 'none',
                                padding: '0.65rem 1.25rem',
                                borderRadius: '10px',
                                fontWeight: 700,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 4px 12px rgba(234, 179, 8, 0.25)'
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            {language === 'es' ? 'Registrar Operación Táctica' : 'Log Tactical Operation'}
                        </button>
                    </div>

                    {/* Operations Cards List */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
                        {filteredOperations.map(op => (
                            <div 
                                key={op.id}
                                style={{
                                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.75))',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '14px',
                                    padding: '1.25rem',
                                    position: 'relative',
                                    transition: 'transform 0.2s ease, border-color 0.2s ease',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#eab308', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                        {op.id}
                                    </span>
                                    <span style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '0.25rem 0.65rem',
                                        borderRadius: '20px',
                                        background: op.status === 'En Progreso' ? 'rgba(234, 179, 8, 0.15)' : op.status === 'Completada' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                                        color: op.status === 'En Progreso' ? '#facc15' : op.status === 'Completada' ? '#4ade80' : '#cbd5e1',
                                        border: `1px solid ${op.status === 'En Progreso' ? 'rgba(234, 179, 8, 0.3)' : op.status === 'Completada' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(148, 163, 184, 0.3)'}`
                                    }}>
                                        {op.status}
                                    </span>
                                </div>

                                <h3 style={{ fontSize: '1.1rem', color: '#ffffff', fontWeight: 800, margin: '0 0 0.4rem 0' }}>
                                    {op.title}
                                </h3>

                                <div style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                        <circle cx="12" cy="10" r="3"/>
                                    </svg>
                                    {op.location}
                                </div>

                                <p style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: '1.5', marginBottom: '1rem', background: 'rgba(15, 23, 42, 0.4)', padding: '0.65rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    {op.description}
                                </p>

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.75rem' }}>
                                    <span>Líder: <strong style={{ color: '#f8fafc' }}>{op.leader}</strong></span>
                                    <span>{op.date}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB 2: ROSTER */}
            {activeTab === 'roster' && (
                <div>
                    <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '1rem', fontWeight: 800 }}>
                        {language === 'es' ? 'Agentes Asignados a la División SEB' : 'Agents Assigned to SEB Division'}
                    </h3>

                    {personnelList.length === 0 ? (
                        <div style={{ padding: '2.5rem', background: 'rgba(30, 41, 59, 0.3)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', color: '#94a3b8' }}>
                            <p style={{ margin: 0 }}>{language === 'es' ? 'No se encontraron agentes registrados formalmente con el rango o división SEB aún.' : 'No agents currently registered with SEB rank or division yet.'}</p>
                            <p style={{ fontSize: '0.82rem', marginTop: '0.5rem', color: '#64748b' }}>Puedes asignar la división "SEB" o el rango "SEB Agent" desde el panel de Personal.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                            {personnelList.map(member => (
                                <div 
                                    key={member.id}
                                    style={{
                                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8))',
                                        border: '1px solid rgba(234, 179, 8, 0.25)',
                                        borderRadius: '12px',
                                        padding: '1.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem'
                                    }}
                                >
                                    <div style={{
                                        width: '52px',
                                        height: '52px',
                                        borderRadius: '50%',
                                        background: '#1e293b',
                                        border: '2px solid #eab308',
                                        overflow: 'hidden',
                                        flexShrink: 0
                                    }}>
                                        <img 
                                            src={getProfileImage(member.profile_image, '/logowebp/anon.webp')} 
                                            alt={member.nombre}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>

                                    <div>
                                        <h4 style={{ margin: '0 0 0.2rem 0', color: '#ffffff', fontSize: '1rem', fontWeight: 800 }}>
                                            {member.nombre} {member.apellido}
                                        </h4>
                                        <div style={{ fontSize: '0.78rem', color: '#eab308', fontWeight: 700 }}>
                                            {member.rango || 'SEB Agent'} • Placa #{member.no_placa || 'N/A'}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                            Rol: {member.rol || 'Agente'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: EQUIPMENT */}
            {activeTab === 'equipment' && (
                <div>
                    <h3 style={{ fontSize: '1.2rem', color: '#ffffff', marginBottom: '1rem', fontWeight: 800 }}>
                        {language === 'es' ? 'Arsenal Especializado & Protocolos de Intervención' : 'Specialized Armory & Intervention Protocols'}
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' }}>
                        <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.25rem' }}>
                            <h4 style={{ color: '#eab308', margin: '0 0 0.5rem 0', fontWeight: 800 }}>Vehículo Blindado de Entrada (BearCat / APC)</h4>
                            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>Unidades pesadas autorizadas para brechas perimetrales, cobertura antibalas de tiradores y rescate en zonas bajo fuego cruzado.</p>
                        </div>
                        <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.25rem' }}>
                            <h4 style={{ color: '#eab308', margin: '0 0 0.5rem 0', fontWeight: 800 }}>Escudos Balísticos Nivel IV & Cargas de Brecha</h4>
                            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>Material de entrada rápida táctica con cobertura antibalas certificada para asaltos en estructuras cerradas.</p>
                        </div>
                        <div style={{ background: 'rgba(30, 41, 59, 0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1.25rem' }}>
                            <h4 style={{ color: '#eab308', margin: '0 0 0.5rem 0', fontWeight: 800 }}>Rifles de Precisión Táctica & Ópticas Térmicas</h4>
                            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>Equipamiento de reconocimiento y francotirador para perímetros de seguridad de alta amenaza.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE OPERATION MODAL */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(6px)'
                }}>
                    <div style={{
                        background: '#0f172a',
                        border: '1px solid rgba(234, 179, 8, 0.3)',
                        borderRadius: '16px',
                        padding: '2rem',
                        maxWidth: '520px',
                        width: '90%',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
                    }}>
                        <h3 style={{ color: '#ffffff', margin: '0 0 1.25rem 0', fontSize: '1.3rem', fontWeight: 800 }}>
                            {language === 'es' ? 'Nueva Operación Táctica SEB' : 'New SEB Tactical Operation'}
                        </h3>

                        <form onSubmit={handleCreateOperation} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                                    Nombre de la Operación
                                </label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ej: Operación Tormenta"
                                    value={newOp.title}
                                    onChange={e => setNewOp({ ...newOp, title: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                                    Ubicación / Zona de Despliegue
                                </label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ej: Cypress Flats Warehouses"
                                    value={newOp.location}
                                    onChange={e => setNewOp({ ...newOp, location: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                                        Estado
                                    </label>
                                    <select
                                        value={newOp.status}
                                        onChange={e => setNewOp({ ...newOp, status: e.target.value })}
                                        style={{ width: '100%', background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
                                    >
                                        <option value="En Progreso">En Progreso</option>
                                        <option value="Completada">Completada</option>
                                        <option value="En Espera">En Espera</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                                        Tipo de Intervención
                                    </label>
                                    <input
                                        type="text"
                                        value={newOp.type}
                                        onChange={e => setNewOp({ ...newOp, type: e.target.value })}
                                        style={{ width: '100%', background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                                    Detalles & Objetivos Operativos
                                </label>
                                <textarea
                                    rows="3"
                                    placeholder="Descripción del briefing de la misión..."
                                    value={newOp.description}
                                    onChange={e => setNewOp({ ...newOp, description: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '0.6rem 0.8rem', color: '#fff', fontSize: '0.88rem', resize: 'vertical' }}
                                ></textarea>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    style={{ background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    style={{ background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', color: '#0f172a', border: 'none', padding: '0.6rem 1.4rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                    Guardar Operación
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SEB;
