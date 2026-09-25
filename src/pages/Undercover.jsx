import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { uploadImageToStorage, filterBucketImages, getProfileImage } from '../utils/imageStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import '../index.css';

const safeStrMatch = (str, query) => {
    if (!str || !query) return false;
    return String(str).toLowerCase().includes(String(query).trim().toLowerCase());
};

const STATUS_CONFIG = {
    infiltrated: { label: 'Infiltrado / En Misión', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', icon: '🟢' },
    active: { label: 'Identidad Activa', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.4)', icon: '🔵' },
    standby: { label: 'En Espera / Tapadera', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', icon: '🟡' },
    burned: { label: 'Quemada / Expuesta', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', icon: '🔴' },
    concluded: { label: 'Operación Finalizada', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.4)', icon: '⚪' }
};

const CATEGORY_CONFIG = {
    meeting: { label: 'Reunión / Contacto', icon: '🤝', color: '#38bdf8' },
    movement: { label: 'Movimiento / Tráfico', icon: '📦', color: '#fbbf24' },
    weapons: { label: 'Armamento / Balística', icon: '🔫', color: '#ef4444' },
    drugs: { label: 'Narcóticos / Drogas', icon: '💊', color: '#a855f7' },
    hierarchy: { label: 'Jerarquía / Liderazgo', icon: '👑', color: '#f59e0b' },
    territory: { label: 'Territorio / Zonas', icon: '📍', color: '#10b981' },
    general: { label: 'Inteligencia General', icon: '📝', color: '#94a3b8' }
};

const THREAT_CONFIG = {
    low: { label: 'Bajo', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    medium: { label: 'Medio', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)' },
    high: { label: 'Alto', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
    critical: { label: 'Crítico / Inmediato', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' }
};

export default function Undercover() {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { isLSSD, branding } = useTheme();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [accessDenied, setAccessDenied] = useState(false);
    const [feedbackNotice, setFeedbackNotice] = useState(null);

    // Main navigation tabs: 'personas' | 'intel' | 'roster'
    const [activeTab, setActiveTab] = useState('personas');
    const [statusFilter, setStatusFilter] = useState('all');
    const [gangFilter, setGangFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Data lists
    const [personas, setPersonas] = useState([]);
    const [intelReports, setIntelReports] = useState([]);
    const [users, setUsers] = useState([]);
    const [gangs, setGangs] = useState([]);

    // Modals
    const [showPersonaModal, setShowPersonaModal] = useState(false);
    const [editingPersona, setEditingPersona] = useState(null);
    const [showIntelModal, setShowIntelModal] = useState(false);
    const [editingIntel, setEditingIntel] = useState(null);
    const [selectedPersonaDossier, setSelectedPersonaDossier] = useState(null);
    const [dossierTab, setDossierTab] = useState('profile'); // 'profile' | 'social' | 'vehicles' | 'gallery' | 'intel'
    const [expandedImage, setExpandedImage] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Form State: Persona
    const [pOfficerId, setPOfficerId] = useState('');
    const [pCharacterName, setPCharacterName] = useState('');
    const [pAlias, setPAlias] = useState('');
    const [pFakeId, setPFakeId] = useState('');
    const [pPhone, setPPhone] = useState('');
    const [pStatus, setPStatus] = useState('active');
    const [pTargetGangId, setPTargetGangId] = useState('');
    const [pBackstory, setPBackstory] = useState('');
    const [pAppearance, setPAppearance] = useState('');
    const [pPhotos, setPPhotos] = useState([]);
    const [pSocialMedia, setPSocialMedia] = useState([]);
    const [pVehicles, setPVehicles] = useState([]);
    const [pContacts, setPContacts] = useState([]);

    // Sub-form temp states
    const [newSocialPlatform, setNewSocialPlatform] = useState('Lifeinvader');
    const [newSocialHandle, setNewSocialHandle] = useState('');
    const [newSocialUrl, setNewSocialUrl] = useState('');
    const [newSocialNotes, setNewSocialNotes] = useState('');

    const [newVehModel, setNewVehModel] = useState('');
    const [newVehPlate, setNewVehPlate] = useState('');
    const [newVehColor, setNewVehColor] = useState('');
    const [newVehNotes, setNewVehNotes] = useState('');

    const [newContactName, setNewContactName] = useState('');
    const [newContactRelation, setNewContactRelation] = useState('');
    const [newContactPhone, setNewContactPhone] = useState('');
    const [newContactNotes, setNewContactNotes] = useState('');

    // Form State: Gang Intel
    const [iGangId, setIGangId] = useState('');
    const [iPersonaId, setIPersonaId] = useState('');
    const [iTitle, setITitle] = useState('');
    const [iContent, setIContent] = useState('');
    const [iCategory, setICategory] = useState('general');
    const [iThreatLevel, setIThreatLevel] = useState('medium');
    const [iImages, setIImages] = useState([]);
    const [iDate, setIDate] = useState(new Date().toISOString().slice(0, 16));

    useEffect(() => {
        checkAccessAndLoad();
    }, []);

    const checkAccessAndLoad = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/');
                return;
            }

            const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
            if (!userData) {
                setAccessDenied(true);
                setLoading(false);
                return;
            }

            setProfile(userData);

            const role = userData.rol ? userData.rol.toLowerCase().trim() : '';
            const isCommand = ['coordinador', 'comisionado', 'administrador', 'admin', 'superadmin'].includes(role);
            const isUD = (userData.divisions && (userData.divisions.includes('Undercover') || userData.divisions.includes('Undercover Division') || userData.divisions.includes('UD'))) ||
                         (userData.subdivisions && (userData.subdivisions.includes('Undercover') || userData.subdivisions.includes('Undercover Division') || userData.subdivisions.includes('UD')));

            if (!isCommand && !isUD) {
                setAccessDenied(true);
                setLoading(false);
                return;
            }

            await Promise.all([
                loadPersonas(),
                loadIntel(),
                fetchUsers(),
                fetchGangs()
            ]);
        } catch (err) {
            console.error("Access verification error:", err);
            setAccessDenied(true);
        } finally {
            setLoading(false);
        }
    };

    const loadPersonas = async () => {
        try {
            const { data, error } = await supabase.rpc('get_undercover_personas');
            if (error) {
                // Fallback to table query if RPC is not loaded yet
                console.warn('RPC get_undercover_personas failed, using direct query fallback:', error);
                const { data: directData } = await supabase
                    .from('undercover_personas')
                    .select('*, officer:users(nombre, apellido, rango, no_placa, profile_image), gang:gangs(name, color)')
                    .order('created_at', { ascending: false });

                if (directData) {
                    const mapped = directData.map(p => ({
                        ...p,
                        officer_name: p.officer ? `${p.officer.nombre} ${p.officer.apellido}` : 'Oficial',
                        officer_rank: p.officer?.rango || 'Detective',
                        officer_badge: p.officer?.no_placa || '-',
                        officer_avatar: p.officer?.profile_image,
                        target_gang_name: p.gang?.name || p.target_gang_name,
                        target_gang_color: p.gang?.color
                    }));
                    setPersonas(mapped);
                    return;
                }
            }
            setPersonas(data || []);
        } catch (err) {
            console.error("Error loading personas:", err);
        }
    };

    const loadIntel = async () => {
        try {
            const { data, error } = await supabase.rpc('get_undercover_gang_intel');
            if (error) {
                console.warn('RPC get_undercover_gang_intel failed, using direct query fallback:', error);
                const { data: directData } = await supabase
                    .from('undercover_gang_intel')
                    .select('*, gang:gangs(name, color), persona:undercover_personas(character_name, alias, photos), officer:users(nombre, apellido, rango, profile_image)')
                    .order('incident_date', { ascending: false });

                if (directData) {
                    const mapped = directData.map(i => ({
                        ...i,
                        gang_name: i.gang?.name,
                        gang_color: i.gang?.color,
                        persona_name: i.persona?.character_name,
                        persona_alias: i.persona?.alias,
                        persona_photo: i.persona?.photos?.[0],
                        officer_name: i.officer ? `${i.officer.nombre} ${i.officer.apellido}` : 'Agente',
                        officer_rank: i.officer?.rango || 'Detective',
                        officer_avatar: i.officer?.profile_image,
                        can_edit: true
                    }));
                    setIntelReports(mapped);
                    return;
                }
            }
            setIntelReports(data || []);
        } catch (err) {
            console.error("Error loading intel reports:", err);
        }
    };

    const fetchUsers = async () => {
        try {
            const { data } = await supabase.from('users').select('id, nombre, apellido, rango, no_placa, profile_image, divisions, subdivisions').order('nombre');
            setUsers(data || []);
        } catch (err) {
            console.error("Error fetching users:", err);
        }
    };

    const fetchGangs = async () => {
        try {
            const { data } = await supabase.from('gangs').select('id, name, color').eq('is_archived', false).order('name');
            setGangs(data || []);
        } catch (err) {
            console.error("Error fetching gangs:", err);
        }
    };

    // --- PERSONA MODAL HANDLERS ---
    const handleOpenCreatePersona = () => {
        setEditingPersona(null);
        setPOfficerId(profile ? profile.id : '');
        setPCharacterName('');
        setPAlias('');
        setPFakeId('');
        setPPhone('');
        setPStatus('infiltrated');
        setPTargetGangId('');
        setPBackstory('');
        setPAppearance('');
        setPPhotos([]);
        setPSocialMedia([]);
        setPVehicles([]);
        setPContacts([]);
        setShowPersonaModal(true);
    };

    const handleOpenEditPersona = (persona) => {
        setEditingPersona(persona);
        setPOfficerId(persona.officer_id || '');
        setPCharacterName(persona.character_name || '');
        setPAlias(persona.alias || '');
        setPFakeId(persona.fake_id || '');
        setPPhone(persona.phone || '');
        setPStatus(persona.status || 'active');
        setPTargetGangId(persona.target_gang_id || '');
        setPBackstory(persona.backstory || '');
        setPAppearance(persona.appearance_notes || '');
        setPPhotos(Array.isArray(persona.photos) ? persona.photos : []);
        setPSocialMedia(Array.isArray(persona.social_media) ? persona.social_media : []);
        setPVehicles(Array.isArray(persona.vehicles) ? persona.vehicles : []);
        setPContacts(Array.isArray(persona.contacts) ? persona.contacts : []);
        setShowPersonaModal(true);
    };

    const handleSavePersona = async (e) => {
        e.preventDefault();
        if (!pCharacterName.trim()) {
            alert("El nombre del personaje/identidad encubierta es obligatorio.");
            return;
        }
        if (!pOfficerId) {
            alert("Debes asignar el oficial real correspondiente.");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                p_id: editingPersona ? editingPersona.id : null,
                p_officer_id: pOfficerId,
                p_character_name: pCharacterName.trim(),
                p_alias: pAlias.trim(),
                p_fake_id: pFakeId.trim(),
                p_phone: pPhone.trim(),
                p_status: pStatus,
                p_target_gang_id: pTargetGangId || null,
                p_target_gang_name: pTargetGangId ? gangs.find(g => g.id === pTargetGangId)?.name : '',
                p_backstory: pBackstory.trim(),
                p_appearance_notes: pAppearance.trim(),
                p_social_media: pSocialMedia,
                p_photos: pPhotos,
                p_vehicles: pVehicles,
                p_contacts: pContacts
            };

            const { error } = await supabase.rpc('save_undercover_persona', payload);
            if (error) {
                // Fallback to direct supabase table insert/update
                console.warn('RPC save_undercover_persona error, trying direct query:', error);
                const tablePayload = {
                    officer_id: pOfficerId,
                    character_name: pCharacterName.trim(),
                    alias: pAlias.trim(),
                    fake_id: pFakeId.trim(),
                    phone: pPhone.trim(),
                    status: pStatus,
                    target_gang_id: pTargetGangId || null,
                    target_gang_name: pTargetGangId ? gangs.find(g => g.id === pTargetGangId)?.name : '',
                    backstory: pBackstory.trim(),
                    appearance_notes: pAppearance.trim(),
                    social_media: pSocialMedia,
                    photos: pPhotos,
                    vehicles: pVehicles,
                    contacts: pContacts,
                    updated_at: new Date().toISOString()
                };

                if (editingPersona) {
                    const { error: updErr } = await supabase.from('undercover_personas').update(tablePayload).eq('id', editingPersona.id);
                    if (updErr) throw updErr;
                } else {
                    const { error: insErr } = await supabase.from('undercover_personas').insert([tablePayload]);
                    if (insErr) throw insErr;
                }
            }

            setShowPersonaModal(false);
            loadPersonas();
            setFeedbackNotice(editingPersona ? "✅ Identidad encubierta actualizada con éxito 🕶️" : "✅ Nuevo personaje encubierto registrado 🕶️");
            setTimeout(() => setFeedbackNotice(null), 5000);
        } catch (err) {
            console.error("Error saving persona:", err);
            alert("Error al guardar personaje: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeletePersona = async (id, name) => {
        if (!confirm(`⚠️ ¿Estás seguro de eliminar el personaje encubierto "${name}"?\nSe conservarán los datos de inteligencia vinculados.`)) return;
        try {
            const { error } = await supabase.rpc('delete_undercover_persona', { p_id: id });
            if (error) {
                await supabase.from('undercover_personas').delete().eq('id', id);
            }
            if (selectedPersonaDossier?.id === id) {
                setSelectedPersonaDossier(null);
            }
            loadPersonas();
            setFeedbackNotice("🗑️ Personaje encubierto eliminado.");
            setTimeout(() => setFeedbackNotice(null), 4000);
        } catch (err) {
            alert("Error al eliminar: " + err.message);
        }
    };

    // --- INTEL MODAL HANDLERS ---
    const handleOpenCreateIntel = (defaultGangId = null, defaultPersonaId = null) => {
        setEditingIntel(null);
        setIGangId(defaultGangId || (gangs[0] ? gangs[0].id : ''));
        setIPersonaId(defaultPersonaId || (personas[0] ? personas[0].id : ''));
        setITitle('');
        setIContent('');
        setICategory('general');
        setIThreatLevel('medium');
        setIImages([]);
        setIDate(new Date().toISOString().slice(0, 16));
        setShowIntelModal(true);
    };

    const handleOpenEditIntel = (intel) => {
        setEditingIntel(intel);
        setIGangId(intel.gang_id || '');
        setIPersonaId(intel.persona_id || '');
        setITitle(intel.title || '');
        setIContent(intel.content || '');
        setICategory(intel.category || 'general');
        setIThreatLevel(intel.threat_level || 'medium');
        setIImages(Array.isArray(intel.images) ? intel.images : []);
        setIDate(intel.incident_date ? new Date(intel.incident_date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16));
        setShowIntelModal(true);
    };

    const handleSaveIntel = async (e) => {
        e.preventDefault();
        if (!iTitle.trim() || !iContent.trim()) {
            alert("Por favor completa el título y el contenido del informe.");
            return;
        }
        if (!iGangId) {
            alert("Debes seleccionar la banda objetivo correspondiente.");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                p_id: editingIntel ? editingIntel.id : null,
                p_gang_id: iGangId,
                p_persona_id: iPersonaId || null,
                p_title: iTitle.trim(),
                p_content: iContent.trim(),
                p_category: iCategory,
                p_threat_level: iThreatLevel,
                p_images: iImages,
                p_incident_date: iDate ? new Date(iDate).toISOString() : new Date().toISOString()
            };

            const { error } = await supabase.rpc('save_undercover_gang_intel', payload);
            if (error) {
                console.warn('RPC save_undercover_gang_intel error, using fallback:', error);
                const tablePayload = {
                    gang_id: iGangId,
                    persona_id: iPersonaId || null,
                    officer_id: profile ? profile.id : null,
                    title: iTitle.trim(),
                    content: iContent.trim(),
                    category: iCategory,
                    threat_level: iThreatLevel,
                    images: iImages,
                    incident_date: iDate ? new Date(iDate).toISOString() : new Date().toISOString()
                };

                if (editingIntel) {
                    const { error: updErr } = await supabase.from('undercover_gang_intel').update(tablePayload).eq('id', editingIntel.id);
                    if (updErr) throw updErr;
                } else {
                    const { error: insErr } = await supabase.from('undercover_gang_intel').insert([tablePayload]);
                    if (insErr) throw insErr;
                }
            }

            setShowIntelModal(false);
            loadIntel();
            loadPersonas();
            setFeedbackNotice(editingIntel ? "✅ Informe de inteligencia encubierta actualizado 📁" : "✅ Informe de inteligencia encubierta registrado en Gang Unit 📁");
            setTimeout(() => setFeedbackNotice(null), 5000);
        } catch (err) {
            console.error("Error saving intel:", err);
            alert("Error al guardar inteligencia: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteIntel = async (id) => {
        if (!confirm("¿Deseas eliminar este informe de inteligencia encubierta?")) return;
        try {
            const { error } = await supabase.rpc('delete_undercover_gang_intel', { p_id: id });
            if (error) {
                await supabase.from('undercover_gang_intel').delete().eq('id', id);
            }
            loadIntel();
            setFeedbackNotice("🗑️ Informe de inteligencia eliminado.");
            setTimeout(() => setFeedbackNotice(null), 4000);
        } catch (err) {
            alert("Error al eliminar: " + err.message);
        }
    };

    // --- IMAGE UPLOAD HELPER ---
    const handleImageUpload = async (e, setState, single = false) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        try {
            for (const file of files) {
                const publicUrl = await uploadImageToStorage(file, 'gangs');
                if (publicUrl) {
                    if (single) {
                        setState(publicUrl);
                    } else {
                        setState(prev => [...prev, publicUrl]);
                    }
                }
            }
        } catch (err) {
            console.error("Error uploading image:", err);
            alert("Error al subir imagen: " + err.message);
        }
    };

    // --- SUB-FORM HELPERS ---
    const handleAddSocialMedia = () => {
        if (!newSocialHandle.trim()) return;
        setPSocialMedia(prev => [
            ...prev,
            {
                id: 'sm_' + Date.now(),
                platform: newSocialPlatform,
                handle: newSocialHandle.trim(),
                url: newSocialUrl.trim(),
                notes: newSocialNotes.trim()
            }
        ]);
        setNewSocialHandle('');
        setNewSocialUrl('');
        setNewSocialNotes('');
    };

    const handleRemoveSocialMedia = (id) => {
        setPSocialMedia(prev => prev.filter(s => s.id !== id));
    };

    const handleAddVehicle = () => {
        if (!newVehModel.trim() && !newVehPlate.trim()) return;
        setPVehicles(prev => [
            ...prev,
            {
                id: 'veh_' + Date.now(),
                model: newVehModel.trim(),
                plate: newVehPlate.trim(),
                color: newVehColor.trim(),
                notes: newVehNotes.trim()
            }
        ]);
        setNewVehModel('');
        setNewVehPlate('');
        setNewVehColor('');
        setNewVehNotes('');
    };

    const handleRemoveVehicle = (id) => {
        setPVehicles(prev => prev.filter(v => v.id !== id));
    };

    const handleAddContact = () => {
        if (!newContactName.trim()) return;
        setPContacts(prev => [
            ...prev,
            {
                id: 'cnt_' + Date.now(),
                name: newContactName.trim(),
                relation: newContactRelation.trim(),
                phone: newContactPhone.trim(),
                notes: newContactNotes.trim()
            }
        ]);
        setNewContactName('');
        setNewContactRelation('');
        setNewContactPhone('');
        setNewContactNotes('');
    };

    const handleRemoveContact = (id) => {
        setPContacts(prev => prev.filter(c => c.id !== id));
    };

    // --- FILTERED LISTS ---
    const filteredPersonas = personas.filter(p => {
        if (statusFilter !== 'all' && p.status !== statusFilter) return false;
        if (gangFilter !== 'all' && p.target_gang_id !== gangFilter) return false;
        if (searchQuery.trim() !== '') {
            const q = searchQuery.trim().toLowerCase();
            return (
                safeStrMatch(p.character_name, q) ||
                safeStrMatch(p.alias, q) ||
                safeStrMatch(p.officer_name, q) ||
                safeStrMatch(p.fake_id, q) ||
                safeStrMatch(p.phone, q) ||
                safeStrMatch(p.target_gang_name, q) ||
                safeStrMatch(p.backstory, q) ||
                (p.social_media || []).some(sm => safeStrMatch(sm.handle, q) || safeStrMatch(sm.platform, q)) ||
                (p.vehicles || []).some(v => safeStrMatch(v.model, q) || safeStrMatch(v.plate, q))
            );
        }
        return true;
    });

    const filteredIntel = intelReports.filter(i => {
        if (gangFilter !== 'all' && i.gang_id !== gangFilter) return false;
        if (searchQuery.trim() !== '') {
            const q = searchQuery.trim().toLowerCase();
            return (
                safeStrMatch(i.title, q) ||
                safeStrMatch(i.content, q) ||
                safeStrMatch(i.gang_name, q) ||
                safeStrMatch(i.persona_name, q) ||
                safeStrMatch(i.officer_name, q)
            );
        }
        return true;
    });

    const udAgents = users.filter(u => {
        const isUD = (u.divisions && (u.divisions.includes('Undercover') || u.divisions.includes('Undercover Division') || u.divisions.includes('UD'))) ||
                     (u.subdivisions && (u.subdivisions.includes('Undercover') || u.subdivisions.includes('Undercover Division') || u.subdivisions.includes('UD')));
        return isUD;
    });

    if (loading) {
        return (
            <div className="loading-container" style={{ textAlign: 'center', marginTop: '4rem', color: '#94a3b8' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🕶️</div>
                <div>Cargando División Undercover...</div>
            </div>
        );
    }

    if (accessDenied) {
        return (
            <div className="documentation-container" style={{ textAlign: 'center', marginTop: '4rem' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔒</div>
                <h1 style={{ color: '#ef4444', fontSize: '2.5rem', margin: '0 0 1rem 0' }}>Acceso Restringido</h1>
                <p style={{ color: '#94a3b8', maxWidth: '500px', margin: '0 auto', lineHeight: '1.6' }}>
                    Esta área es de alta confidencialidad y está reservada exclusivamente para agentes de la <strong>División Undercover (UD)</strong> y el Alto Mando del Departamento.
                </p>
                <button
                    className="mac-btn mac-btn-primary"
                    style={{ marginTop: '2rem' }}
                    onClick={() => navigate('/dashboard')}
                >
                    Volver al Panel Principal
                </button>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', minHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', padding: '1.2rem 1.8rem', boxSizing: 'border-box' }}>
            
            {/* Top Header Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        {branding?.undercover_logo ? (
                            <img src={branding.undercover_logo} alt="Undercover Logo" style={{ width: '38px', height: '38px', objectFit: 'contain' }} />
                        ) : (
                            <span style={{ fontSize: '1.8rem' }}>🕶️</span>
                        )}
                        <div>
                            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>{branding?.undercover_title || (isLSSD ? 'SCUB Undercover Division' : 'Undercover Division (UD)')}</span>
                                <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(239, 68, 68, 0.18)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
                                    TOP SECRET
                                </span>
                            </h1>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                {branding?.undercover_subtitle || 'Gestión de identidades encubiertas, leyendas de infiltración y aportes a Gang Unit'}
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="mac-doc-tabs" style={{ padding: '0.25rem' }}>
                        <button className={`mac-doc-tab ${activeTab === 'personas' ? 'active' : ''}`} onClick={() => setActiveTab('personas')} style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}>
                            <span>🎭 Personajes & Identidades</span>
                            <span style={{ marginLeft: '6px', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', background: activeTab === 'personas' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255,255,255,0.1)' }}>
                                {personas.length}
                            </span>
                        </button>
                        <button className={`mac-doc-tab ${activeTab === 'intel' ? 'active' : ''}`} onClick={() => setActiveTab('intel')} style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}>
                            <span>📁 Informes a Gang Unit</span>
                            <span style={{ marginLeft: '6px', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', background: activeTab === 'intel' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255,255,255,0.1)' }}>
                                {intelReports.length}
                            </span>
                        </button>
                        <button className={`mac-doc-tab ${activeTab === 'roster' ? 'active' : ''}`} onClick={() => setActiveTab('roster')} style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }}>
                            <span>🛡️ Cuadrilla de Agentes</span>
                            <span style={{ marginLeft: '6px', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', background: activeTab === 'roster' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255,255,255,0.1)' }}>
                                {udAgents.length}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Right Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                        className="mac-btn mac-btn-secondary"
                        style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        onClick={() => navigate('/gangs')}
                        title="Ir directamente al panel de Gang Unit"
                    >
                        <span>📂 Ver Gang Unit</span>
                    </button>
                    <button
                        className="mac-btn mac-btn-secondary"
                        style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem', borderColor: 'rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
                        onClick={() => handleOpenCreateIntel()}
                    >
                        <span>+ Aportar Inteligencia</span>
                    </button>
                    <button
                        className="mac-btn mac-btn-primary"
                        style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        onClick={handleOpenCreatePersona}
                    >
                        <span>+ Nueva Identidad Encubierta</span>
                    </button>
                </div>
            </div>

            {/* Notification Notice */}
            {feedbackNotice && (
                <div style={{
                    marginBottom: '1rem',
                    padding: '0.75rem 1.2rem',
                    borderRadius: '8px',
                    background: 'rgba(74, 222, 128, 0.15)',
                    border: '1px solid #4ade80',
                    color: '#4ade80',
                    fontSize: '0.88rem',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}>
                    {feedbackNotice}
                </div>
            )}

            {/* Filter & Search Bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1.2rem',
                background: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                marginBottom: '1.2rem',
                gap: '1rem',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
                    {/* Search Input */}
                    <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
                        <input
                            type="text"
                            placeholder="Buscar personaje, alias, oficial, red, DNI..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '0.45rem 2rem 0.45rem 0.85rem',
                                background: 'rgba(0, 0, 0, 0.4)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '8px',
                                color: '#ffffff',
                                fontSize: '0.82rem',
                                outline: 'none'
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Status Filter (for personas tab) */}
                    {activeTab === 'personas' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Estado:</span>
                            <select
                                className="form-input"
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto', background: 'rgba(0,0,0,0.4)' }}
                            >
                                <option value="all">Todos los estados</option>
                                <option value="infiltrated">🟢 Infiltrado / En Misión</option>
                                <option value="active">🔵 Identidad Activa</option>
                                <option value="standby">🟡 En Espera / Tapadera</option>
                                <option value="burned">🔴 Quemada / Expuesta</option>
                                <option value="concluded">⚪ Finalizada</option>
                            </select>
                        </div>
                    )}

                    {/* Gang Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Banda Objetivo:</span>
                        <select
                            className="form-input"
                            value={gangFilter}
                            onChange={e => setGangFilter(e.target.value)}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: 'auto', background: 'rgba(0,0,0,0.4)' }}
                        >
                            <option value="all">Todas las bandas</option>
                            {gangs.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Mostrando <strong>{activeTab === 'personas' ? filteredPersonas.length : activeTab === 'intel' ? filteredIntel.length : udAgents.length}</strong> registros
                </div>
            </div>

            {/* TAB 1: PERSONAJES E IDENTIDADES ENCUBIERTAS */}
            {activeTab === 'personas' && (
                <div>
                    {filteredPersonas.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '0.5rem', opacity: 0.8 }}>🎭</div>
                            <h3 style={{ margin: '0 0 0.5rem 0', color: '#ffffff', fontSize: '1.2rem' }}>No hay identidades encubiertas registradas</h3>
                            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem', maxWidth: '420px', marginInline: 'auto' }}>
                                Crea un personaje encubierto seleccionando a un oficial del departamento para asignarle una tapadera, historia y objetivo.
                            </p>
                            <button
                                className="mac-btn mac-btn-primary"
                                style={{ marginTop: '1.5rem', padding: '0.5rem 1.2rem' }}
                                onClick={handleOpenCreatePersona}
                            >
                                + Crear Primera Identidad
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.2rem' }}>
                            {filteredPersonas.map(persona => {
                                const st = STATUS_CONFIG[persona.status] || STATUS_CONFIG.active;
                                const avatarPhoto = (persona.photos && persona.photos.length > 0) ? persona.photos[0] : (persona.officer_avatar || '/logowebp/anon.webp');
                                const socialCount = (persona.social_media || []).length;
                                const vehCount = (persona.vehicles || []).length;
                                const contactCount = (persona.contacts || []).length;

                                return (
                                    <div
                                        key={persona.id}
                                        style={{
                                            background: 'rgba(15, 23, 42, 0.75)',
                                            backdropFilter: 'blur(10px)',
                                            border: '1px solid rgba(255, 255, 255, 0.09)',
                                            borderLeft: `4px solid ${st.color}`,
                                            borderRadius: '14px',
                                            padding: '1.2rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.85rem',
                                            transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                                        }}
                                        onClick={() => { setSelectedPersonaDossier(persona); setDossierTab('profile'); }}
                                        onMouseEnter={e => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';
                                            e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.4)';
                                        }}
                                        onMouseLeave={e => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.09)';
                                        }}
                                    >
                                        {/* Card Top: Status & Target Gang */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                            <span style={{
                                                fontSize: '0.72rem',
                                                fontWeight: 800,
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                backgroundColor: st.bg,
                                                color: st.color,
                                                border: `1px solid ${st.border}`,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                {st.icon} {st.label}
                                            </span>

                                            {persona.target_gang_name && (
                                                <span style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    backgroundColor: persona.target_gang_color ? `${persona.target_gang_color}22` : 'rgba(245, 158, 11, 0.15)',
                                                    color: persona.target_gang_color || '#fbbf24',
                                                    border: `1px solid ${persona.target_gang_color ? `${persona.target_gang_color}66` : 'rgba(245, 158, 11, 0.3)'}`,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    🎯 {persona.target_gang_name}
                                                </span>
                                            )}
                                        </div>

                                        {/* Persona Profile Header */}
                                        <div style={{ display: 'flex', gap: '0.9rem', alignItems: 'center' }}>
                                            <img
                                                src={avatarPhoto}
                                                alt=""
                                                style={{
                                                    width: '64px',
                                                    height: '64px',
                                                    borderRadius: '10px',
                                                    objectFit: 'cover',
                                                    border: `2px solid ${persona.target_gang_color || '#38bdf8'}`,
                                                    flexShrink: 0,
                                                    background: '#1e293b'
                                                }}
                                                onClick={(e) => { e.stopPropagation(); setExpandedImage(avatarPhoto); }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {persona.character_name}
                                                </div>
                                                {persona.alias && (
                                                    <div style={{ fontSize: '0.82rem', color: 'var(--accent-gold, #f59e0b)', fontWeight: 700, fontStyle: 'italic' }}>
                                                        Alias: "{persona.alias}"
                                                    </div>
                                                )}
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span>🛡️ Oficial:</span>
                                                    <strong style={{ color: '#e2e8f0' }}>{persona.officer_rank} {persona.officer_name}</strong>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Identity Chips */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.74rem' }}>
                                            {persona.fake_id && (
                                                <span style={{ padding: '2px 7px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', color: '#cbd5e1' }}>
                                                    🪪 DNI: <strong style={{ color: '#fff' }}>{persona.fake_id}</strong>
                                                </span>
                                            )}
                                            {persona.phone && (
                                                <span style={{ padding: '2px 7px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', color: '#cbd5e1' }}>
                                                    📱 {persona.phone}
                                                </span>
                                            )}
                                            {vehCount > 0 && (
                                                <span style={{ padding: '2px 7px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', color: '#38bdf8' }}>
                                                    🚗 {vehCount} {vehCount === 1 ? 'vehículo' : 'vehículos'}
                                                </span>
                                            )}
                                            {socialCount > 0 && (
                                                <span style={{ padding: '2px 7px', background: 'rgba(255,255,255,0.05)', borderRadius: '5px', color: '#a855f7' }}>
                                                    🌐 {socialCount} {socialCount === 1 ? 'red social' : 'redes'}
                                                </span>
                                            )}
                                            {persona.intel_count > 0 && (
                                                <span style={{ padding: '2px 7px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '5px', color: '#34d399', fontWeight: 700 }}>
                                                    📁 {persona.intel_count} {persona.intel_count === 1 ? 'informe' : 'informes'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Backstory preview */}
                                        {persona.backstory && (
                                            <div style={{
                                                fontSize: '0.76rem',
                                                color: '#94a3b8',
                                                lineHeight: '1.4',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden',
                                                background: 'rgba(0,0,0,0.2)',
                                                padding: '0.4rem 0.6rem',
                                                borderRadius: '6px'
                                            }}>
                                                {persona.backstory}
                                            </div>
                                        )}

                                        {/* Actions footer */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.06)' }} onClick={e => e.stopPropagation()}>
                                            <button
                                                className="mac-btn mac-btn-secondary"
                                                style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                                                onClick={() => { setSelectedPersonaDossier(persona); setDossierTab('profile'); }}
                                            >
                                                👁️ Ver Expediente Completo
                                            </button>

                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <button
                                                    className="mac-btn mac-btn-secondary"
                                                    style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#38bdf8' }}
                                                    onClick={() => handleOpenCreateIntel(persona.target_gang_id, persona.id)}
                                                    title="Aportar inteligencia con esta identidad"
                                                >
                                                    + Aportar Intel
                                                </button>
                                                <button
                                                    className="mac-btn mac-btn-secondary"
                                                    style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                                                    onClick={() => handleOpenEditPersona(persona)}
                                                    title="Editar personaje"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="mac-btn mac-btn-secondary"
                                                    style={{ fontSize: '0.72rem', padding: '3px 8px', color: '#f87171' }}
                                                    onClick={() => handleDeletePersona(persona.id, persona.character_name)}
                                                    title="Eliminar personaje"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: INFORMES DE INTELIGENCIA A GANG UNIT */}
            {activeTab === 'intel' && (
                <div>
                    {filteredIntel.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '0.5rem', opacity: 0.8 }}>📁</div>
                            <h3 style={{ margin: '0 0 0.5rem 0', color: '#ffffff', fontSize: '1.2rem' }}>Sin informes de inteligencia encubierta</h3>
                            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem', maxWidth: '450px', marginInline: 'auto' }}>
                                Redacta y aporta informes de observación e inteligencia sobre las bandas investigadas para que aparezcan en Gang Unit.
                            </p>
                            <button
                                className="mac-btn mac-btn-primary"
                                style={{ marginTop: '1.5rem', padding: '0.5rem 1.2rem' }}
                                onClick={() => handleOpenCreateIntel()}
                            >
                                + Redactar Primer Informe
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {filteredIntel.map(intel => {
                                const cat = CATEGORY_CONFIG[intel.category] || CATEGORY_CONFIG.general;
                                const thr = THREAT_CONFIG[intel.threat_level] || THREAT_CONFIG.medium;
                                const images = Array.isArray(intel.images) ? filterBucketImages(intel.images) : [];

                                return (
                                    <div
                                        key={intel.id}
                                        style={{
                                            background: 'rgba(15, 23, 42, 0.75)',
                                            backdropFilter: 'blur(10px)',
                                            border: '1px solid rgba(255, 255, 255, 0.09)',
                                            borderLeft: `4px solid ${intel.gang_color || cat.color}`,
                                            borderRadius: '12px',
                                            padding: '1.2rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.75rem'
                                        }}
                                    >
                                        {/* Intel Header */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                <span style={{
                                                    fontSize: '0.74rem',
                                                    fontWeight: 800,
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    backgroundColor: intel.gang_color ? `${intel.gang_color}22` : 'rgba(245, 158, 11, 0.15)',
                                                    color: intel.gang_color || '#fbbf24',
                                                    border: `1px solid ${intel.gang_color ? `${intel.gang_color}88` : 'rgba(245, 158, 11, 0.4)'}`
                                                }}>
                                                    🎯 {intel.gang_name}
                                                </span>

                                                <span style={{
                                                    fontSize: '0.74rem',
                                                    fontWeight: 700,
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    background: 'rgba(255,255,255,0.06)',
                                                    color: cat.color,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    {cat.icon} {cat.label}
                                                </span>

                                                <span style={{
                                                    fontSize: '0.74rem',
                                                    fontWeight: 800,
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    backgroundColor: thr.bg,
                                                    color: thr.color
                                                }}>
                                                    Alerta: {thr.label}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                    📅 {new Date(intel.incident_date || intel.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <button
                                                    className="mac-btn mac-btn-secondary"
                                                    style={{ fontSize: '0.7rem', padding: '2px 6px' }}
                                                    onClick={() => handleOpenEditIntel(intel)}
                                                    title="Editar informe"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    className="mac-btn mac-btn-secondary"
                                                    style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#f87171' }}
                                                    onClick={() => handleDeleteIntel(intel.id)}
                                                    title="Eliminar informe"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>

                                        {/* Title & Author */}
                                        <div>
                                            <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '1.1rem', fontWeight: 700, color: '#ffffff' }}>
                                                {intel.title}
                                            </h3>
                                            <div style={{ fontSize: '0.76rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                {intel.persona_name && (
                                                    <span>🎭 Personaje: <strong style={{ color: '#38bdf8' }}>{intel.persona_name} {intel.persona_alias ? `("${intel.persona_alias}")` : ''}</strong></span>
                                                )}
                                                <span>🛡️ Redactor: <strong style={{ color: '#cbd5e1' }}>{intel.officer_rank} {intel.officer_name}</strong></span>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: '1.6', background: 'rgba(0,0,0,0.25)', padding: '0.8rem 1rem', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                                            {intel.content}
                                        </div>

                                        {/* Evidence Gallery */}
                                        {images.length > 0 && (
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                                                {images.map((img, idx) => (
                                                    <img
                                                        key={idx}
                                                        src={img}
                                                        alt="Evidence"
                                                        style={{ width: '80px', height: '60px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)' }}
                                                        onClick={() => setExpandedImage(img)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: CUADRILLA DE AGENTES UD */}
            {activeTab === 'roster' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.2rem' }}>
                        {udAgents.map(agent => {
                            const agentPersonas = personas.filter(p => p.officer_id === agent.id);
                            const agentIntel = intelReports.filter(i => i.officer_id === agent.id);

                            return (
                                <div
                                    key={agent.id}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.75)',
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(255, 255, 255, 0.09)',
                                        borderRadius: '12px',
                                        padding: '1.2rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem'
                                    }}
                                >
                                    <img
                                        src={getProfileImage(agent.profile_image, '/logowebp/anon.webp')}
                                        alt=""
                                        style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #38bdf8' }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                                            {agent.nombre} {agent.apellido}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--accent-gold, #f59e0b)', fontWeight: 600 }}>
                                            {agent.rango || 'Detective'} {agent.no_placa ? `[#${agent.no_placa}]` : ''}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px', display: 'flex', gap: '8px' }}>
                                            <span>🎭 <strong>{agentPersonas.length}</strong> identidades</span>
                                            <span>📁 <strong>{agentIntel.length}</strong> informes</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* --- MODAL: CREATE / EDIT PERSONA --- */}
            {showPersonaModal && (
                <div className="mac-modal-overlay" onClick={() => setShowPersonaModal(false)}>
                    <div className="mac-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '750px', width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowPersonaModal(false)}></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">
                                {editingPersona ? `✏️ Editar Identidad: ${editingPersona.character_name}` : '🕶️ Registrar Nueva Identidad Encubierta'}
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <form onSubmit={handleSavePersona} style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Officer Selector */}
                            <div className="form-group">
                                <label style={{ color: '#38bdf8', fontWeight: 700 }}>Agente / Detective Real Asignado *</label>
                                <select
                                    className="form-input"
                                    value={pOfficerId}
                                    onChange={e => setPOfficerId(e.target.value)}
                                    required
                                >
                                    <option value="">-- Seleccionar Agente del Personal --</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.rango ? `[${u.rango}] ` : ''}{u.nombre} {u.apellido} {u.no_placa ? `(Placa #${u.no_placa})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Identity Names & Alias */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label>Nombre del Personaje / Identidad Falsa *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={pCharacterName}
                                        onChange={e => setPCharacterName(e.target.value)}
                                        placeholder="Ej. Sarah Crowley"
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Alias / Apodo Callejero</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={pAlias}
                                        onChange={e => setPAlias(e.target.value)}
                                        placeholder="Ej. Leandra, Red, Ghost..."
                                    />
                                </div>
                            </div>

                            {/* Fake ID, Phone, Status & Target Gang */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label>DNI / Pasaporte Falso</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={pFakeId}
                                        onChange={e => setPFakeId(e.target.value)}
                                        placeholder="Ej. 48192-A"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Teléfono Encubierto</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={pPhone}
                                        onChange={e => setPPhone(e.target.value)}
                                        placeholder="Ej. 555-0182"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label>Estado de la Identidad</label>
                                    <select
                                        className="form-input"
                                        value={pStatus}
                                        onChange={e => setPStatus(e.target.value)}
                                    >
                                        <option value="infiltrated">🟢 Infiltrado / En Misión Activa</option>
                                        <option value="active">🔵 Identidad Activa (Preparada)</option>
                                        <option value="standby">🟡 En Espera / Tapadera</option>
                                        <option value="burned">🔴 Quemada / Expuesta</option>
                                        <option value="concluded">⚪ Operación Finalizada</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Banda / Grupo Objetivo (Gang Unit)</label>
                                    <select
                                        className="form-input"
                                        value={pTargetGangId}
                                        onChange={e => setPTargetGangId(e.target.value)}
                                    >
                                        <option value="">-- Sin Banda Específica --</option>
                                        {gangs.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Backstory & Appearance */}
                            <div className="form-group">
                                <label>Historia & Leyenda del Personaje (Backstory / Lore)</label>
                                <textarea
                                    className="eval-textarea"
                                    rows="4"
                                    value={pBackstory}
                                    onChange={e => setPBackstory(e.target.value)}
                                    placeholder="Detalles sobre el origen del personaje, tapadera laboral, antecedentes falsos, familia simulada, justificación en la ciudad..."
                                />
                            </div>

                            <div className="form-group">
                                <label>Rasgos Físicos & Notas de Apariencia</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={pAppearance}
                                    onChange={e => setPAppearance(e.target.value)}
                                    placeholder="Tatuajes falsos, cicatrices, estilo de vestimenta, peinado, complementos distintivos..."
                                />
                            </div>

                            {/* Photos / Gallery */}
                            <div className="form-group">
                                <label>Fotos del Personaje & Galería de Infiltración</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={e => handleImageUpload(e, setPPhotos)}
                                    className="form-input"
                                />
                                {pPhotos.length > 0 && (
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                        {pPhotos.map((img, idx) => (
                                            <div key={idx} style={{ position: 'relative' }}>
                                                <img src={img} alt="" style={{ width: '60px', height: '60px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #444' }} />
                                                <button
                                                    type="button"
                                                    onClick={() => setPPhotos(prev => prev.filter((_, i) => i !== idx))}
                                                    style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', fontSize: '10px' }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Social Media Manager */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <label style={{ color: '#a855f7', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                                    🌐 Redes Sociales del Personaje
                                </label>
                                
                                {pSocialMedia.map(sm => (
                                    <div key={sm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                                        <span><strong>{sm.platform}:</strong> {sm.handle} {sm.url ? `(${sm.url})` : ''} {sm.notes ? `• ${sm.notes}` : ''}</span>
                                        <button type="button" onClick={() => handleRemoveSocialMedia(sm.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>✕</button>
                                    </div>
                                ))}

                                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr auto', gap: '6px', marginTop: '6px' }}>
                                    <select className="form-input" value={newSocialPlatform} onChange={e => setNewSocialPlatform(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem' }}>
                                        <option value="Lifeinvader">Lifeinvader</option>
                                        <option value="Twotter">Twotter</option>
                                        <option value="Instagram">Instagram</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                    <input type="text" className="form-input" placeholder="@handle" value={newSocialHandle} onChange={e => setNewSocialHandle(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem' }} />
                                    <input type="text" className="form-input" placeholder="Notas/URL" value={newSocialNotes} onChange={e => setNewSocialNotes(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem' }} />
                                    <button type="button" className="mac-btn mac-btn-secondary" onClick={handleAddSocialMedia} style={{ fontSize: '0.75rem', padding: '0.35rem 0.8rem' }}>+ Añadir</button>
                                </div>
                            </div>

                            {/* Vehicles Manager */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <label style={{ color: '#38bdf8', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                                    🚗 Vehículos Encubiertos
                                </label>
                                
                                {pVehicles.map(veh => (
                                    <div key={veh.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                                        <span><strong>{veh.model}</strong> [{veh.plate || 'SIN PLACA'}] {veh.color ? `• ${veh.color}` : ''} {veh.notes ? `• ${veh.notes}` : ''}</span>
                                        <button type="button" onClick={() => handleRemoveVehicle(veh.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>✕</button>
                                    </div>
                                ))}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '6px', marginTop: '6px' }}>
                                    <input type="text" className="form-input" placeholder="Modelo (Ej. Sultan)" value={newVehModel} onChange={e => setNewVehModel(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem' }} />
                                    <input type="text" className="form-input" placeholder="Matrícula" value={newVehPlate} onChange={e => setNewVehPlate(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem' }} />
                                    <input type="text" className="form-input" placeholder="Color/Detalles" value={newVehColor} onChange={e => setNewVehColor(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem' }} />
                                    <button type="button" className="mac-btn mac-btn-secondary" onClick={handleAddVehicle} style={{ fontSize: '0.75rem', padding: '0.35rem 0.8rem' }}>+ Añadir</button>
                                </div>
                            </div>

                            {/* Underworld Contacts Manager */}
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <label style={{ color: '#10b981', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                                    👥 Contactos Callejeros / Entorno
                                </label>
                                
                                {pContacts.map(cnt => (
                                    <div key={cnt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                                        <span><strong>{cnt.name}</strong> {cnt.relation ? `(${cnt.relation})` : ''} {cnt.phone ? `• ${cnt.phone}` : ''} {cnt.notes ? `• ${cnt.notes}` : ''}</span>
                                        <button type="button" onClick={() => handleRemoveContact(cnt.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}>✕</button>
                                    </div>
                                ))}

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '6px', marginTop: '6px' }}>
                                    <input type="text" className="form-input" placeholder="Nombre/Alias" value={newContactName} onChange={e => setNewContactName(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem' }} />
                                    <input type="text" className="form-input" placeholder="Relación (Camello, Jefe...)" value={newContactRelation} onChange={e => setNewContactRelation(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem' }} />
                                    <input type="text" className="form-input" placeholder="Teléfono" value={newContactPhone} onChange={e => setNewContactPhone(e.target.value)} style={{ padding: '0.35rem 0.5rem', fontSize: '0.78rem' }} />
                                    <button type="button" className="mac-btn mac-btn-secondary" onClick={handleAddContact} style={{ fontSize: '0.75rem', padding: '0.35rem 0.8rem' }}>+ Añadir</button>
                                </div>
                            </div>

                            {/* Submit buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <button type="button" className="mac-btn mac-btn-secondary" onClick={() => setShowPersonaModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="mac-btn mac-btn-primary" disabled={submitting}>
                                    {submitting ? 'Guardando...' : (editingPersona ? 'Guardar Cambios' : 'Registrar Identidad')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL: CREATE / EDIT GANG INTEL --- */}
            {showIntelModal && (
                <div className="mac-modal-overlay" onClick={() => setShowIntelModal(false)}>
                    <div className="mac-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '650px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowIntelModal(false)}></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">
                                {editingIntel ? '✏️ Editar Informe de Inteligencia' : '📁 Aportar Inteligencia a Gang Unit'}
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <form onSubmit={handleSaveIntel} style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {/* Gang & Persona selection */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label style={{ color: '#fbbf24', fontWeight: 700 }}>Banda Objetivo *</label>
                                    <select
                                        className="form-input"
                                        value={iGangId}
                                        onChange={e => setIGangId(e.target.value)}
                                        required
                                    >
                                        <option value="">-- Seleccionar Banda --</option>
                                        {gangs.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label style={{ color: '#38bdf8', fontWeight: 700 }}>Personaje que Aporta la Info</label>
                                    <select
                                        className="form-input"
                                        value={iPersonaId}
                                        onChange={e => setIPersonaId(e.target.value)}
                                    >
                                        <option value="">-- Identidad Genérica / Sin Asignar --</option>
                                        {personas.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.character_name} {p.alias ? `("${p.alias}")` : ''} - [{p.officer_name}]
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Title */}
                            <div className="form-group">
                                <label>Título del Informe / Observación *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={iTitle}
                                    onChange={e => setITitle(e.target.value)}
                                    placeholder="Ej. Trato de armas automáticas en almacén de Cypress Flats"
                                    required
                                />
                            </div>

                            {/* Category, Threat Level & Date */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label>Categoría</label>
                                    <select
                                        className="form-input"
                                        value={iCategory}
                                        onChange={e => setICategory(e.target.value)}
                                    >
                                        <option value="meeting">🤝 Reunión / Trato</option>
                                        <option value="movement">📦 Movimiento / Tráfico</option>
                                        <option value="weapons">🔫 Armamento</option>
                                        <option value="drugs">💊 Narcóticos</option>
                                        <option value="hierarchy">👑 Jerarquía / Miembros</option>
                                        <option value="territory">📍 Territorio / Zona</option>
                                        <option value="general">📝 General</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Nivel de Alerta</label>
                                    <select
                                        className="form-input"
                                        value={iThreatLevel}
                                        onChange={e => setIThreatLevel(e.target.value)}
                                    >
                                        <option value="low">🟢 Bajo</option>
                                        <option value="medium">🟡 Medio</option>
                                        <option value="high">🟠 Alto</option>
                                        <option value="critical">🔴 Crítico</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Fecha del Suceso</label>
                                    <input
                                        type="datetime-local"
                                        className="form-input"
                                        value={iDate}
                                        onChange={e => setIDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="form-group">
                                <label>Contenido Detallado de la Inteligencia *</label>
                                <textarea
                                    className="eval-textarea"
                                    rows="5"
                                    value={iContent}
                                    onChange={e => setIContent(e.target.value)}
                                    placeholder="Descripción completa de la información obtenida, sujetos involucrados, matrículas vistas, armas o paquetes transportados, lugares citados..."
                                    required
                                />
                            </div>

                            {/* Evidence Photos */}
                            <div className="form-group">
                                <label>Fotos & Evidencias de Vigilancia</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={e => handleImageUpload(e, setIImages)}
                                    className="form-input"
                                />
                                {iImages.length > 0 && (
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                                        {iImages.map((img, idx) => (
                                            <div key={idx} style={{ position: 'relative' }}>
                                                <img src={img} alt="" style={{ width: '60px', height: '60px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #444' }} />
                                                <button
                                                    type="button"
                                                    onClick={() => setIImages(prev => prev.filter((_, i) => i !== idx))}
                                                    style={{ position: 'absolute', top: -5, right: -5, background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', fontSize: '10px' }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Submit buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <button type="button" className="mac-btn mac-btn-secondary" onClick={() => setShowIntelModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="mac-btn mac-btn-primary" disabled={submitting}>
                                    {submitting ? 'Guardando...' : (editingIntel ? 'Guardar Cambios' : 'Aportar a Gang Unit')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- DOSSIER SLIDE-OVER MODAL: INSPECT FULL PERSONA --- */}
            {selectedPersonaDossier && (
                <div className="mac-modal-overlay" onClick={() => setSelectedPersonaDossier(null)}>
                    <div className="mac-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', width: '96vw', maxHeight: '94vh', display: 'flex', flexDirection: 'column' }}>
                        
                        {/* Header */}
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setSelectedPersonaDossier(null)}></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title">
                                📁 Expediente Clasificado: {selectedPersonaDossier.character_name} {selectedPersonaDossier.alias ? `("${selectedPersonaDossier.alias}")` : ''}
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        {/* Persona Dossier Hero */}
                        <div style={{ padding: '1.2rem 1.5rem', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '1.2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <img
                                src={(selectedPersonaDossier.photos && selectedPersonaDossier.photos[0]) || selectedPersonaDossier.officer_avatar || '/logowebp/anon.webp'}
                                alt=""
                                style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: `3px solid ${selectedPersonaDossier.target_gang_color || '#38bdf8'}` }}
                                onClick={() => setExpandedImage((selectedPersonaDossier.photos && selectedPersonaDossier.photos[0]) || selectedPersonaDossier.officer_avatar)}
                            />
                            <div style={{ flex: 1, minWidth: '220px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#ffffff' }}>
                                        {selectedPersonaDossier.character_name}
                                    </h2>
                                    {selectedPersonaDossier.alias && (
                                        <span style={{ color: 'var(--accent-gold, #f59e0b)', fontWeight: 800, fontSize: '0.9rem' }}>
                                            "{selectedPersonaDossier.alias}"
                                        </span>
                                    )}
                                    <span style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 800,
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        backgroundColor: STATUS_CONFIG[selectedPersonaDossier.status]?.bg || 'rgba(56,189,248,0.15)',
                                        color: STATUS_CONFIG[selectedPersonaDossier.status]?.color || '#38bdf8'
                                    }}>
                                        {STATUS_CONFIG[selectedPersonaDossier.status]?.label || selectedPersonaDossier.status}
                                    </span>
                                </div>

                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                                    <span>🛡️ Oficial: <strong style={{ color: '#fff' }}>{selectedPersonaDossier.officer_rank} {selectedPersonaDossier.officer_name}</strong></span>
                                    {selectedPersonaDossier.target_gang_name && <span>🎯 Infiltrado en: <strong style={{ color: selectedPersonaDossier.target_gang_color || '#fbbf24' }}>{selectedPersonaDossier.target_gang_name}</strong></span>}
                                    {selectedPersonaDossier.fake_id && <span>🪪 DNI Falso: <strong style={{ color: '#fff' }}>{selectedPersonaDossier.fake_id}</strong></span>}
                                    {selectedPersonaDossier.phone && <span>📱 Tel: <strong style={{ color: '#fff' }}>{selectedPersonaDossier.phone}</strong></span>}
                                </div>
                            </div>
                        </div>

                        {/* Dossier Segmented Tabs */}
                        <div style={{ display: 'flex', padding: '0.5rem 1.5rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', gap: '6px', overflowX: 'auto' }}>
                            <button className={`mac-btn ${dossierTab === 'profile' ? 'mac-btn-primary' : 'mac-btn-secondary'}`} onClick={() => setDossierTab('profile')} style={{ fontSize: '0.76rem', padding: '4px 10px' }}>
                                📖 Historia & Leyenda
                            </button>
                            <button className={`mac-btn ${dossierTab === 'social' ? 'mac-btn-primary' : 'mac-btn-secondary'}`} onClick={() => setDossierTab('social')} style={{ fontSize: '0.76rem', padding: '4px 10px' }}>
                                🌐 Redes Sociales ({(selectedPersonaDossier.social_media || []).length})
                            </button>
                            <button className={`mac-btn ${dossierTab === 'vehicles' ? 'mac-btn-primary' : 'mac-btn-secondary'}`} onClick={() => setDossierTab('vehicles')} style={{ fontSize: '0.76rem', padding: '4px 10px' }}>
                                🚗 Vehículos & Contactos
                            </button>
                            <button className={`mac-btn ${dossierTab === 'gallery' ? 'mac-btn-primary' : 'mac-btn-secondary'}`} onClick={() => setDossierTab('gallery')} style={{ fontSize: '0.76rem', padding: '4px 10px' }}>
                                📷 Galería ({(selectedPersonaDossier.photos || []).length})
                            </button>
                            <button className={`mac-btn ${dossierTab === 'intel' ? 'mac-btn-primary' : 'mac-btn-secondary'}`} onClick={() => setDossierTab('intel')} style={{ fontSize: '0.76rem', padding: '4px 10px' }}>
                                📁 Inteligencia Aportada ({intelReports.filter(i => i.persona_id === selectedPersonaDossier.id).length})
                            </button>
                        </div>

                        {/* Dossier Body Content */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
                            
                            {/* Sub-tab 1: Profile & Backstory */}
                            {dossierTab === 'profile' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--accent-gold, #f59e0b)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                            📜 Historia y Tapadera (Lore)
                                        </h4>
                                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', color: '#cbd5e1', fontSize: '0.85rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                            {selectedPersonaDossier.backstory || 'Sin historia o antecedentes especificados para este personaje.'}
                                        </div>
                                    </div>

                                    {selectedPersonaDossier.appearance_notes && (
                                        <div>
                                            <h4 style={{ margin: '0 0 0.4rem 0', color: '#38bdf8', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                👤 Apariencia y Rasgos Distintivos
                                            </h4>
                                            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.8rem 1rem', borderRadius: '8px', color: '#cbd5e1', fontSize: '0.85rem' }}>
                                                {selectedPersonaDossier.appearance_notes}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Sub-tab 2: Social Media */}
                            {dossierTab === 'social' && (
                                <div>
                                    {(selectedPersonaDossier.social_media || []).length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                            No se han registrado cuentas de redes sociales para esta identidad.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                                            {selectedPersonaDossier.social_media.map((sm, idx) => (
                                                <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.8rem' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#a855f7', textTransform: 'uppercase' }}>
                                                        {sm.platform}
                                                    </div>
                                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                                                        {sm.handle}
                                                    </div>
                                                    {sm.url && <div style={{ fontSize: '0.74rem', color: '#38bdf8', marginTop: '2px' }}>{sm.url}</div>}
                                                    {sm.notes && <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px', fontStyle: 'italic' }}>{sm.notes}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Sub-tab 3: Vehicles & Contacts */}
                            {dossierTab === 'vehicles' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                    <div>
                                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#38bdf8', fontSize: '0.88rem' }}>🚗 Vehículos Encubiertos</h4>
                                        {(selectedPersonaDossier.vehicles || []).length === 0 ? (
                                            <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.8rem' }}>Sin vehículos asignados.</div>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                                                {selectedPersonaDossier.vehicles.map((v, idx) => (
                                                    <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem' }}>
                                                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{v.model}</div>
                                                        <div style={{ color: 'var(--accent-gold, #f59e0b)', fontFamily: 'monospace', fontWeight: 800, fontSize: '0.82rem' }}>[{v.plate || 'SIN PLACA'}]</div>
                                                        {v.color && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Color: {v.color}</div>}
                                                        {v.notes && <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '3px' }}>{v.notes}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#10b981', fontSize: '0.88rem' }}>👥 Contactos Callejeros</h4>
                                        {(selectedPersonaDossier.contacts || []).length === 0 ? (
                                            <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.8rem' }}>Sin contactos registrados.</div>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                                                {selectedPersonaDossier.contacts.map((c, idx) => (
                                                    <div key={idx} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.75rem' }}>
                                                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{c.name}</div>
                                                        {c.relation && <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>{c.relation}</div>}
                                                        {c.phone && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>📱 {c.phone}</div>}
                                                        {c.notes && <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '3px' }}>{c.notes}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Sub-tab 4: Gallery */}
                            {dossierTab === 'gallery' && (
                                <div>
                                    {(selectedPersonaDossier.photos || []).length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                            No hay fotos añadidas a la galería de esta identidad.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                                            {selectedPersonaDossier.photos.map((img, idx) => (
                                                <img
                                                    key={idx}
                                                    src={img}
                                                    alt="Persona"
                                                    style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)' }}
                                                    onClick={() => setExpandedImage(img)}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Sub-tab 5: Intel Submitted */}
                            {dossierTab === 'intel' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {intelReports.filter(i => i.persona_id === selectedPersonaDossier.id).length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                            Esta identidad no ha aportado informes de inteligencia todavía.
                                        </div>
                                    ) : (
                                        intelReports.filter(i => i.persona_id === selectedPersonaDossier.id).map(i => (
                                            <div key={i.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.8rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 800, color: '#fff', fontSize: '0.92rem' }}>{i.title}</span>
                                                    <span style={{ color: '#fbbf24', fontSize: '0.74rem', fontWeight: 700 }}>🎯 {i.gang_name}</span>
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '4px' }}>{i.content}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* --- EXPANDED IMAGE VIEWER MODAL --- */}
            {expandedImage && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
                    onClick={() => setExpandedImage(null)}
                >
                    <img src={expandedImage} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '10px', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }} />
                </div>
            )}

        </div>
    );
}
