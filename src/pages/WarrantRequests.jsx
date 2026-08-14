import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { getProfileImage } from '../utils/imageStorage';
import '../index.css';

function WarrantRequests() {
    const { isLSSD, userTheme } = useTheme();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Pendiente'); // Pendiente, Historial, Todos
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [expandedCardId, setExpandedCardId] = useState(null);
    
    // User Permissions
    const [currentUser, setCurrentUser] = useState(null);

    // Form State
    const [newRequest, setNewRequest] = useState({
        type: 'Orden de Allanamiento',
        target: '',
        location: '',
        reason: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadUserAndRequests();
    }, [activeTab]);

    const loadUserAndRequests = async () => {
        setLoading(true);
        // Load User
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
            setCurrentUser(data);
        }

        // Load Requests
        const statusFilterParam = activeTab === 'Todos' ? null : activeTab;
        const { data: wData, error } = await supabase.rpc('get_warrant_requests', { p_status_filter: statusFilterParam });
        if (error) console.error(error);
        else setRequests(wData || []);
        
        setLoading(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { error } = await supabase.rpc('create_warrant_request', {
                p_type: newRequest.type,
                p_target: newRequest.target,
                p_location: newRequest.location,
                p_reason: newRequest.reason
            });

            if (error) throw error;

            setShowCreateModal(false);
            setNewRequest({ type: 'Orden de Allanamiento', target: '', location: '', reason: '' });
            loadUserAndRequests();
        } catch (err) {
            alert('Error al tramitar la orden: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReview = async (id, status) => {
        const actionLabel = status === 'Aprobada' ? 'aprobar y expedir' : 'rechazar';
        if (!window.confirm(`¿Confirmar acción de ${actionLabel} para esta orden judicial?`)) return;
        try {
            const { error } = await supabase.rpc('review_warrant_request', {
                p_request_id: id,
                p_status: status
            });
            if (error) throw error;
            loadUserAndRequests();
        } catch (err) {
            alert('Error al resolver la orden: ' + err.message);
        }
    };

    const canReview = currentUser && ['Administrador', 'Coordinador', 'Comisionado', 'Jefe', 'Capitan'].includes(currentUser.rol);
    const isAyudante = currentUser && currentUser.rol === 'Ayudante';

    // Filter requests
    const filteredRequests = requests.filter(req => {
        const matchesSearch = (req.target_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (req.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (req.requester_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (req.reason || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'ALL' || req.request_type === typeFilter;
        return matchesSearch && matchesType;
    });

    // Stats calculations
    const totalCount = requests.length;
    const pendingCount = requests.filter(r => r.status === 'Pendiente').length;
    const approvedCount = requests.filter(r => r.status === 'Aprobada').length;
    const rejectedCount = requests.filter(r => r.status === 'Rechazada').length;

    // Theme Accent Palette
    const accentColor = isLSSD ? '#10b981' : 'var(--color-blue, #3b82f6)';
    const accentGlow = isLSSD ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)';

    const getTypeMeta = (type) => {
        switch (type) {
            case 'Orden de Allanamiento':
                return {
                    label: 'Allanamiento',
                    color: '#f87171',
                    bg: 'rgba(239, 68, 68, 0.12)',
                    border: 'rgba(239, 68, 68, 0.3)',
                    icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                    )
                };
            case 'Orden de Arresto':
                return {
                    label: 'Arresto',
                    color: '#fbbf24',
                    bg: 'rgba(245, 158, 11, 0.12)',
                    border: 'rgba(245, 158, 11, 0.3)',
                    icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                    )
                };
            case 'Orden de Vigilancia':
                return {
                    label: 'Vigilancia',
                    color: isLSSD ? '#34d399' : '#60a5fa',
                    bg: isLSSD ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                    border: isLSSD ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)',
                    icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    )
                };
            default:
                return {
                    label: 'Otro',
                    color: '#c084fc',
                    bg: 'rgba(168, 85, 247, 0.12)',
                    border: 'rgba(168, 85, 247, 0.3)',
                    icon: (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                    )
                };
        }
    };

    return (
        <div style={{ maxWidth: '1350px', margin: '0 auto', padding: '1.5rem', color: 'var(--text-primary)' }}>
            
            {/* Apple Command Hero Section */}
            <div style={{
                marginBottom: '1.75rem',
                background: 'var(--glass-bg, rgba(15, 23, 42, 0.6))',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                padding: '1.5rem 1.75rem',
                boxShadow: '0 12px 35px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '14px',
                            background: `linear-gradient(135deg, ${accentColor}, var(--color-blue-dark, #1e3a8a))`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: `0 6px 20px ${accentGlow}`,
                            color: '#ffffff'
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                <path d="m9 12 2 2 4-4"/>
                            </svg>
                        </div>

                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                                    ÓRDENES JUDICIALES
                                </h1>
                                <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '20px',
                                    background: `rgba(var(--color-blue-rgb, 59, 130, 246), 0.15)`,
                                    color: accentColor,
                                    border: `1px solid ${accentColor}44`,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Warrants & Search Orders
                                </span>
                            </div>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Panel de tramitación, resolución e inspección de solicitudes judiciales del departamento.
                            </p>
                        </div>
                    </div>

                    {!isAyudante && (
                        <button
                            className="mac-btn mac-btn-primary"
                            onClick={() => setShowCreateModal(true)}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.7rem 1.35rem',
                                fontSize: '0.88rem',
                                borderRadius: '12px',
                                background: isLSSD 
                                    ? 'linear-gradient(135deg, #10b981, #059669)' 
                                    : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                color: '#ffffff',
                                fontWeight: 700,
                                border: '1px solid rgba(255,255,255,0.2)',
                                boxShadow: `0 4px 16px ${accentGlow}`,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            <span>Solicitar Orden Judicial</span>
                        </button>
                    )}
                </div>

                {/* KPI Metrics Widgets Bar */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.85rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))'
                }}>
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '12px',
                        padding: '0.85rem 1.1rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PENDIENTES</span>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.1rem' }}>{pendingCount}</div>
                        </div>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '12px',
                        padding: '0.85rem 1.1rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>APROBADAS</span>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ade80', marginTop: '0.1rem' }}>{approvedCount}</div>
                        </div>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '12px',
                        padding: '0.85rem 1.1rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>RECHAZADAS</span>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171', marginTop: '0.1rem' }}>{rejectedCount}</div>
                        </div>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="15" y1="9" x2="9" y2="15"/>
                                <line x1="9" y1="9" x2="15" y2="15"/>
                            </svg>
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '12px',
                        padding: '0.85rem 1.1rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL REGISTRADAS</span>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: accentColor, marginTop: '0.1rem' }}>{totalCount}</div>
                        </div>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: `rgba(var(--color-blue-rgb, 59, 130, 246), 0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Apple Toolbar Filters Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem'
            }}>
                {/* Segmented Tab Pill */}
                <div style={{
                    display: 'inline-flex',
                    background: 'var(--glass-bg, rgba(15, 23, 42, 0.7))',
                    padding: '4px',
                    borderRadius: '14px',
                    border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}>
                    <button
                        onClick={() => setActiveTab('Pendiente')}
                        style={{
                            background: activeTab === 'Pendiente' ? accentColor : 'transparent',
                            color: activeTab === 'Pendiente' ? '#ffffff' : 'var(--text-secondary)',
                            border: 'none',
                            padding: '0.5rem 1.1rem',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span>Pendientes</span>
                        {pendingCount > 0 && (
                            <span style={{
                                background: activeTab === 'Pendiente' ? '#ffffff' : '#fbbf24',
                                color: activeTab === 'Pendiente' ? '#0f172a' : '#0f172a',
                                borderRadius: '10px',
                                padding: '0.1rem 0.45rem',
                                fontSize: '0.7rem',
                                fontWeight: 800
                            }}>
                                {pendingCount}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('Historial')}
                        style={{
                            background: activeTab === 'Historial' ? accentColor : 'transparent',
                            color: activeTab === 'Historial' ? '#ffffff' : 'var(--text-secondary)',
                            border: 'none',
                            padding: '0.5rem 1.1rem',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span>Historial Resuelto</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('Todos')}
                        style={{
                            background: activeTab === 'Todos' ? accentColor : 'transparent',
                            color: activeTab === 'Todos' ? '#ffffff' : 'var(--text-secondary)',
                            border: 'none',
                            padding: '0.5rem 1.1rem',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span>Todas</span>
                    </button>
                </div>

                {/* Search Bar & Type Dropdown */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        style={{
                            background: 'var(--glass-bg, rgba(15, 23, 42, 0.7))',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                            borderRadius: '12px',
                            padding: '0.55rem 0.9rem',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            outline: 'none'
                        }}
                    >
                        <option value="ALL">Todos los tipos</option>
                        <option value="Orden de Allanamiento">Allanamiento</option>
                        <option value="Orden de Arresto">Arresto</option>
                        <option value="Orden de Vigilancia">Vigilancia</option>
                        <option value="Otro">Otros</option>
                    </select>

                    <div style={{ position: 'relative' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                            <circle cx="11" cy="11" r="8"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar por objetivo, ubicación..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                background: 'var(--glass-bg, rgba(15, 23, 42, 0.7))',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                                borderRadius: '12px',
                                padding: '0.55rem 0.9rem 0.55rem 2.3rem',
                                fontSize: '0.82rem',
                                outline: 'none',
                                width: '230px'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* List Body */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                    <span style={{ display: 'inline-block', width: '16px', height: '16px', border: `2px solid ${accentColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                    <span>Cargando expediente de órdenes judiciales...</span>
                </div>
            ) : filteredRequests.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem 2rem',
                    background: 'var(--glass-bg, rgba(15, 23, 42, 0.4))',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '18px',
                    border: '1px dashed var(--glass-border, rgba(255, 255, 255, 0.1))',
                    color: 'var(--text-secondary)'
                }}>
                    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.75rem', opacity: 0.6 }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>No hay órdenes judiciales registradas</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>No se han encontrado expedientes bajo los parámetros seleccionados.</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(580px, 1fr))', gap: '1.25rem' }}>
                    {filteredRequests.map(req => {
                        const typeMeta = getTypeMeta(req.request_type);
                        const isPending = req.status === 'Pendiente';
                        const isApproved = req.status === 'Aprobada';
                        const isRejected = req.status === 'Rechazada';
                        const isExpanded = expandedCardId === req.id;

                        const statusBg = isPending ? 'rgba(245, 158, 11, 0.12)' : isApproved ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)';
                        const statusColor = isPending ? '#fbbf24' : isApproved ? '#4ade80' : '#f87171';
                        const statusBorder = isPending ? 'rgba(245, 158, 11, 0.3)' : isApproved ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)';

                        return (
                            <div key={req.id} style={{
                                background: 'var(--glass-bg, rgba(15, 23, 42, 0.65))',
                                backdropFilter: 'blur(16px)',
                                borderRadius: '18px',
                                border: `1px solid var(--glass-border, rgba(255, 255, 255, 0.08))`,
                                boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
                                padding: '1.35rem',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s ease',
                                position: 'relative'
                            }}>
                                <div>
                                    {/* Badges Header Row */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                                        <div style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            padding: '0.25rem 0.65rem',
                                            borderRadius: '8px',
                                            background: typeMeta.bg,
                                            color: typeMeta.color,
                                            border: `1px solid ${typeMeta.border}`,
                                            fontSize: '0.75rem',
                                            fontWeight: 800,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em'
                                        }}>
                                            {typeMeta.icon}
                                            <span>{typeMeta.label}</span>
                                        </div>

                                        <span style={{
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '20px',
                                            background: statusBg,
                                            color: statusColor,
                                            border: `1px solid ${statusBorder}`,
                                            fontSize: '0.74rem',
                                            fontWeight: 800,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            textTransform: 'uppercase'
                                        }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor, boxShadow: `0 0 6px ${statusColor}` }}></span>
                                            <span>{req.status}</span>
                                        </span>
                                    </div>

                                    {/* Target Name Header */}
                                    <div style={{ marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            SUJETO / OBJETIVO JUDICIAL
                                        </span>
                                        <h3 style={{ margin: '0.15rem 0 0 0', color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                            {req.target_name}
                                        </h3>
                                    </div>

                                    {/* Location Row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                            <circle cx="12" cy="10" r="3"/>
                                        </svg>
                                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{req.location}</span>
                                    </div>

                                    {/* Probable Cause Box */}
                                    <div style={{
                                        background: 'rgba(0, 0, 0, 0.25)',
                                        padding: '0.9rem 1rem',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                        marginBottom: '1rem',
                                        fontSize: '0.86rem',
                                        lineHeight: '1.5',
                                        color: 'var(--text-primary)'
                                    }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                                <polyline points="14 2 14 8 20 8"/>
                                            </svg>
                                            <span>Justificación y Causa Probable:</span>
                                        </div>
                                        <div style={{
                                            maxHeight: isExpanded ? 'none' : '90px',
                                            overflow: 'hidden',
                                            whiteSpace: 'pre-wrap',
                                            position: 'relative'
                                        }}>
                                            {req.reason}
                                        </div>

                                        {req.reason && req.reason.length > 180 && (
                                            <button
                                                onClick={() => setExpandedCardId(isExpanded ? null : req.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: accentColor,
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    padding: '0.3rem 0 0 0',
                                                    display: 'inline-block'
                                                }}
                                            >
                                                {isExpanded ? '▲ Mostrar menos' : '▼ Leer motivo completo'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Footer Requester & Actions */}
                                <div style={{
                                    paddingTop: '0.85rem',
                                    borderTop: '1px solid var(--glass-border, rgba(255, 255, 255, 0.06))',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '0.75rem'
                                }}>
                                    {/* Officer Badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <img
                                            src={getProfileImage(req.requester_avatar, '/logowebp/anon.webp')}
                                            alt=""
                                            style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.15)' }}
                                        />
                                        <div>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {req.requester_rank} {req.requester_name}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                                {new Date(req.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons or Reviewer Info */}
                                    {isPending && canReview ? (
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                className="mac-btn"
                                                onClick={() => handleReview(req.id, 'Rechazada')}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                    color: '#f87171',
                                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                                    padding: '0.4rem 0.85rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem'
                                                }}
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                                </svg>
                                                <span>Rechazar</span>
                                            </button>

                                            <button
                                                className="mac-btn"
                                                onClick={() => handleReview(req.id, 'Aprobada')}
                                                style={{
                                                    background: 'rgba(34, 197, 94, 0.2)',
                                                    color: '#4ade80',
                                                    border: '1px solid rgba(34, 197, 94, 0.4)',
                                                    padding: '0.4rem 0.85rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.3rem'
                                                }}
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"/>
                                                </svg>
                                                <span>Aprobar</span>
                                            </button>
                                        </div>
                                    ) : (
                                        req.reviewer_name && (
                                            <div style={{
                                                padding: '0.35rem 0.75rem',
                                                borderRadius: '8px',
                                                background: 'rgba(0,0,0,0.25)',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                fontSize: '0.75rem',
                                                color: 'var(--text-secondary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.35rem'
                                            }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                                </svg>
                                                <span>Resuelto por: <strong style={{ color: 'var(--text-primary)' }}>{req.reviewer_name}</strong></span>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Apple macOS Window Modal - Request Judicial Warrant */}
            {showCreateModal && (
                <div className="mac-modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="mac-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '620px', width: '92vw' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowCreateModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                    <line x1="12" y1="18" x2="12" y2="12"/>
                                    <line x1="9" y1="15" x2="15" y2="15"/>
                                </svg>
                                <span>Solicitud de Orden Judicial</span>
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <form onSubmit={handleCreate}>
                            <div className="mac-modal-body" style={{ padding: '1.35rem' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>
                                            TIPO DE ORDEN JUDICIAL
                                        </label>
                                        <select
                                            className="form-input custom-select"
                                            required
                                            value={newRequest.type}
                                            onChange={e => setNewRequest({ ...newRequest, type: e.target.value })}
                                            style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', border: '1px solid var(--glass-border, rgba(255,255,255,0.12))', borderRadius: '10px', padding: '0.65rem 0.85rem' }}
                                        >
                                            <option value="Orden de Allanamiento">Orden de Allanamiento (Search Warrant)</option>
                                            <option value="Orden de Arresto">Orden de Arresto (Arrest Warrant)</option>
                                            <option value="Orden de Vigilancia">Orden de Vigilancia (Surveillance Warrant)</option>
                                            <option value="Otro">Otro Tipo de Orden Judicial</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>
                                            OBJETIVO / INDIVIDUO O PROPIEDAD
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            required
                                            value={newRequest.target}
                                            onChange={e => setNewRequest({ ...newRequest, target: e.target.value })}
                                            placeholder="Ej: John Doe, Banda Los Vagos o Residencia 123 Alta St"
                                            style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', border: '1px solid var(--glass-border, rgba(255,255,255,0.12))', borderRadius: '10px', padding: '0.65rem 0.85rem' }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>
                                            UBICACIÓN / DIRECCIÓN EXACTA
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            required
                                            value={newRequest.location}
                                            onChange={e => setNewRequest({ ...newRequest, location: e.target.value })}
                                            placeholder="Ej: 123 Alta St, Apt 4B, Vinewood"
                                            style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', border: '1px solid var(--glass-border, rgba(255,255,255,0.12))', borderRadius: '10px', padding: '0.65rem 0.85rem' }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" style={{ color: 'var(--text-primary)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem', display: 'block' }}>
                                            CAUSA PROBABLE Y EVIDENCIA JUSTIFICATIVA
                                        </label>
                                        <textarea
                                            className="eval-textarea"
                                            rows="5"
                                            required
                                            value={newRequest.reason}
                                            onChange={e => setNewRequest({ ...newRequest, reason: e.target.value })}
                                            placeholder="Describa de manera detallada la causa probable, antecedentes del caso y las pruebas o indicios que respaldan la necesidad de expedir esta orden..."
                                            style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-primary)', border: '1px solid var(--glass-border, rgba(255,255,255,0.12))', borderRadius: '10px', padding: '0.75rem 0.85rem', lineHeight: '1.4' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                padding: '0.85rem 1.35rem',
                                borderTop: '1px solid var(--glass-border, rgba(255,255,255,0.08))',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: '0.6rem',
                                background: 'rgba(0, 0, 0, 0.25)'
                            }}>
                                <button
                                    type="button"
                                    className="mac-btn mac-btn-secondary"
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="mac-btn mac-btn-primary"
                                    disabled={submitting}
                                    style={{
                                        background: isLSSD 
                                            ? 'linear-gradient(135deg, #10b981, #059669)' 
                                            : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        border: 'none'
                                    }}
                                >
                                    {submitting ? 'Tramitando...' : 'Emitir Solicitud'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WarrantRequests;
