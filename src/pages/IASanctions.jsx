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
import { fetchPlantillaAgents } from '../services/plantillaService';
import IASanctionModalWithPlantillaPicker from '../components/plantilla/IASanctionModalWithPlantillaPicker';
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
    const [currentUser, setCurrentUser] = useState(null);

    // Modal & CRUD State
    const [showModal, setShowModal] = useState(false);
    const [showDirectSanctionModal, setShowDirectSanctionModal] = useState(false);
    const [plantillaAgents, setPlantillaAgents] = useState([]);
    const [selectedPlantillaAgent, setSelectedPlantillaAgent] = useState(null);
    const [agentPickerSearch, setAgentPickerSearch] = useState('');
    const [isAgentPickerOpen, setIsAgentPickerOpen] = useState(false);
    const [formData, setFormData] = useState({ nombre: '', apellido: '', no_placa: '', plantilla_agent_id: null });
    const [loadingAction, setLoadingAction] = useState(false);
    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        loadData();
        fetchUserProfile();
    }, []);

    const fetchUserProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                if (data) setCurrentUser(data);
            }
        } catch (e) {
            console.error('Error fetching user profile:', e);
        }
    };

    const userRole = (currentUser?.rol || '').trim().toLowerCase();
    const isAdmin = userRole === 'administrador' || userRole === 'superadmin';
    const isComisionado = userRole === 'comisionado';
    const userDivisions = Array.isArray(currentUser?.divisions) ? currentUser.divisions : [];
    const userSubdivisions = Array.isArray(currentUser?.subdivisions) ? currentUser.subdivisions : [];
    const hasIADivision = userDivisions.includes('Internal Affairs') || userSubdivisions.includes('Internal Affairs');
    const hasIAAccess = isAdmin || isComisionado || hasIADivision;

    const loadData = async () => {
        setLoading(true);
        try {
            // Load custom durations from app_settings
            const loadedDurations = await fetchSanctionDurations();
            setDurations(loadedDurations);

            // Try loading full profiles with sanctions
            try {
                const pAgents = await fetchPlantillaAgents();
                setPlantillaAgents(pAgents || []);
            } catch (pE) {
                console.warn('Error fetching plantilla agents for IA:', pE);
            }

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
                        plantilla_agent_id,
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

            // Asegurar que cada perfil cargue su plantilla_agent_id directamente desde la tabla
            try {
                const { data: metaRows } = await supabase
                    .from('ia_subject_profiles')
                    .select('id, plantilla_agent_id, no_placa, nombre, apellido');

                const metaMap = {};
                (metaRows || []).forEach(m => { metaMap[m.id] = m; });

                const agentsList = plantillaAgents.length > 0 ? plantillaAgents : (await fetchPlantillaAgents()) || [];

                loadedProfiles = loadedProfiles.map(p => {
                    const meta = metaMap[p.id] || {};
                    let agentId = meta.plantilla_agent_id || p.plantilla_agent_id || null;

                    // Si no está vinculado aún por ID, buscar coincidencia en la plantilla para auto-vincular
                    if (!agentId && agentsList.length > 0) {
                        const pFullName = `${p.nombre || ''} ${p.apellido || ''}`.trim().toLowerCase();
                        const matched = agentsList.find(a => {
                            if (a.is_divider) return false;
                            const aFullName = `${a.nombre || ''} ${a.apellido || ''}`.trim().toLowerCase();
                            if (pFullName && aFullName && pFullName === aFullName) return true;
                            if (p.no_placa && a.no_placa && p.no_placa.trim() === a.no_placa.trim() && p.no_placa.trim() !== 'S/P') return true;
                            return false;
                        });

                        if (matched) {
                            agentId = matched.id;
                            // Persistir la vinculación en la base de datos de manera asíncrona
                            supabase.from('ia_subject_profiles')
                                .update({ plantilla_agent_id: matched.id })
                                .eq('id', p.id)
                                .then(() => {});
                        }
                    }

                    return {
                        ...p,
                        plantilla_agent_id: agentId
                    };
                });
            } catch (metaErr) {
                console.warn('Could not enrich profile metadata:', metaErr);
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
        setSelectedPlantillaAgent(null);
        setFormData({ nombre: '', apellido: '', no_placa: '', plantilla_agent_id: null });
        setShowModal(true);
    };

    const openForEdit = (e, profile) => {
        e.stopPropagation();
        setEditingId(profile.id);
        setFormData({
            nombre: profile.nombre,
            apellido: profile.apellido,
            no_placa: profile.no_placa,
            plantilla_agent_id: profile.plantilla_agent_id || null
        });
        const linked = plantillaAgents.find(a => a.id === profile.plantilla_agent_id);
        setSelectedPlantillaAgent(linked || null);
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setLoadingAction(true);
        try {
            const saveName = selectedPlantillaAgent ? (selectedPlantillaAgent.nombre || formData.nombre.trim()) : formData.nombre.trim();
            const saveApellido = selectedPlantillaAgent ? (selectedPlantillaAgent.apellido || formData.apellido.trim()) : formData.apellido.trim();
            const saveNoPlaca = selectedPlantillaAgent ? (selectedPlantillaAgent.no_placa || 'S/P') : (formData.no_placa.trim() || 'S/P');
            const saveAgentId = selectedPlantillaAgent?.id || formData.plantilla_agent_id || null;

            if (editingId) {
                let updated = false;
                try {
                    const { error: directErr } = await supabase
                        .from('ia_subject_profiles')
                        .update({
                            nombre: saveName,
                            apellido: saveApellido,
                            no_placa: saveNoPlaca,
                            plantilla_agent_id: saveAgentId
                        })
                        .eq('id', editingId);
                    if (!directErr) updated = true;
                } catch (e) {
                    console.warn('Direct update fallback:', e);
                }
                if (!updated) {
                    const { error } = await supabase.rpc('update_ia_subject_profile', {
                        p_id: editingId,
                        p_nombre: saveName,
                        p_apellido: saveApellido,
                        p_no_placa: saveNoPlaca
                    });
                    if (error) throw error;
                    if (saveAgentId) {
                        await supabase
                            .from('ia_subject_profiles')
                            .update({ plantilla_agent_id: saveAgentId })
                            .eq('id', editingId);
                    }
                }
            } else {
                let inserted = false;
                try {
                    const { error: directErr } = await supabase
                        .from('ia_subject_profiles')
                        .insert([{
                            nombre: saveName,
                            apellido: saveApellido,
                            no_placa: saveNoPlaca,
                            plantilla_agent_id: saveAgentId
                        }]);
                    if (!directErr) inserted = true;
                } catch (e) {
                    console.warn('Direct insert fallback:', e);
                }
                if (!inserted) {
                    const { data: rpcId, error } = await supabase.rpc('create_ia_subject_profile', {
                        p_nombre: saveName,
                        p_apellido: saveApellido,
                        p_no_placa: saveNoPlaca
                    });
                    if (error) throw error;
                    if (saveAgentId && rpcId) {
                        await supabase
                            .from('ia_subject_profiles')
                            .update({ plantilla_agent_id: saveAgentId })
                            .eq('id', rpcId);
                    }
                }
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
            const linked = plantillaAgents.find(a =>
                (p.plantilla_agent_id && a.id === p.plantilla_agent_id) ||
                (!p.plantilla_agent_id && p.no_placa && a.no_placa && a.no_placa.trim() === p.no_placa.trim())
            );

            const fullName = `${p.nombre} ${p.apellido}`.toLowerCase();
            const liveName = linked ? `${linked.nombre || ''} ${linked.apellido || ''}`.toLowerCase() : fullName;
            const badge = (p.no_placa || '').toLowerCase();
            const liveBadge = (linked?.no_placa || '').toLowerCase();
            const rank = (linked?.rank_name || '').toLowerCase();

            const query = searchTerm.toLowerCase();
            const matchesQuery = fullName.includes(query) || liveName.includes(query) || badge.includes(query) || liveBadge.includes(query) || rank.includes(query);

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
                        src={hasIAAccess ? (isLSSD ? "/logowebp/IALSSD.webp" : "/logowebp/ialogo.webp") : (isLSSD ? "/logowebp/lssdlogo.webp" : "/logowebp/dblogo.webp")}
                        alt={hasIAAccess ? "IA Division Logo" : "Comandancia Logo"}
                        style={{
                            height: '70px',
                            width: 'auto',
                            filter: `drop-shadow(0 4px 16px ${hasIAAccess ? (isLSSD ? 'rgba(74, 222, 128, 0.4)' : 'rgba(239, 68, 68, 0.45)') : 'rgba(234, 179, 8, 0.4)'})`
                        }}
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => navigate(hasIAAccess ? '/internal-affairs' : '/comandancia')}
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
                                <span>{hasIAAccess ? (language === 'es' ? 'Volver al Panel IA' : 'Back to IA Dashboard') : (language === 'es' ? 'Volver a Comandancia' : 'Back to Command')}</span>
                            </button>
                            <span className="mac-status-dot" style={{ backgroundColor: hasIAAccess ? '#ef4444' : '#eab308', boxShadow: `0 0 10px ${hasIAAccess ? '#ef4444' : '#eab308'}` }}></span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: hasIAAccess ? '#f87171' : '#fde047', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {hasIAAccess 
                                    ? (language === 'es' ? 'División de Asuntos Internos' : 'Internal Affairs Division')
                                    : (language === 'es' ? 'Comandancia • Supervisión de Sargentos' : 'Command • Sergeants Supervision')}
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.15rem 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {hasIAAccess 
                                ? (language === 'es' ? 'REGISTRO DE SANCIONES' : 'DISCIPLINARY SANCTIONS REGISTRY')
                                : (language === 'es' ? 'REGISTRO DE SANCIONES Y FALTAS DE SARGENTOS' : 'DISCIPLINARY SANCTIONS & SERGEANTS REGISTRY')}
                        </h1>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.82rem' }}>
                            {hasIAAccess
                                ? (language === 'es' ? 'Control de personal con faltas activas y expedientes disciplinarios.' : 'Control of officers with active sanctions and disciplinary records.')
                                : (language === 'es' ? 'Consulta de estado de vigencias de agentes y expedición de faltas leves de sargentos.' : 'Officer active sanction status inquiry and issuance of minor sergeant faults.')}
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

                    {/* Direct Register Sanction Button with Plantilla Autocomplete */}
                    <button
                        type="button"
                        className="mac-btn"
                        onClick={() => setShowDirectSanctionModal(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.55rem 1.1rem',
                            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                            border: 'none',
                            color: '#ffffff',
                            fontWeight: 800,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
                        }}
                        title="Registra una sanción seleccionando con autocompletado un agente de la plantilla o creando un perfil nuevo"
                    >
                        <span>⚖️</span>
                        <span>{language === 'es' ? 'Registrar Sanción' : 'Register Sanction'}</span>
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

                                        {/* Name & Badge (Dynamically synced with Plantilla) */}
                                        {(() => {
                                            const linked = plantillaAgents.find(a =>
                                                (profile.plantilla_agent_id && a.id === profile.plantilla_agent_id) ||
                                                (!profile.plantilla_agent_id && profile.no_placa && a.no_placa && a.no_placa.trim() === profile.no_placa.trim())
                                            );
                                            const currentBadge = linked?.no_placa || profile.no_placa || 'S/P';
                                            const currentName = linked ? `${linked.nombre || ''} ${linked.apellido || ''}`.trim() : `${profile.nombre} ${profile.apellido}`;

                                            return (
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
                                                        {currentName}
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '0.2rem', color: '#94a3b8', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-gold, #f59e0b)' }}>
                                                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                                        </svg>
                                                        <span>{language === 'es' ? 'Placa: ' : 'Badge: '}</span>
                                                        <span style={{ color: 'var(--accent-gold, #f59e0b)', fontWeight: 600 }}>#{currentBadge}</span>

                                                        {/* Plantilla link badge if linked */}
                                                        {linked && (
                                                            <span style={{
                                                                fontSize: '0.68rem',
                                                                fontWeight: 800,
                                                                background: 'rgba(59, 130, 246, 0.15)',
                                                                border: '1px solid rgba(59, 130, 246, 0.35)',
                                                                color: '#93c5fd',
                                                                padding: '1px 6px',
                                                                borderRadius: '4px',
                                                                marginLeft: '4px'
                                                            }} title={`Vinculado por ID a la plantilla (${linked.rank_name || 'Agente'}). La placa se actualiza sola si cambia en la plantilla.`}>
                                                                🔗 {linked.rank_name || 'Plantilla'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}
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
                                        {hasIAAccess && (
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
                                        )}
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
                                <div className="mac-window-dot close" onClick={() => setShowModal(false)} title={language === 'es' ? 'Cerrar' : 'Close'}></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                                <span>{editingId ? (language === 'es' ? 'Editar Perfil del Oficial' : 'Edit Officer Profile') : (language === 'es' ? 'Registrar Nuevo Oficial' : 'Register New Officer')}</span>
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="mac-modal-body" style={{ gap: '1rem' }}>
                                {/* Autocomplete picker from Plantilla */}
                                <div className="mac-form-group">
                                    <label className="mac-form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>{language === 'es' ? 'Seleccionar Agente de Plantilla' : 'Select from Roster'}</span>
                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{language === 'es' ? '(Opcional)' : '(Optional)'}</span>
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            className="mac-form-input"
                                            placeholder={language === 'es' ? 'Buscar agente en la plantilla...' : 'Search agent in roster...'}
                                            value={agentPickerSearch}
                                            onFocus={() => setIsAgentPickerOpen(true)}
                                            onChange={e => {
                                                setAgentPickerSearch(e.target.value);
                                                setIsAgentPickerOpen(true);
                                            }}
                                        />
                                        {isAgentPickerOpen && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '100%',
                                                left: 0,
                                                right: 0,
                                                marginTop: '4px',
                                                background: '#1e293b',
                                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                                borderRadius: '8px',
                                                maxHeight: '160px',
                                                overflowY: 'auto',
                                                zIndex: 100,
                                                padding: '4px',
                                                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                                            }}>
                                                {plantillaAgents
                                                    .filter(a => {
                                                        if (a.is_placeholder && !a.nombre) return false;
                                                        if (!agentPickerSearch.trim()) return true;
                                                        const t = agentPickerSearch.toLowerCase();
                                                        return `${a.nombre || ''} ${a.apellido || ''} ${a.no_placa || ''}`.toLowerCase().includes(t);
                                                    })
                                                    .slice(0, 8)
                                                    .map(ag => (
                                                        <div
                                                            key={ag.id}
                                                            onClick={() => {
                                                                setSelectedPlantillaAgent(ag);
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    nombre: ag.nombre || '',
                                                                    apellido: ag.apellido || '',
                                                                    no_placa: ag.no_placa || '',
                                                                    plantilla_agent_id: ag.id
                                                                }));
                                                                setAgentPickerSearch(`${ag.nombre || ''} ${ag.apellido || ''}`.trim());
                                                                setIsAgentPickerOpen(false);
                                                            }}
                                                            style={{
                                                                padding: '6px 8px',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.78rem',
                                                                color: '#f8fafc',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center'
                                                            }}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                        >
                                                            <span>{ag.nombre} {ag.apellido}</span>
                                                            <span style={{ color: '#60a5fa', fontSize: '0.7rem' }}>#{ag.no_placa} • {ag.rank_name}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>

                                    {selectedPlantillaAgent ? (
                                        <div style={{
                                            marginTop: '8px',
                                            background: 'rgba(16, 185, 129, 0.15)',
                                            border: '1px solid rgba(16, 185, 129, 0.4)',
                                            borderRadius: '8px',
                                            padding: '8px 12px',
                                            fontSize: '0.78rem',
                                            color: '#6ee7b7',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '8px'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 800 }}>
                                                    🔗 {language === 'es' ? 'Vinculado a Plantilla:' : 'Linked to Roster:'} #{selectedPlantillaAgent.no_placa || 'S/P'} · {selectedPlantillaAgent.nombre} {selectedPlantillaAgent.apellido} ({selectedPlantillaAgent.rank_name || 'Agente'})
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#a7f3d0', marginTop: '2px' }}>
                                                    {language === 'es' ? 'Ligado permanentemente por ID de agente. No requiere placa manual; si cambia en la plantilla se actualizará solo.' : 'Permanently linked by Agent ID. Placa changes in roster update automatically.'}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedPlantillaAgent(null);
                                                    setFormData(prev => ({ ...prev, plantilla_agent_id: null }));
                                                    setAgentPickerSearch('');
                                                }}
                                                style={{ background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800 }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ marginTop: '4px', fontSize: '0.7rem', color: '#94a3b8' }}>
                                            ℹ️ {language === 'es' ? 'Si no está en la plantilla, escribe abajo los datos y se creará sin vincular.' : 'If not in roster, fill below and an unlinked profile will be created.'}
                                        </div>
                                    )}
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">{language === 'es' ? 'Nombre' : 'First Name'} *</label>
                                    <input
                                        className="mac-form-input"
                                        required
                                        placeholder={language === 'es' ? 'Ej. John' : 'e.g. John'}
                                        value={formData.nombre}
                                        onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                        disabled={Boolean(selectedPlantillaAgent)}
                                        autoFocus
                                    />
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">{language === 'es' ? 'Apellido' : 'Last Name'} *</label>
                                    <input
                                        className="mac-form-input"
                                        required
                                        placeholder={language === 'es' ? 'Ej. Doe' : 'e.g. Doe'}
                                        value={formData.apellido}
                                        onChange={e => setFormData({ ...formData, apellido: e.target.value })}
                                        disabled={Boolean(selectedPlantillaAgent)}
                                    />
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">{language === 'es' ? 'Número de Placa (Opcional)' : 'Badge Number (Optional)'}</label>
                                    <input
                                        className="mac-form-input"
                                        placeholder={language === 'es' ? (selectedPlantillaAgent ? `Sincronizada: #${selectedPlantillaAgent.no_placa || 'S/P'}` : 'Ej. 742 (opcional)') : 'e.g. 742 (optional)'}
                                        value={selectedPlantillaAgent ? (selectedPlantillaAgent.no_placa || 'S/P') : formData.no_placa}
                                        onChange={e => setFormData({ ...formData, no_placa: e.target.value })}
                                        disabled={Boolean(selectedPlantillaAgent)}
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

            {/* Direct Sanction Modal with Plantilla Autocomplete */}
            {showDirectSanctionModal && (
                <IASanctionModalWithPlantillaPicker
                    plantillaAgents={plantillaAgents}
                    currentUser={currentUser}
                    onClose={() => setShowDirectSanctionModal(false)}
                    onSanctionCreated={() => {
                        loadData();
                    }}
                />
            )}
        </div>
    );
}

export default IASanctions;

