import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function IASanctions() {
    const navigate = useNavigate();
    const { isLSSD } = useTheme();
    const { language } = useLanguage();
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all'); // 'all', 'with_sanctions', 'clean'

    // Modal & CRUD State
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({ nombre: '', apellido: '', no_placa: '' });
    const [loadingAction, setLoadingAction] = useState(false);
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        loadProfiles();
    }, []);

    const loadProfiles = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.rpc('get_ia_subjects');
            if (error) throw error;
            setProfiles(data || []);
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
            loadProfiles();
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
            loadProfiles();
        } catch (err) {
            alert((language === 'es' ? 'Error al eliminar perfil: ' : 'Error deleting profile: ') + err.message);
        }
    };

    const filteredProfiles = useMemo(() => {
        return profiles.filter(p => {
            const fullName = `${p.nombre} ${p.apellido}`.toLowerCase();
            const badge = (p.no_placa || '').toLowerCase();
            const query = searchTerm.toLowerCase();
            const matchesQuery = fullName.includes(query) || badge.includes(query);

            if (!matchesQuery) return false;

            if (filterCategory === 'with_sanctions') {
                return (p.sanction_count || 0) > 0;
            }
            if (filterCategory === 'clean') {
                return (p.sanction_count || 0) === 0;
            }
            return true;
        });
    }, [profiles, searchTerm, filterCategory]);

    const totalOfficers = profiles.length;
    const totalSanctioned = profiles.filter(p => (p.sanction_count || 0) > 0).length;
    const totalRecords = profiles.reduce((acc, p) => acc + (Number(p.sanction_count) || 0), 0);

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
                            {language === 'es' ? 'Base de datos y archivo de expedientes disciplinarios de oficiales.' : 'Database of officer disciplinary files and sanction records.'}
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
                <div className="mac-doc-tabs" style={{ margin: 0 }}>
                    {[
                        { id: 'all', label: language === 'es' ? 'Todos los Oficiales' : 'All Officers', count: totalOfficers },
                        { id: 'with_sanctions', label: language === 'es' ? 'Con Sanciones' : 'With Sanctions', count: totalSanctioned },
                        { id: 'clean', label: language === 'es' ? 'Sin Sanciones' : 'Clean Record', count: totalOfficers - totalSanctioned }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            className={`mac-doc-tab ${filterCategory === tab.id ? 'active' : ''}`}
                            onClick={() => setFilterCategory(tab.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <span>{tab.label}</span>
                            <span style={{
                                fontSize: '0.72rem',
                                padding: '1px 7px',
                                borderRadius: '12px',
                                background: filterCategory === tab.id ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                                color: filterCategory === tab.id ? '#ffffff' : '#94a3b8',
                                fontWeight: 700
                            }}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0.35rem 0.85rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        color: '#f87171',
                        fontWeight: 600
                    }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span>{totalRecords} {language === 'es' ? 'Sanciones Totales Registradas' : 'Total Sanctions Logged'}</span>
                    </div>
                </div>
            </div>

            {/* Content List */}
            {loading ? (
                <div className="mac-doc-empty">
                    <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite', backgroundColor: '#ef4444' }}></span>
                    <span>{language === 'es' ? 'Cargando registro de personal...' : 'Loading personnel registry...'}</span>
                </div>
            ) : filteredProfiles.length === 0 ? (
                <div className="mac-doc-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}>
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <span>{language === 'es' ? 'No se encontraron oficiales en el registro.' : 'No officer profiles found.'}</span>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                    {filteredProfiles.map(profile => {
                        const hasSanctions = (profile.sanction_count || 0) > 0;
                        const initials = `${(profile.nombre?.[0] || '').toUpperCase()}${(profile.apellido?.[0] || '').toUpperCase()}` || 'OF';

                        return (
                            <div
                                key={profile.id}
                                className="mac-widget-card"
                                onClick={() => navigate(`/internal-affairs/sanctions/${profile.id}`)}
                                style={{
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1.1rem',
                                    padding: '1.25rem 1.35rem',
                                    position: 'relative',
                                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                                    borderLeft: `4px solid ${hasSanctions ? '#ef4444' : '#10b981'}`
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.boxShadow = `0 12px 28px -6px ${hasSanctions ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.15)'}`;
                                    e.currentTarget.style.borderColor = hasSanctions ? '#ef4444' : '#10b981';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                                }}
                            >
                                {/* Avatar Monogram */}
                                <div style={{
                                    width: '54px',
                                    height: '54px',
                                    borderRadius: '16px',
                                    background: hasSanctions 
                                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.22), rgba(153, 27, 27, 0.3))' 
                                        : 'linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(6, 78, 59, 0.25))',
                                    border: `1px solid ${hasSanctions ? 'rgba(239, 68, 68, 0.35)' : 'rgba(16, 185, 129, 0.35)'}`,
                                    color: hasSanctions ? '#f87171' : '#34d399',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.15rem',
                                    fontWeight: 800,
                                    letterSpacing: '0.05em',
                                    flexShrink: 0,
                                    boxShadow: `0 4px 12px ${hasSanctions ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)'}`
                                }}>
                                    {initials}
                                </div>

                                {/* Officer Info */}
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

                                    {/* Sanction Status Pill */}
                                    <div style={{ marginTop: '0.45rem', display: 'flex', alignItems: 'center' }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            padding: '0.2rem 0.6rem',
                                            borderRadius: '12px',
                                            background: hasSanctions ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                                            color: hasSanctions ? '#f87171' : '#34d399',
                                            border: `1px solid ${hasSanctions ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.25)'}`
                                        }}>
                                            <span style={{
                                                width: '6px',
                                                height: '6px',
                                                borderRadius: '50%',
                                                backgroundColor: hasSanctions ? '#ef4444' : '#10b981',
                                                boxShadow: `0 0 6px ${hasSanctions ? '#ef4444' : '#10b981'}`
                                            }} />
                                            <span>
                                                {profile.sanction_count} {language === 'es' 
                                                    ? (profile.sanction_count === 1 ? 'Sanción Registrada' : 'Sanciones Registradas') 
                                                    : (profile.sanction_count === 1 ? 'Sanction Logged' : 'Sanctions Logged')}
                                            </span>
                                        </span>
                                    </div>
                                </div>

                                {/* Actions Group */}
                                <div
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.35rem',
                                        paddingLeft: '0.5rem',
                                        borderLeft: '1px solid rgba(255, 255, 255, 0.08)'
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
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
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
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                            e.currentTarget.style.color = '#cbd5e1';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
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
                                            border: '1px solid rgba(239, 68, 68, 0.2)',
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
                                            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                                        }}
                                        title={language === 'es' ? 'Eliminar Oficial' : 'Delete Officer'}
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6"/>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                            <line x1="10" y1="11" x2="10" y2="17"/>
                                            <line x1="14" y1="11" x2="14" y2="17"/>
                                        </svg>
                                    </button>
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

