import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { 
    DEFAULT_SANCTION_DURATIONS, 
    fetchSanctionDurations, 
    calculateSubjectStatus 
} from '../utils/sanctionConfig';
import '../index.css';

function IASanctions() {
    const navigate = useNavigate();
    const { isLSSD } = useTheme();
    const { language } = useLanguage();
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all'); // 'all', 'active', 'expired', 'clean'
    const [durations, setDurations] = useState(DEFAULT_SANCTION_DURATIONS);

    // Modal & CRUD State
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ nombre: '', apellido: '', no_placa: '' });
    const [loadingAction, setLoadingAction] = useState(false);
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Load custom durations from app_settings
            const loadedDurations = await fetchSanctionDurations();
            setDurations(loadedDurations);

            // Try loading full profiles with sanctions
            let loadedProfiles = [];

            const { data: fullData, error: fullError } = await supabase.rpc('get_ia_subjects_full');
            if (!fullError && fullData) {
                loadedProfiles = fullData;
            } else {
                // Fallback to direct supabase query
                const { data: directData, error: directError } = await supabase
                    .from('ia_subject_profiles')
                    .select(`
                        id,
                        nombre,
                        apellido,
                        no_placa,
                        created_at,
                        ia_sanctions (
                            id,
                            sanction_type,
                            sanction_date,
                            description,
                            created_at
                        )
                    `)
                    .order('nombre', { ascending: true });

                if (!directError && directData) {
                    loadedProfiles = directData.map(p => ({
                        ...p,
                        sanctions: p.ia_sanctions || []
                    }));
                } else {
                    // Fallback to legacy RPC
                    const { data: legacyData } = await supabase.rpc('get_ia_subjects');
                    loadedProfiles = (legacyData || []).map(p => ({
                        ...p,
                        sanctions: []
                    }));
                }
            }

            setProfiles(loadedProfiles || []);
        } catch (err) {
            console.error('Error loading profiles:', err);
        } finally {
            setLoading(false);
        }
    };

    const openForCreate = () => {
        setEditingId(null);
        setFormData({ nombre: '', apellido: '', no_placa: '' });
        setShowModal(true);
    };

    const openForEdit = (e, profile) => {
        e.stopPropagation();
        setEditingId(profile.id);
        setFormData({ nombre: profile.nombre, apellido: profile.apellido, no_placa: profile.no_placa });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoadingAction(true);
        try {
            if (editingId) {
                const { error } = await supabase.rpc('update_ia_subject_profile', {
                    p_id: editingId,
                    p_nombre: formData.nombre.trim(),
                    p_apellido: formData.apellido.trim(),
                    p_no_placa: formData.no_placa.trim()
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.rpc('create_ia_subject_profile', {
                    p_nombre: formData.nombre.trim(),
                    p_apellido: formData.apellido.trim(),
                    p_no_placa: formData.no_placa.trim()
                });
                if (error) throw error;
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            alert((language === 'es' ? 'Error al guardar perfil: ' : 'Error saving profile: ') + err.message);
        } finally {
            setLoadingAction(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm(language === 'es' 
            ? '¿Está seguro de eliminar este perfil? Esto eliminará el perfil del oficial y todo su historial de sanciones.' 
            : 'Are you sure? This will delete the officer profile and all their sanction history.')) return;

        try {
            const { error } = await supabase.rpc('delete_ia_subject_profile', { p_id: id });
            if (error) throw error;
            loadData();
        } catch (err) {
            alert((language === 'es' ? 'Error al eliminar perfil: ' : 'Error deleting profile: ') + err.message);
        }
    };

    // Calculate processed profile data with real-time active status
    const processedProfiles = useMemo(() => {
        return profiles.map(profile => {
            const status = calculateSubjectStatus(profile, durations);
            return {
                ...profile,
                status
            };
        });
    }, [profiles, durations]);

    const filteredProfiles = useMemo(() => {
        return processedProfiles.filter(p => {
            const fullName = `${p.nombre} ${p.apellido}`.toLowerCase();
            const badge = (p.no_placa || '').toLowerCase();
            const query = searchTerm.toLowerCase();
            const matchesQuery = fullName.includes(query) || badge.includes(query);

            if (!matchesQuery) return false;

            if (filterCategory === 'active') {
                return p.status.hasActive;
            }
            if (filterCategory === 'expired') {
                return !p.status.hasActive && p.status.totalCount > 0;
            }
            if (filterCategory === 'clean') {
                return p.status.totalCount === 0;
            }
            return true;
        });
    }, [processedProfiles, searchTerm, filterCategory]);

    const totalOfficers = processedProfiles.length;
    const totalActiveOfficers = processedProfiles.filter(p => p.status.hasActive).length;
    const totalExpiredOnlyOfficers = processedProfiles.filter(p => !p.status.hasActive && p.status.totalCount > 0).length;
    const totalCleanOfficers = processedProfiles.filter(p => p.status.totalCount === 0).length;
    const totalRecords = processedProfiles.reduce((acc, p) => acc + p.status.totalCount, 0);

    return (
        <div className="mac-dashboard-container">
            {/* Command Header Banner */}
            <div className="mac-command-banner" style={{ marginBottom: '2rem', background: 'linear-gradient(135deg, rgba(30, 27, 38, 0.75), rgba(15, 23, 42, 0.85))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <img
                        src={isLSSD ? "/logowebp/IALSSD.webp" : "/logowebp/ialogo.webp"}
                        alt="IA Division Logo"
                        style={{
                            height: '70px',
                            width: 'auto',
                            filter: `drop-shadow(0 4px 16px ${isLSSD ? 'rgba(74, 222, 128, 0.4)' : 'rgba(239, 68, 68, 0.45)'})`
                        }}
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => navigate('/internal-affairs')}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '20px',
                                    padding: '0.25rem 0.75rem',
                                    color: '#cbd5e1',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                                    e.currentTarget.style.color = '#ffffff';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                    e.currentTarget.style.color = '#cbd5e1';
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"/>
                                    <polyline points="12 19 5 12 12 5"/>
                                </svg>
                                <span>{language === 'es' ? 'Volver al Panel' : 'Back to Dashboard'}</span>
                            </button>
                            <span className="mac-status-dot" style={{ backgroundColor: '#ef4444', boxShadow: '0 0 10px #ef4444' }}></span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {language === 'es' ? 'División de Asuntos Internos' : 'Internal Affairs Division'}
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.15rem 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {language === 'es' ? 'REGISTRO DE SANCIONES' : 'DISCIPLINARY SANCTIONS REGISTRY'}
                        </h1>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem' }}>
                            {language === 'es' ? 'Control de personal con faltas activas y expedientes disciplinarios.' : 'Control of officers with active sanctions and disciplinary records.'}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Search Bar */}
                    <div className="mac-input-with-icon" style={{ width: '250px' }}>
                        <span className="mac-input-icon">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"/>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                        </span>
                        <input
                            type="text"
                            className="mac-form-input has-icon"
                            style={{ padding: '0.55rem 0.85rem 0.55rem 2.5rem', fontSize: '0.85rem' }}
                            placeholder={language === 'es' ? 'Buscar oficial o placa...' : 'Search name or badge...'}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* New Profile Button */}
                    <button
                        className="mac-btn mac-btn-primary"
                        onClick={openForCreate}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.55rem 1.1rem',
                            background: 'rgba(239, 68, 68, 0.2)',
                            borderColor: 'rgba(239, 68, 68, 0.45)',
                            color: '#f87171'
                        }}
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>{language === 'es' ? 'Nuevo Oficial' : 'New Officer'}</span>
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar & Filter Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="mac-doc-tabs" style={{ margin: 0, flexWrap: 'wrap', gap: '6px' }}>
                    {[
                        { 
                            id: 'all', 
                            label: language === 'es' ? 'Todos los Oficiales' : 'All Officers', 
                            count: totalOfficers,
                            badgeColor: null
                        },
                        { 
                            id: 'active', 
                            label: language === 'es' ? 'Faltas ACTIVAS' : 'ACTIVE Sanctions', 
                            count: totalActiveOfficers,
                            isAlert: true,
                            badgeColor: '#ef4444'
                        },
                        { 
                            id: 'expired', 
                            label: language === 'es' ? 'Sanciones Caducadas' : 'Expired Sanctions', 
                            count: totalExpiredOnlyOfficers,
                            badgeColor: '#f59e0b'
                        },
                        { 
                            id: 'clean', 
                            label: language === 'es' ? 'Sin Sanciones' : 'Clean Record', 
                            count: totalCleanOfficers,
                            badgeColor: '#10b981'
                        }
                    ].map(tab => {
                        const isSelected = filterCategory === tab.id;
                        return (
                            <button
                                key={tab.id}
                                className={`mac-doc-tab ${isSelected ? 'active' : ''}`}
                                onClick={() => setFilterCategory(tab.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    ...(tab.isAlert ? {
                                        borderColor: isSelected ? '#ef4444' : 'rgba(239, 68, 68, 0.4)',
                                        background: isSelected ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.08)',
                                        color: isSelected ? '#ffffff' : '#f87171'
                                    } : {})
                                }}
                            >
                                {tab.isAlert && (
                                    <span style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: '#ef4444',
                                        boxShadow: '0 0 8px #ef4444',
                                        display: 'inline-block'
                                    }} />
                                )}
                                <span>{tab.label}</span>
                                <span style={{
                                    fontSize: '0.72rem',
                                    padding: '1px 7px',
                                    borderRadius: '12px',
                                    background: isSelected 
                                        ? (tab.badgeColor ? `${tab.badgeColor}40` : 'rgba(255,255,255,0.25)') 
                                        : 'rgba(255,255,255,0.08)',
                                    color: isSelected ? '#ffffff' : (tab.badgeColor || '#94a3b8'),
                                    fontWeight: 700
                                }}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Summary Info Chips */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0.35rem 0.85rem',
                        background: totalActiveOfficers > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                        border: `1px solid ${totalActiveOfficers > 0 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.25)'}`,
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        color: totalActiveOfficers > 0 ? '#f87171' : '#34d399',
                        fontWeight: 700
                    }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
                            <line x1="12" y1="8" x2="12" y2="12"/>
                            <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span>{totalActiveOfficers} {language === 'es' ? 'Oficiales con Sanción Activa' : 'Officers with Active Sanctions'}</span>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0.35rem 0.85rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        color: '#cbd5e1',
                        fontWeight: 600
                    }}>
                        <span>{totalRecords} {language === 'es' ? 'Sanciones en Total' : 'Total Sanctions Logged'}</span>
                    </div>
                </div>
            </div>

            {/* Content List */}
            {loading ? (
                <div className="mac-doc-empty">
                    <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite', backgroundColor: '#ef4444' }}></span>
                    <span>{language === 'es' ? 'Cargando registro de personal y vigencias...' : 'Loading personnel registry and expiration data...'}</span>
                </div>
            ) : filteredProfiles.length === 0 ? (
                <div className="mac-doc-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}>
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <span>
                        {filterCategory === 'active'
                            ? (language === 'es' ? '¡Excelente! No hay oficiales con faltas activas actualmente.' : 'Great! No officers with active sanctions at this moment.')
                            : (language === 'es' ? 'No se encontraron oficiales en el registro.' : 'No officer profiles found.')}
                    </span>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.25rem' }}>
                    {filteredProfiles.map(profile => {
                        const { status } = profile;
                        const hasActive = status.hasActive;
                        const hasExpired = !hasActive && status.totalCount > 0;
                        const initials = `${(profile.nombre?.[0] || '').toUpperCase()}${(profile.apellido?.[0] || '').toUpperCase()}` || 'OF';

                        const cardBorderColor = hasActive ? '#ef4444' : hasExpired ? '#f59e0b' : '#10b981';

                        return (
                            <div
                                key={profile.id}
                                className="mac-widget-card"
                                onClick={() => navigate(`/internal-affairs/sanctions/${profile.id}`)}
                                style={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    gap: '1rem',
                                    padding: '1.25rem 1.35rem',
                                    position: 'relative',
                                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                                    borderLeft: `4px solid ${cardBorderColor}`,
                                    minHeight: '120px',
                                    ...(hasActive ? {
                                        background: 'linear-gradient(135deg, rgba(35, 18, 25, 0.7), rgba(15, 23, 42, 0.85))',
                                        boxShadow: '0 4px 20px rgba(239, 68, 68, 0.12)'
                                    } : {})
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.boxShadow = `0 14px 30px -6px ${hasActive ? 'rgba(239, 68, 68, 0.3)' : hasExpired ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.15)'}`;
                                    e.currentTarget.style.borderColor = cardBorderColor;
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = hasActive ? '0 4px 20px rgba(239, 68, 68, 0.12)' : 'none';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                                }}
                            >
                                {/* Top Row: Avatar, Officer Name, Badge & Actions */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.85rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flex: 1, minWidth: 0 }}>
                                        {/* Avatar Monogram */}
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '14px',
                                            background: hasActive 
                                                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.25), rgba(153, 27, 27, 0.35))' 
                                                : hasExpired
                                                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(180, 83, 9, 0.25))'
                                                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(6, 78, 59, 0.25))',
                                            border: `1.5px solid ${hasActive ? 'rgba(239, 68, 68, 0.5)' : hasExpired ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                                            color: hasActive ? '#f87171' : hasExpired ? '#fbbf24' : '#34d399',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1.05rem',
                                            fontWeight: 800,
                                            letterSpacing: '0.05em',
                                            flexShrink: 0,
                                            boxShadow: `0 4px 12px ${hasActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0,0,0,0.2)'}`
                                        }}>
                                            {initials}
                                        </div>

                                        {/* Name & Badge */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontWeight: 700,
                                                fontSize: '1.02rem',
                                                color: '#ffffff',
                                                letterSpacing: '-0.01em',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {profile.nombre} {profile.apellido}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '0.2rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-gold, #f59e0b)' }}>
                                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                                </svg>
                                                <span>{language === 'es' ? 'Placa: ' : 'Badge: '}</span>
                                                <span style={{ color: 'var(--accent-gold, #f59e0b)', fontWeight: 600 }}>#{profile.no_placa}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons in Horizontal Group */}
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            flexShrink: 0
                                        }}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <button
                                            onClick={(e) => openForEdit(e, profile)}
                                            style={{
                                                width: '30px',
                                                height: '30px',
                                                borderRadius: '8px',
                                                background: 'rgba(255, 255, 255, 0.06)',
                                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                                color: '#cbd5e1',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                                                e.currentTarget.style.color = '#ffffff';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                                e.currentTarget.style.color = '#cbd5e1';
                                            }}
                                            title={language === 'es' ? 'Editar Oficial' : 'Edit Officer'}
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 20h9"/>
                                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                                            </svg>
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(e, profile.id)}
                                            style={{
                                                width: '30px',
                                                height: '30px',
                                                borderRadius: '8px',
                                                background: 'rgba(239, 68, 68, 0.08)',
                                                border: '1px solid rgba(239, 68, 68, 0.22)',
                                                color: '#f87171',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                                                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.22)';
                                            }}
                                            title={language === 'es' ? 'Eliminar Oficial' : 'Delete Officer'}
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"/>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Active Sanction / Expiration Status Box */}
                                <div style={{
                                    padding: '0.65rem 0.85rem',
                                    borderRadius: '10px',
                                    background: hasActive ? 'rgba(239, 68, 68, 0.12)' : hasExpired ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                                    border: `1px solid ${hasActive ? 'rgba(239, 68, 68, 0.3)' : hasExpired ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '0.5rem',
                                    flexWrap: 'wrap'
                                }}>
                                    {hasActive ? (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{
                                                    width: '8px',
                                                    height: '8px',
                                                    borderRadius: '50%',
                                                    backgroundColor: '#ef4444',
                                                    boxShadow: '0 0 8px #ef4444'
                                                }} />
                                                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                    {status.activeCount === 1 
                                                        ? (language === 'es' ? `FALTA ${status.mostSevereActive?.toUpperCase()} ACTIVA` : `ACTIVE ${status.mostSevereActive?.toUpperCase()} FAULT`)
                                                        : (language === 'es' ? `${status.activeCount} FALTAS ACTIVAS` : `${status.activeCount} ACTIVE FAULTS`)}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}>
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10"/>
                                                    <polyline points="12 6 12 12 16 14"/>
                                                </svg>
                                                <span style={{ color: '#fca5a5', fontWeight: 600 }}>
                                                    {language === 'es' ? 'Caduca: ' : 'Expires: '}
                                                    <strong style={{ color: '#ffffff' }}>{status.latestExpiryDateFormatted}</strong>
                                                </span>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    padding: '1px 6px',
                                                    borderRadius: '8px',
                                                    background: 'rgba(239, 68, 68, 0.25)',
                                                    color: '#fecaca',
                                                    fontWeight: 700
                                                }}>
                                                    {status.maxDaysRemaining === 0 
                                                        ? (language === 'es' ? 'Hoy' : 'Today')
                                                        : (language === 'es' ? `${status.maxDaysRemaining}d restantes` : `${status.maxDaysRemaining}d left`)}
                                                </span>
                                            </div>
                                        </>
                                    ) : hasExpired ? (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fbbf24' }}>
                                                    {status.totalCount} {language === 'es' ? (status.totalCount === 1 ? 'Sanción Caducada' : 'Sanciones Caducadas') : (status.totalCount === 1 ? 'Expired Sanction' : 'Expired Sanctions')}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                {language === 'es' ? 'Sin faltas vigentes' : 'No active sanctions'}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#34d399' }}>
                                                    {language === 'es' ? 'Expediente Limpio' : 'Clean Record'}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                {language === 'es' ? '0 Sanciones' : '0 Records'}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Apple / macOS Modal for Create & Edit Profile */}
            {showModal && (
                <div className="mac-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="mac-modal-card" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <span className="mac-dot red" onClick={() => setShowModal(false)}></span>
                                <span className="mac-dot yellow"></span>
                                <span className="mac-dot green"></span>
                            </div>
                            <h3 className="mac-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                                <span>{editingId ? (language === 'es' ? 'Editar Perfil del Oficial' : 'Edit Officer Profile') : (language === 'es' ? 'Registrar Nuevo Oficial' : 'Register New Officer')}</span>
                            </h3>
                            <button className="mac-modal-close" onClick={() => setShowModal(false)}>&times;</button>
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="mac-modal-body" style={{ gap: '1rem' }}>
                                <div className="mac-form-group">
                                    <label className="mac-form-label">{language === 'es' ? 'Nombre' : 'First Name'}</label>
                                    <input
                                        className="mac-form-input"
                                        required
                                        placeholder={language === 'es' ? 'Ej. John' : 'e.g. John'}
                                        value={formData.nombre}
                                        onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                        autoFocus
                                    />
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">{language === 'es' ? 'Apellido' : 'Last Name'}</label>
                                    <input
                                        className="mac-form-input"
                                        required
                                        placeholder={language === 'es' ? 'Ej. Doe' : 'e.g. Doe'}
                                        value={formData.apellido}
                                        onChange={e => setFormData({ ...formData, apellido: e.target.value })}
                                    />
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">{language === 'es' ? 'Número de Placa' : 'Badge Number'}</label>
                                    <input
                                        className="mac-form-input"
                                        required
                                        placeholder={language === 'es' ? 'Ej. 742' : 'e.g. 742'}
                                        value={formData.no_placa}
                                        onChange={e => setFormData({ ...formData, no_placa: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="mac-modal-actions" style={{ padding: '0 1.25rem 1.25rem 1.25rem' }}>
                                <button
                                    type="button"
                                    className="mac-btn mac-btn-secondary"
                                    onClick={() => setShowModal(false)}
                                    disabled={loadingAction}
                                >
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    className="mac-btn mac-btn-primary"
                                    style={{ background: 'rgba(239, 68, 68, 0.25)', borderColor: 'rgba(239, 68, 68, 0.5)', color: '#f87171' }}
                                    disabled={loadingAction}
                                >
                                    {loadingAction 
                                        ? (language === 'es' ? 'Guardando...' : 'Saving...') 
                                        : (editingId 
                                            ? (language === 'es' ? 'Guardar Cambios' : 'Save Changes') 
                                            : (language === 'es' ? 'Crear Registro' : 'Create Officer'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default IASanctions;

