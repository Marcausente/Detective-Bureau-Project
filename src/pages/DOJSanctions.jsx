import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function DOJSanctions() {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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
            const { data, error } = await supabase.rpc('get_doj_subjects');
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
                const { error } = await supabase.rpc('update_doj_subject_profile', {
                    p_id: editingId,
                    p_nombre: formData.nombre,
                    p_apellido: formData.apellido,
                    p_no_placa: formData.no_placa
                });
                if (error) {
                    const fallback = await supabase
                        .from('doj_subject_profiles')
                        .update(formData)
                        .eq('id', editingId);
                    if (fallback.error) throw fallback.error;
                }
            } else {
                const { error } = await supabase.rpc('create_doj_subject_profile', {
                    p_nombre: formData.nombre,
                    p_apellido: formData.apellido,
                    p_no_placa: formData.no_placa
                });
                if (error) {
                    const { data: { user } } = await supabase.auth.getUser();
                    const fallback = await supabase
                        .from('doj_subject_profiles')
                        .insert([{ ...formData, created_by: user ? user.id : null }]);
                    if (fallback.error) throw fallback.error;
                }
            }
            setShowModal(false);
            loadProfiles();
        } catch (err) {
            alert('Error saving profile: ' + err.message);
        } finally {
            setLoadingAction(false);
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm(language === 'es' ? "¿Eliminar este expediente disciplinario y todas sus sanciones?" : "Are you sure? This will delete the officer profile and ALL their sanction history.")) return;

        try {
            const { error } = await supabase.rpc('delete_doj_subject_profile', { p_id: id });
            if (error) {
                const fallback = await supabase.from('doj_subject_profiles').delete().eq('id', id);
                if (fallback.error) throw fallback.error;
            }
            loadProfiles();
        } catch (err) {
            alert('Error deleting profile: ' + err.message);
        }
    };

    const filteredProfiles = profiles.filter(p =>
        (p.nombre + ' ' + p.apellido).toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.no_placa?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="mac-dashboard-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Command Header Banner */}
            <div 
                className="mac-command-banner" 
                style={{
                    marginBottom: '1.75rem',
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(11, 15, 25, 0.95))',
                    border: '1px solid rgba(244, 63, 94, 0.25)',
                    boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <img
                        src="/logowebp/doj-logo.webp"
                        alt="DOJ Logo"
                        style={{ height: '64px', width: 'auto', filter: 'drop-shadow(0 4px 14px rgba(244, 63, 94, 0.35))' }}
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/logowebp/dojlogo.webp";
                        }}
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                            <button
                                type="button"
                                onClick={() => navigate('/doj')}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '20px',
                                    padding: '0.2rem 0.65rem',
                                    color: '#cbd5e1',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"/>
                                    <polyline points="12 19 5 12 12 5"/>
                                </svg>
                                <span>{language === 'es' ? 'Volver al DOJ' : 'DOJ Hub'}</span>
                            </button>
                            <span className="mac-status-dot" style={{ backgroundColor: '#f43f5e', boxShadow: '0 0 10px #f43f5e' }}></span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fb7185', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {language === 'es' ? 'Régimen Disciplinario • Expedientes' : 'Disciplinary Sanctions Registry'}
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.2rem 0 0 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {language === 'es' ? 'REGISTRO DE SANCIONES Y FALTAS JUDICIALES' : 'JUDICIAL SANCTIONS & CITATIONS'}
                        </h1>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {/* Search Bar */}
                    <div className="mac-input-with-icon" style={{ width: '250px' }}>
                        <span className="mac-input-icon">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"/>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                            </svg>
                        </span>
                        <input
                            type="text"
                            className="mac-form-input has-icon"
                            style={{ padding: '0.55rem 0.85rem 0.55rem 2.6rem', fontSize: '0.85rem' }}
                            placeholder={language === 'es' ? "Buscar agente o placa..." : "Search name or badge..."}
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
                            gap: '0.45rem',
                            padding: '0.6rem 1.1rem',
                            background: 'rgba(244, 63, 94, 0.25)',
                            border: '1px solid rgba(244, 63, 94, 0.5)',
                            color: '#fda4af',
                            borderRadius: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 4px 16px rgba(244, 63, 94, 0.25)'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>{language === 'es' ? 'Nuevo Expediente' : 'New Profile'}</span>
                    </button>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="mac-doc-empty">
                    <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite', backgroundColor: '#f43f5e', width: '10px', height: '10px', display: 'inline-block', borderRadius: '50%', marginBottom: '0.5rem' }}></span>
                    <div>{language === 'es' ? 'Cargando expedientes disciplinarios...' : 'Loading sanctions registry...'}</div>
                </div>
            ) : filteredProfiles.length === 0 ? (
                <div className="mac-doc-empty">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4, marginBottom: '0.75rem' }}>
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.25rem' }}>
                        {language === 'es' ? 'No se encontraron expedientes' : 'No profiles found'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        {language === 'es' ? 'Registre un agente con el botón superior' : 'Register an officer profile above'}
                    </div>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                    gap: '1.25rem'
                }}>
                    {filteredProfiles.map(profile => {
                        const count = profile.sanction_count || 0;
                        const hasSanctions = count > 0;
                        const initials = `${profile.nombre ? profile.nombre[0] : ''}${profile.apellido ? profile.apellido[0] : ''}`;

                        return (
                            <div
                                key={profile.id}
                                onClick={() => navigate(`/doj/sanctions/${profile.id}`)}
                                style={{
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    backdropFilter: 'blur(16px)',
                                    WebkitBackdropFilter: 'blur(16px)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderLeft: `4px solid ${hasSanctions ? '#f43f5e' : '#10b981'}`,
                                    borderRadius: '18px',
                                    padding: '1.4rem 1.6rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                                    boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.4)'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.boxShadow = `0 14px 30px -8px ${hasSanctions ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`;
                                    e.currentTarget.style.borderColor = hasSanctions ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 8px 24px -6px rgba(0, 0, 0, 0.4)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                                    e.currentTarget.style.borderLeftColor = hasSanctions ? '#f43f5e' : '#10b981';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '50%',
                                            background: hasSanctions ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                            border: `1.5px solid ${hasSanctions ? '#f43f5e' : '#10b981'}`,
                                            color: hasSanctions ? '#fda4af' : '#6ee7b7',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1.05rem',
                                            fontWeight: 800,
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                        }}>
                                            {initials}
                                        </div>
                                        <div>
                                            <h3 style={{ margin: '0 0 0.2rem 0', fontSize: '1.1rem', fontWeight: 800, color: '#ffffff' }}>
                                                {profile.nombre} {profile.apellido}
                                            </h3>
                                            <span style={{
                                                fontFamily: 'monospace',
                                                fontSize: '0.76rem',
                                                fontWeight: 700,
                                                color: '#cbd5e1',
                                                background: 'rgba(255, 255, 255, 0.06)',
                                                padding: '0.15rem 0.5rem',
                                                borderRadius: '6px'
                                            }}>
                                                PLACA: {profile.no_placa}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                        <button
                                            onClick={(e) => openForEdit(e, profile)}
                                            title="Editar"
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.06)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                color: '#cbd5e1',
                                                borderRadius: '8px',
                                                padding: '0.3rem 0.5rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(e, profile.id)}
                                            title="Eliminar"
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                color: '#f87171',
                                                borderRadius: '8px',
                                                padding: '0.3rem 0.5rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    paddingTop: '0.85rem',
                                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                    marginTop: 'auto',
                                    fontSize: '0.8rem'
                                }}>
                                    <span style={{ color: '#94a3b8' }}>
                                        {language === 'es' ? 'Faltas Registradas:' : 'Sanctions:'}
                                    </span>
                                    <span style={{
                                        fontWeight: 700,
                                        color: hasSanctions ? '#f43f5e' : '#34d399',
                                        background: hasSanctions ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                        border: `1px solid ${hasSanctions ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                                        padding: '0.15rem 0.6rem',
                                        borderRadius: '9999px'
                                    }}>
                                        {count} {language === 'es' ? (count === 1 ? 'Sanción' : 'Sanciones') : (count === 1 ? 'Record' : 'Records')}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal: Create / Edit Profile */}
            {showModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowModal(false)}>
                    <div className="mac-modal-container" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f', display: 'inline-block' }}></span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                DOJ • SANCTION PROFILE
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                            {editingId 
                                ? (language === 'es' ? 'Modificar Expediente' : 'Edit Officer Profile') 
                                : (language === 'es' ? 'Registrar Agente / Sujeto' : 'Register New Officer')}
                        </h2>
                        <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: '0 0 1.25rem 0' }}>
                            {language === 'es' 
                                ? 'Ficha disciplinaria interna para registrar faltas y citaciones del DOJ.' 
                                : 'Officer record for documenting infractions and judicial sanctions.'}
                        </p>

                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Nombre *' : 'Name *'}</label>
                                    <input
                                        required
                                        className="mac-form-input"
                                        value={formData.nombre}
                                        onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                    />
                                </div>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Apellido *' : 'Surname *'}</label>
                                    <input
                                        required
                                        className="mac-form-input"
                                        value={formData.apellido}
                                        onChange={e => setFormData({ ...formData, apellido: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Número de Placa / Identificador *' : 'Badge Number *'}</label>
                                <input
                                    required
                                    className="mac-form-input"
                                    placeholder="Ej: 418"
                                    value={formData.no_placa}
                                    onChange={e => setFormData({ ...formData, no_placa: e.target.value })}
                                />
                            </div>

                            <div className="mac-modal-actions" style={{ marginTop: '1.25rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    disabled={loadingAction}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#cbd5e1',
                                        padding: '0.55rem 1.15rem',
                                        borderRadius: '10px',
                                        fontSize: '0.82rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    disabled={loadingAction}
                                    style={{
                                        background: 'linear-gradient(135deg, #f43f5e, #e11d48)',
                                        border: 'none',
                                        color: '#ffffff',
                                        padding: '0.55rem 1.3rem',
                                        borderRadius: '10px',
                                        fontSize: '0.82rem',
                                        fontWeight: 700,
                                        cursor: loadingAction ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 4px 14px rgba(244, 63, 94, 0.35)'
                                    }}
                                >
                                    {loadingAction ? (language === 'es' ? 'Guardando...' : 'Saving...') : (editingId ? (language === 'es' ? 'Guardar Cambios' : 'Save Changes') : (language === 'es' ? 'Crear Ficha' : 'Create Profile'))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DOJSanctions;
