import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import AvatarEditor from 'react-avatar-editor';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage } from '../utils/imageStorage';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function DOJLicenses() {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [civilians, setCivilians] = useState([]);
    const [licenseTypes, setLicenseTypes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [showCivilianModal, setShowCivilianModal] = useState(false);
    const [showLicenseTypesModal, setShowLicenseTypesModal] = useState(false);

    // Civilian form
    const [civilianForm, setCivilianForm] = useState({
        nombre: '',
        apellido: '',
        id_number: '',
        phone_number: '',
        profile_image: '',
        notes: ''
    });
    const [editingCivilianId, setEditingCivilianId] = useState(null);

    // License type form
    const [licenseTypeForm, setLicenseTypeForm] = useState({ name: '', description: '' });
    const [editingLicenseTypeId, setEditingLicenseTypeId] = useState(null);

    // Image cropper
    const [editorOpen, setEditorOpen] = useState(false);
    const [imageSrc, setImageSrc] = useState(null);
    const [scale, setScale] = useState(1.2);
    const editorRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            await Promise.all([loadCivilians(), loadLicenseTypes()]);
        } catch (err) {
            console.error('Error loading data:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadCivilians = async () => {
        const { data, error } = await supabase.rpc('get_doj_civilians');
        if (error) throw error;
        setCivilians(data || []);
    };

    const loadLicenseTypes = async () => {
        const { data, error } = await supabase.rpc('get_doj_license_types');
        if (error) throw error;
        setLicenseTypes(data || []);
    };

    // ===== CIVILIAN CRUD =====
    const openCivilianModal = (civilian = null) => {
        if (civilian) {
            setCivilianForm({
                nombre: civilian.nombre,
                apellido: civilian.apellido,
                id_number: civilian.id_number,
                phone_number: civilian.phone_number || '',
                profile_image: civilian.profile_image || '',
                notes: civilian.notes || ''
            });
            setEditingCivilianId(civilian.id);
        } else {
            setCivilianForm({ nombre: '', apellido: '', id_number: '', phone_number: '', profile_image: '', notes: '' });
            setEditingCivilianId(null);
        }
        setShowCivilianModal(true);
    };

    const handleSaveCivilian = async (e) => {
        e.preventDefault();
        try {
            let finalImage = civilianForm.profile_image;
            if (finalImage && finalImage.startsWith('data:')) {
                finalImage = await uploadImageToStorage(finalImage, 'avatars');
            }
            const payload = { ...civilianForm, profile_image: finalImage };

            if (editingCivilianId) {
                const { error } = await supabase.rpc('update_doj_civilian', {
                    p_id: editingCivilianId,
                    p_nombre: payload.nombre,
                    p_apellido: payload.apellido,
                    p_id_number: payload.id_number,
                    p_phone_number: payload.phone_number,
                    p_profile_image: payload.profile_image,
                    p_notes: payload.notes
                });
                if (error) {
                    const fallback = await supabase
                        .from('doj_civilian_profiles')
                        .update(payload)
                        .eq('id', editingCivilianId);
                    if (fallback.error) throw fallback.error;
                }
            } else {
                const { error } = await supabase.rpc('create_doj_civilian', {
                    p_nombre: payload.nombre,
                    p_apellido: payload.apellido,
                    p_id_number: payload.id_number,
                    p_phone_number: payload.phone_number,
                    p_profile_image: payload.profile_image,
                    p_notes: payload.notes
                });
                if (error) {
                    const { data: { user } } = await supabase.auth.getUser();
                    const fallback = await supabase
                        .from('doj_civilian_profiles')
                        .insert([{ ...payload, created_by: user ? user.id : null }]);
                    if (fallback.error) throw fallback.error;
                }
            }

            setShowCivilianModal(false);
            loadCivilians();
        } catch (err) {
            alert('Error saving civilian: ' + err.message);
        }
    };

    // ===== LICENSE TYPE CRUD =====
    const handleSaveLicenseType = async (e) => {
        e.preventDefault();
        try {
            if (editingLicenseTypeId) {
                const { error } = await supabase.rpc('manage_doj_license_type', {
                    p_action: 'update',
                    p_id: editingLicenseTypeId,
                    p_name: licenseTypeForm.name,
                    p_description: licenseTypeForm.description
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.rpc('manage_doj_license_type', {
                    p_action: 'create',
                    p_name: licenseTypeForm.name,
                    p_description: licenseTypeForm.description
                });
                if (error) throw error;
            }

            setLicenseTypeForm({ name: '', description: '' });
            setEditingLicenseTypeId(null);
            loadLicenseTypes();
        } catch (err) {
            alert('Error saving license type: ' + err.message);
        }
    };

    const handleDeleteLicenseType = async (id) => {
        if (!window.confirm(language === 'es' ? "¿Eliminar este tipo de licencia? Afectará a los civiles asignados." : "Are you sure? Deleting this license type will remove it from civilians.")) return;
        try {
            const { error } = await supabase.rpc('manage_doj_license_type', {
                p_action: 'delete',
                p_id: id
            });
            if (error) throw error;
            loadLicenseTypes();
            loadCivilians();
        } catch (err) {
            alert('Error deleting license type: ' + err.message);
        }
    };

    // ===== IMAGE CROPPER =====
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                setImageSrc(reader.result);
                setEditorOpen(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveCroppedImage = () => {
        if (editorRef.current) {
            const canvas = editorRef.current.getImageScaledToCanvas();
            const base64 = canvas.toDataURL('image/webp', 0.85);
            setCivilianForm({ ...civilianForm, profile_image: base64 });
            setEditorOpen(false);
            setImageSrc(null);
        }
    };

    const filteredCivilians = civilians.filter(c => {
        const q = searchTerm.toLowerCase();
        return (
            c.nombre?.toLowerCase().includes(q) ||
            c.apellido?.toLowerCase().includes(q) ||
            c.id_number?.toLowerCase().includes(q) ||
            c.phone_number?.toLowerCase().includes(q)
        );
    });

    return (
        <div className="mac-dashboard-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* macOS Command Header Banner */}
            <div 
                className="mac-command-banner" 
                style={{
                    marginBottom: '1.75rem',
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(11, 15, 25, 0.95))',
                    border: '1px solid rgba(139, 92, 246, 0.25)',
                    boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                    <img
                        src="/logowebp/doj-logo.webp"
                        alt="DOJ Logo"
                        style={{ height: '64px', width: 'auto', filter: 'drop-shadow(0 4px 14px rgba(139, 92, 246, 0.35))' }}
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
                            <span className="mac-status-dot" style={{ backgroundColor: '#8b5cf6', boxShadow: '0 0 10px #8b5cf6' }}></span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {language === 'es' ? 'Padrón de Ciudadanos & Permisos' : 'Citizen Registry & Permits'}
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.2rem 0 0 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {language === 'es' ? 'GESTIÓN DE LICENCIAS CIUDADANAS' : 'CITIZEN LICENSES & PERMITS'}
                        </h1>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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
                            placeholder={language === 'es' ? "Buscar por nombre o ID..." : "Search name or ID..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Manage License Types Button */}
                    <button
                        onClick={() => setShowLicenseTypesModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.6rem 1rem',
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#e2e8f0',
                            borderRadius: '12px',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="4" y1="21" x2="4" y2="14"/>
                            <line x1="4" y1="10" x2="4" y2="3"/>
                            <line x1="12" y1="21" x2="12" y2="12"/>
                            <line x1="12" y1="8" x2="12" y2="3"/>
                            <line x1="20" y1="21" x2="20" y2="16"/>
                            <line x1="20" y1="12" x2="20" y2="3"/>
                            <line x1="1" y1="14" x2="7" y2="14"/>
                            <line x1="9" y1="8" x2="15" y2="8"/>
                            <line x1="17" y1="16" x2="23" y2="16"/>
                        </svg>
                        <span>{language === 'es' ? 'Tipos de Licencia' : 'License Types'}</span>
                    </button>

                    {/* New Civilian Button */}
                    <button
                        className="mac-btn mac-btn-primary"
                        onClick={() => openCivilianModal()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.6rem 1.1rem',
                            background: 'rgba(139, 92, 246, 0.25)',
                            border: '1px solid rgba(139, 92, 246, 0.5)',
                            color: '#d8b4fe',
                            borderRadius: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 4px 16px rgba(139, 92, 246, 0.25)'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>{language === 'es' ? 'Nuevo Ciudadano' : 'New Civilian'}</span>
                    </button>
                </div>
            </div>

            {/* Civilians Grid */}
            {loading ? (
                <div className="mac-doc-empty">
                    <span className="mac-status-dot" style={{ animation: 'pulse 1s infinite', backgroundColor: '#8b5cf6', width: '10px', height: '10px', display: 'inline-block', borderRadius: '50%', marginBottom: '0.5rem' }}></span>
                    <div>{language === 'es' ? 'Cargando padrón ciudadano...' : 'Loading citizen registry...'}</div>
                </div>
            ) : filteredCivilians.length === 0 ? (
                <div className="mac-doc-empty">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4, marginBottom: '0.75rem' }}>
                        <rect x="3" y="4" width="18" height="16" rx="3"/>
                        <circle cx="9" cy="10" r="2"/>
                    </svg>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.25rem' }}>
                        {language === 'es' ? 'No se encontraron ciudadanos' : 'No civilians found'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        {language === 'es' ? 'Añada un perfil con el botón superior' : 'Add a new civilian profile above'}
                    </div>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1.25rem'
                }}>
                    {filteredCivilians.map(civilian => {
                        const hasLicenses = civilian.license_count > 0;
                        return (
                            <div
                                key={civilian.id}
                                onClick={() => navigate(`/doj/licenses/${civilian.id}`)}
                                style={{
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    backdropFilter: 'blur(16px)',
                                    WebkitBackdropFilter: 'blur(16px)',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderLeft: `4px solid ${hasLicenses ? '#8b5cf6' : '#64748b'}`,
                                    borderRadius: '18px',
                                    padding: '1.4rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    textAlign: 'center',
                                    transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
                                    boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.4)'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                    e.currentTarget.style.boxShadow = '0 14px 30px -8px rgba(139, 92, 246, 0.3)';
                                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 8px 24px -6px rgba(0, 0, 0, 0.4)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                                    e.currentTarget.style.borderLeftColor = hasLicenses ? '#8b5cf6' : '#64748b';
                                }}
                            >
                                {/* Profile Avatar */}
                                <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                    <img
                                        src={civilian.profile_image || '/logowebp/anon.webp'}
                                        alt={civilian.nombre}
                                        style={{
                                            width: '76px',
                                            height: '76px',
                                            borderRadius: '50%',
                                            objectFit: 'cover',
                                            border: '3px solid rgba(139, 92, 246, 0.3)',
                                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
                                        }}
                                    />
                                    <span style={{
                                        position: 'absolute',
                                        bottom: '2px',
                                        right: '2px',
                                        width: '14px',
                                        height: '14px',
                                        borderRadius: '50%',
                                        backgroundColor: hasLicenses ? '#10b981' : '#64748b',
                                        border: '2px solid #0f172a'
                                    }}></span>
                                </div>

                                {/* Full Name */}
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.35rem 0' }}>
                                    {civilian.nombre} {civilian.apellido}
                                </h3>

                                {/* ID Badge Pill */}
                                <div style={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    color: '#c084fc',
                                    background: 'rgba(139, 92, 246, 0.15)',
                                    border: '1px solid rgba(139, 92, 246, 0.3)',
                                    padding: '0.2rem 0.65rem',
                                    borderRadius: '8px',
                                    marginBottom: '0.75rem'
                                }}>
                                    ID: {civilian.id_number}
                                </div>

                                {civilian.phone_number && (
                                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.85rem' }}>
                                        📞 {civilian.phone_number}
                                    </div>
                                )}

                                {/* Licenses Count Footer */}
                                <div style={{
                                    width: '100%',
                                    paddingTop: '0.75rem',
                                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '0.8rem',
                                    marginTop: 'auto'
                                }}>
                                    <span style={{ color: '#94a3b8' }}>
                                        {language === 'es' ? 'Permisos Activos:' : 'Licenses:'}
                                    </span>
                                    <span style={{
                                        fontWeight: 700,
                                        color: hasLicenses ? '#34d399' : '#64748b',
                                        background: hasLicenses ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                                        padding: '0.15rem 0.55rem',
                                        borderRadius: '9999px'
                                    }}>
                                        📜 {civilian.license_count}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Civilian Profile Modal */}
            {showCivilianModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowCivilianModal(false)}>
                    <div className="mac-modal-container" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f', display: 'inline-block' }}></span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                DOJ • CITIZEN PROFILE
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowCivilianModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.4rem 0' }}>
                            {editingCivilianId 
                                ? (language === 'es' ? 'Modificar Expediente Ciudadano' : 'Edit Civilian Profile') 
                                : (language === 'es' ? 'Alta de Expediente Ciudadano' : 'New Civilian Profile')}
                        </h2>
                        <p style={{ fontSize: '0.84rem', color: '#94a3b8', margin: '0 0 1.25rem 0' }}>
                            {language === 'es' 
                                ? 'Ficha civil para la habilitación de licencias de armamento y comerciales.' 
                                : 'Civilian profile for issuing legal licenses and weapon tracking.'}
                        </p>

                        <form onSubmit={handleSaveCivilian} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Nombre *' : 'First Name *'}</label>
                                    <input
                                        required
                                        className="mac-form-input"
                                        value={civilianForm.nombre}
                                        onChange={(e) => setCivilianForm({ ...civilianForm, nombre: e.target.value })}
                                    />
                                </div>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Apellido *' : 'Last Name *'}</label>
                                    <input
                                        required
                                        className="mac-form-input"
                                        value={civilianForm.apellido}
                                        onChange={(e) => setCivilianForm({ ...civilianForm, apellido: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Número de ID / DNI *' : 'ID / Citizen Number *'}</label>
                                    <input
                                        required
                                        className="mac-form-input"
                                        value={civilianForm.id_number}
                                        onChange={(e) => setCivilianForm({ ...civilianForm, id_number: e.target.value })}
                                    />
                                </div>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">{language === 'es' ? 'Teléfono de Contacto' : 'Phone Number'}</label>
                                    <input
                                        className="mac-form-input"
                                        value={civilianForm.phone_number}
                                        onChange={(e) => setCivilianForm({ ...civilianForm, phone_number: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Fotografía de Perfil' : 'Profile Picture'}</label>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0.85rem',
                                    border: '1px dashed rgba(255, 255, 255, 0.2)',
                                    borderRadius: '12px',
                                    background: 'rgba(0, 0, 0, 0.25)',
                                    color: '#cbd5e1',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}>
                                    <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                                    <span>{civilianForm.profile_image ? (language === 'es' ? 'Foto Cargada (Clic para cambiar)' : 'Photo Ready (Click to change)') : (language === 'es' ? 'Seleccionar Fotografía' : 'Choose Photo')}</span>
                                </label>
                                {civilianForm.profile_image && (
                                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.75rem' }}>
                                        <img src={civilianForm.profile_image} alt="Preview" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(139, 92, 246, 0.5)' }} />
                                    </div>
                                )}
                            </div>

                            <div className="mac-modal-actions" style={{ marginTop: '1.25rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowCivilianModal(false)}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#cbd5e1',
                                        padding: '0.55rem 1.15rem',
                                        borderRadius: '10px',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                                        border: 'none',
                                        color: '#ffffff',
                                        padding: '0.55rem 1.3rem',
                                        borderRadius: '10px',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)'
                                    }}
                                >
                                    {language === 'es' ? 'Guardar Expediente' : 'Save Profile'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manage License Types Modal */}
            {showLicenseTypesModal && (
                <div className="mac-modal-backdrop" onClick={() => setShowLicenseTypesModal(false)}>
                    <div className="mac-modal-container" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ff5f56', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#ffbd2e', display: 'inline-block' }}></span>
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#27c93f', display: 'inline-block' }}></span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                DOJ • LICENSE TYPES
                            </span>
                            <button
                                type="button"
                                onClick={() => setShowLicenseTypesModal(false)}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.5rem 0' }}>
                            {language === 'es' ? 'Configuración de Tipos de Licencias' : 'Manage License Types'}
                        </h2>

                        {/* Add / Edit Form */}
                        <form onSubmit={handleSaveLicenseType} style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.25)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Nombre de la Licencia *' : 'License Name *'}</label>
                                <input
                                    required
                                    className="mac-form-input"
                                    placeholder={language === 'es' ? "Ej: Portación de Armamento Oculto (CCW)" : "e.g. Concealed Carry Permit"}
                                    value={licenseTypeForm.name}
                                    onChange={(e) => setLicenseTypeForm({ ...licenseTypeForm, name: e.target.value })}
                                />
                            </div>
                            <div className="mac-form-group">
                                <label className="mac-form-label">{language === 'es' ? 'Descripción o Requisitos' : 'Description'}</label>
                                <textarea
                                    className="mac-form-textarea"
                                    rows="2"
                                    placeholder={language === 'es' ? "Marco legal o condiciones de expedición..." : "Permit requirements or conditions..."}
                                    value={licenseTypeForm.description}
                                    onChange={(e) => setLicenseTypeForm({ ...licenseTypeForm, description: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                {editingLicenseTypeId && (
                                    <button
                                        type="button"
                                        onClick={() => { setEditingLicenseTypeId(null); setLicenseTypeForm({ name: '', description: '' }); }}
                                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
                                    >
                                        {language === 'es' ? 'Cancelar Edición' : 'Cancel Edit'}
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    style={{
                                        background: '#8b5cf6',
                                        border: 'none',
                                        color: '#ffffff',
                                        padding: '0.45rem 1.1rem',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '0.82rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {editingLicenseTypeId ? (language === 'es' ? 'Actualizar Tipo' : 'Update Type') : (language === 'es' ? '+ Añadir Tipo' : '+ Add Type')}
                                </button>
                            </div>
                        </form>

                        {/* List */}
                        <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {licenseTypes.length === 0 ? (
                                <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                                    {language === 'es' ? 'No hay tipos de licencia creados' : 'No license types created yet'}
                                </div>
                            ) : (
                                licenseTypes.map(lt => (
                                    <div
                                        key={lt.id}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.88rem' }}>
                                                {lt.name}
                                            </div>
                                            {lt.description && (
                                                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                                    {lt.description}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                                            <button
                                                onClick={() => {
                                                    setLicenseTypeForm({ name: lt.name, description: lt.description || '' });
                                                    setEditingLicenseTypeId(lt.id);
                                                }}
                                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleDeleteLicenseType(lt.id)}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                                                title="Eliminar"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowLicenseTypesModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: '10px',
                                    fontSize: '0.82rem',
                                    cursor: 'pointer'
                                }}
                            >
                                {language === 'es' ? 'Cerrar' : 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Cropper Modal */}
            {editorOpen && createPortal(
                <div className="mac-modal-backdrop" style={{ zIndex: 9999999 }}>
                    <div className="mac-modal-container" style={{ maxWidth: '420px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 1rem 0', color: '#ffffff' }}>
                            {language === 'es' ? 'Ajustar Fotografía Civil' : 'Adjust Picture'}
                        </h3>
                        <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                            <AvatarEditor
                                ref={editorRef}
                                image={imageSrc}
                                width={240}
                                height={240}
                                border={20}
                                borderRadius={120}
                                color={[0, 0, 0, 0.6]}
                                scale={scale}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.25rem' }}>
                            <span style={{ color: '#94a3b8' }}>-</span>
                            <input
                                type="range"
                                min="1"
                                max="3"
                                step="0.01"
                                value={scale}
                                onChange={(e) => setScale(parseFloat(e.target.value))}
                                style={{ accentColor: '#8b5cf6', width: '200px' }}
                            />
                            <span style={{ color: '#94a3b8' }}>+</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={() => { setEditorOpen(false); setImageSrc(null); }}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                {language === 'es' ? 'Cancelar' : 'Cancel'}
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveCroppedImage}
                                style={{
                                    background: '#8b5cf6',
                                    border: 'none',
                                    color: '#ffffff',
                                    padding: '0.5rem 1.25rem',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                {language === 'es' ? 'Aplicar' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

export default DOJLicenses;
