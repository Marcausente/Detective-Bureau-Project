import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { getProfileImage, compressImage, uploadImageToStorage } from '../utils/imageStorage';
import '../index.css';

// Default Custom Ranks
const DEFAULT_ASD_RANKS = [
    { id: 'rank-1', name: 'Comandante de ASD', level: 1, color: '#eab308', abbrev: 'COM-ASD' },
    { id: 'rank-2', name: 'Capitán de Escuadrón', level: 2, color: '#f97316', abbrev: 'CAP-ASD' },
    { id: 'rank-3', name: 'Piloto Táctico Instructor', level: 3, color: '#06b6d4', abbrev: 'PTI' },
    { id: 'rank-4', name: 'Piloto de Operaciones Especiales', level: 4, color: '#3b82f6', abbrev: 'POE' },
    { id: 'rank-5', name: 'Oficial de Vuelo Táctico (TFO)', level: 5, color: '#10b981', abbrev: 'TFO' },
    { id: 'rank-6', name: 'Piloto en Prácticas', level: 6, color: '#94a3b8', abbrev: 'PRAC' }
];

// Default ASD Licenses (Mandatory: Rápel, Artillero, Operaciones Anfibias)
const DEFAULT_ASD_LICENSES = [
    { id: 'lic-1', name: 'Rápel', code: 'ASD-RPL', color: '#3b82f6', icon: '🪢', description: 'Habilitación para inserción y descenso rápido Fast-Rope desde helicóptero' },
    { id: 'lic-2', name: 'Artillero', code: 'ASD-ART', color: '#ef4444', icon: '🎯', description: 'Tirador aéreo de precisión y fuego de cobertura desde aeronave' },
    { id: 'lic-3', name: 'Operaciones Anfibias', code: 'ASD-ANF', color: '#06b6d4', icon: '🌊', description: 'Rescate marítimo, amerizaje de emergencia y operaciones en costas' }
];

// Default Initial Members
const DEFAULT_ASD_MEMBERS = [
    {
        id: 'asd-user-1',
        nombre: 'Marcus',
        apellido: 'Miller',
        callsign: 'AIR-01',
        no_placa: '101',
        rank_id: 'rank-1',
        licenses: ['Rápel', 'Artillero', 'Operaciones Anfibias'],
        avatar: '',
        status: 'En Servicio',
        phone: '555-0199',
        joined_at: '2026-01-15'
    },
    {
        id: 'asd-user-2',
        nombre: 'Alex',
        apellido: 'Ross',
        callsign: 'AIR-02',
        no_placa: '108',
        rank_id: 'rank-2',
        licenses: ['Rápel', 'Artillero'],
        avatar: '',
        status: 'En Servicio',
        phone: '555-0182',
        joined_at: '2026-02-01'
    },
    {
        id: 'asd-user-3',
        nombre: 'Sarah',
        apellido: 'Vance',
        callsign: 'HAWK-1',
        no_placa: '115',
        rank_id: 'rank-3',
        licenses: ['Rápel', 'Operaciones Anfibias'],
        avatar: '',
        status: 'En Servicio',
        phone: '555-0143',
        joined_at: '2026-03-10'
    },
    {
        id: 'asd-user-4',
        nombre: 'David',
        apellido: 'Connor',
        callsign: 'EAGLE-3',
        no_placa: '124',
        rank_id: 'rank-4',
        licenses: ['Rápel', 'Artillero'],
        avatar: '',
        status: 'En Servicio',
        phone: '555-0177',
        joined_at: '2026-04-20'
    },
    {
        id: 'asd-user-5',
        nombre: 'James',
        apellido: 'Carter',
        callsign: 'AIR-03',
        no_placa: '132',
        rank_id: 'rank-5',
        licenses: ['Rápel'],
        avatar: '',
        status: 'En Servicio',
        phone: '555-0155',
        joined_at: '2026-05-12'
    },
    {
        id: 'asd-user-6',
        nombre: 'Lucas',
        apellido: 'Miller',
        callsign: 'SPARROW-1',
        no_placa: '140',
        rank_id: 'rank-6',
        licenses: [],
        avatar: '',
        status: 'En Prácticas',
        phone: '555-0130',
        joined_at: '2026-07-01'
    }
];

// Default Initial Infractions
const DEFAULT_ASD_INFRACTIONS = [
    {
        id: 'inf-1',
        member_id: 'asd-user-3',
        member_name: 'Sarah Vance',
        member_callsign: 'HAWK-1',
        level: 'Leve',
        reason: 'Retraso en entrega del informe de inspección prevuelo en hangar',
        sanction: 'Amonestación verbal y registro en expediente de vuelo',
        issued_by: 'Marcus Miller (COM-ASD)',
        date: '2026-08-14',
        status: 'Cumplida'
    },
    {
        id: 'inf-2',
        member_id: 'asd-user-5',
        member_name: 'James Carter',
        member_callsign: 'AIR-03',
        level: 'Media',
        reason: 'Uso del proyector NiteSun en zona urbana sin orden táctica de persecución activa',
        sanction: 'Suspensión temporal de vuelos nocturnos durante 48 horas',
        issued_by: 'Alex Ross (CAP-ASD)',
        date: '2026-09-02',
        status: 'Activa'
    }
];

// Default Aircraft Models (Maverick by default + custom models)
const DEFAULT_ASD_MODELS = [
    { id: 'model-1', name: 'Maverick', type: 'Helicóptero Ligero / Patrullaje', registration: 'POLMAV-01', description: 'Aeronave principal de patrullaje aéreo estándar con cámara táctica y foco NiteSun.', status: 'Operativo' },
    { id: 'model-2', name: 'SuperVolito Carbon', type: 'Helicóptero Táctico / VIP', registration: 'AIR-TAC-02', description: 'Aeronave de alta velocidad para transporte táctico de mandos e inserciones rápidas.', status: 'Operativo' },
    { id: 'model-3', name: 'Frogger', type: 'Helicóptero de Apoyo y Rescate', registration: 'RESCUE-03', description: 'Unidad de rescate y evacuación médica equipada con grúa y camilla aérea.', status: 'Operativo' }
];

// Default Flight Logs
const DEFAULT_ASD_FLIGHT_LOGS = [
    {
        id: 'flight-1',
        pilot_id: 'asd-user-1',
        pilot_name: 'Marcus Miller',
        pilot_callsign: 'AIR-01',
        aircraft_model: 'Maverick',
        reason: 'Patrullaje',
        reason_other: null,
        date: '2026-09-17',
        departure_time: '18:00',
        landing_time: '19:30',
        duration_minutes: 90,
        notes: 'Patrullaje preventivo sobre South Central y Vinewood Hills sin novedades críticas.',
        status: 'Aprobado',
        reviewed_by: 'Marcus Miller',
        created_at: '2026-09-17T18:00:00Z'
    },
    {
        id: 'flight-2',
        pilot_id: 'asd-user-3',
        pilot_name: 'Sarah Vance',
        pilot_callsign: 'HAWK-1',
        aircraft_model: 'Maverick',
        reason: '487',
        reason_other: null,
        date: '2026-09-18',
        departure_time: '02:15',
        landing_time: '03:00',
        duration_minutes: 45,
        notes: 'Persecución activa de un deportivo de alta gama por la autopista oeste. Sujeto neutralizado.',
        status: 'Pendiente',
        reviewed_by: null,
        created_at: '2026-09-18T02:15:00Z'
    }
];

function AirSupport() {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Active Navigation Tab: 'cuadrilla' | 'ranks' | 'licenses' | 'flight_logs' | 'aircraft_models' | 'infractions'
    const [activeTab, setActiveTab] = useState('cuadrilla');

    // Data Collections
    const [ranks, setRanks] = useState([]);
    const [members, setMembers] = useState([]);
    const [licenses, setLicenses] = useState([]);
    const [infractions, setInfractions] = useState([]);
    const [models, setModels] = useState([]);
    const [flightLogs, setFlightLogs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [flightStatusFilter, setFlightStatusFilter] = useState('Todos');
    const [copyFeedback, setCopyFeedback] = useState(false);

    // --- Modal States ---
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [avatarLoading, setAvatarLoading] = useState(false);
    const [savingMember, setSavingMember] = useState(false);
    const avatarInputRef = useRef(null);

    const [memberForm, setMemberForm] = useState({
        nombre: '',
        apellido: '',
        callsign: '',
        no_placa: '',
        rank_id: '',
        licenses: [],
        avatar: '',
        status: 'En Servicio',
        phone: ''
    });

    // Model Modal
    const [isModelModalOpen, setIsModelModalOpen] = useState(false);
    const [editingModel, setEditingModel] = useState(null);
    const [modelForm, setModelForm] = useState({
        name: '',
        type: 'Helicóptero Ligero / Patrullaje',
        registration: 'POLMAV-01',
        description: '',
        status: 'Operativo'
    });

    // Flight Log Manual Creation / Detail Modal
    const [isFlightLogModalOpen, setIsFlightLogModalOpen] = useState(false);
    const [flightLogForm, setFlightLogForm] = useState({
        pilot_id: '',
        aircraft_model: 'Maverick',
        reason: 'Patrullaje',
        reason_other: '',
        date: new Date().toISOString().split('T')[0],
        departure_time: '12:00',
        landing_time: '13:00',
        notes: '',
        status: 'Aprobado'
    });

    const [isRankModalOpen, setIsRankModalOpen] = useState(false);
    const [editingRank, setEditingRank] = useState(null);
    const [rankForm, setRankForm] = useState({
        name: '',
        level: 1,
        color: '#3b82f6',
        abbrev: ''
    });

    const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
    const [editingLicense, setEditingLicense] = useState(null);
    const [licenseForm, setLicenseForm] = useState({
        name: '',
        code: '',
        color: '#3b82f6',
        icon: '🪪',
        description: ''
    });

    const [isInfractionModalOpen, setIsInfractionModalOpen] = useState(false);
    const [infractionForm, setInfractionForm] = useState({
        member_id: '',
        level: 'Leve',
        reason: '',
        sanction: '',
        status: 'Activa',
        date: new Date().toISOString().split('T')[0]
    });

    const [selectedMemberForLicenses, setSelectedMemberForLicenses] = useState(null);

    useEffect(() => {
        loadUserProfile();
    }, []);

    useEffect(() => {
        if (profile && hasAccess()) {
            loadASDData();

            // Real-time synchronization for all users across browsers
            const channel = supabase
                .channel('asd_realtime_sync')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'asd_members' }, () => {
                    loadASDData();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'asd_ranks' }, () => {
                    loadASDData();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'asd_licenses' }, () => {
                    loadASDData();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'asd_infractions' }, () => {
                    loadASDData();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'asd_aircraft_models' }, () => {
                    loadASDData();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'asd_flight_logs' }, () => {
                    loadASDData();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [profile]);

    const loadUserProfile = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                navigate('/');
                return;
            }

            const { data } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();
            setProfile(data);
        } catch (err) {
            console.error('Error loading profile in AirSupport:', err);
        } finally {
            setLoading(false);
        }
    };

    const hasAccess = () => {
        if (!profile) return false;
        const role = profile.rol ? profile.rol.toLowerCase().trim() : '';
        const isASDRank = profile.rango === 'ASD Agent';
        const isASDDivision = profile.divisions && profile.divisions.includes('ASD');
        const allowedRoles = ['coordinador', 'comisionado', 'administrador', 'superadmin', 'admin'];

        return isASDRank || isASDDivision || allowedRoles.includes(role);
    };

    const loadASDData = async () => {
        // 1. Ranks from Supabase
        try {
            const { data: dbRanks, error: rankErr } = await supabase
                .from('asd_ranks')
                .select('*')
                .order('level', { ascending: true });

            if (!rankErr && dbRanks && dbRanks.length > 0) {
                setRanks(dbRanks);
                localStorage.setItem('asd_ranks_v2', JSON.stringify(dbRanks));
            } else if (!rankErr && dbRanks && dbRanks.length === 0) {
                for (const def of DEFAULT_ASD_RANKS) {
                    await supabase.from('asd_ranks').insert([def]);
                }
                const { data: seededRanks } = await supabase.from('asd_ranks').select('*').order('level', { ascending: true });
                setRanks(seededRanks || DEFAULT_ASD_RANKS);
            } else {
                const savedRanks = localStorage.getItem('asd_ranks_v2');
                setRanks(savedRanks ? JSON.parse(savedRanks) : DEFAULT_ASD_RANKS);
            }
        } catch (e) {
            console.warn('Ranks fetch fallback:', e);
            const savedRanks = localStorage.getItem('asd_ranks_v2');
            setRanks(savedRanks ? JSON.parse(savedRanks) : DEFAULT_ASD_RANKS);
        }

        // 2. Licenses from Supabase
        try {
            const { data: dbLic, error: licErr } = await supabase
                .from('asd_licenses')
                .select('*')
                .order('name', { ascending: true });

            if (!licErr && dbLic && dbLic.length > 0) {
                setLicenses(dbLic);
                localStorage.setItem('asd_licenses_v2', JSON.stringify(dbLic));
            } else if (!licErr && dbLic && dbLic.length === 0) {
                for (const def of DEFAULT_ASD_LICENSES) {
                    await supabase.from('asd_licenses').insert([def]);
                }
                const { data: seededLic } = await supabase.from('asd_licenses').select('*').order('name', { ascending: true });
                setLicenses(seededLic || DEFAULT_ASD_LICENSES);
            } else {
                const savedLic = localStorage.getItem('asd_licenses_v2');
                setLicenses(savedLic ? JSON.parse(savedLic) : DEFAULT_ASD_LICENSES);
            }
        } catch (e) {
            console.warn('Licenses fetch fallback:', e);
            const savedLic = localStorage.getItem('asd_licenses_v2');
            setLicenses(savedLic ? JSON.parse(savedLic) : DEFAULT_ASD_LICENSES);
        }

        // 3. Members from Supabase
        try {
            const { data: dbMembers, error: memErr } = await supabase
                .from('asd_members')
                .select('*')
                .order('created_at', { ascending: true });

            if (!memErr && dbMembers && dbMembers.length > 0) {
                const parsed = dbMembers.map(m => ({
                    ...m,
                    licenses: Array.isArray(m.licenses) ? m.licenses : (typeof m.licenses === 'string' ? JSON.parse(m.licenses) : [])
                }));
                setMembers(parsed);
                localStorage.setItem('asd_members_v2', JSON.stringify(parsed));
            } else if (!memErr && dbMembers && dbMembers.length === 0) {
                for (const def of DEFAULT_ASD_MEMBERS) {
                    await supabase.from('asd_members').insert([def]);
                }
                const { data: seededMem } = await supabase.from('asd_members').select('*').order('created_at', { ascending: true });
                if (seededMem && seededMem.length > 0) {
                    const parsed = seededMem.map(m => ({
                        ...m,
                        licenses: Array.isArray(m.licenses) ? m.licenses : (typeof m.licenses === 'string' ? JSON.parse(m.licenses) : [])
                    }));
                    setMembers(parsed);
                } else {
                    setMembers(DEFAULT_ASD_MEMBERS);
                }
            } else {
                const savedMembers = localStorage.getItem('asd_members_v2');
                setMembers(savedMembers ? JSON.parse(savedMembers) : DEFAULT_ASD_MEMBERS);
            }
        } catch (e) {
            console.warn('Members fetch fallback:', e);
            const savedMembers = localStorage.getItem('asd_members_v2');
            setMembers(savedMembers ? JSON.parse(savedMembers) : DEFAULT_ASD_MEMBERS);
        }

        // 4. Infractions from Supabase
        try {
            const { data: dbInfs, error: infErr } = await supabase
                .from('asd_infractions')
                .select('*')
                .order('created_at', { ascending: false });

            if (!infErr && dbInfs && dbInfs.length > 0) {
                setInfractions(dbInfs);
                localStorage.setItem('asd_infractions_v2', JSON.stringify(dbInfs));
            } else if (!infErr && dbInfs && dbInfs.length === 0) {
                for (const def of DEFAULT_ASD_INFRACTIONS) {
                    await supabase.from('asd_infractions').insert([def]);
                }
                const { data: seededInf } = await supabase.from('asd_infractions').select('*').order('created_at', { ascending: false });
                setInfractions(seededInf || DEFAULT_ASD_INFRACTIONS);
            } else {
                const savedInfs = localStorage.getItem('asd_infractions_v2');
                setInfractions(savedInfs ? JSON.parse(savedInfs) : DEFAULT_ASD_INFRACTIONS);
            }
        } catch (e) {
            console.warn('Infractions fetch fallback:', e);
            const savedInfs = localStorage.getItem('asd_infractions_v2');
            setInfractions(savedInfs ? JSON.parse(savedInfs) : DEFAULT_ASD_INFRACTIONS);
        }

        // 5. Aircraft Models from Supabase
        try {
            const { data: dbModels, error: modErr } = await supabase
                .from('asd_aircraft_models')
                .select('*')
                .order('name', { ascending: true });

            if (!modErr && dbModels && dbModels.length > 0) {
                setModels(dbModels);
                localStorage.setItem('asd_models_v2', JSON.stringify(dbModels));
            } else if (!modErr && dbModels && dbModels.length === 0) {
                for (const def of DEFAULT_ASD_MODELS) {
                    await supabase.from('asd_aircraft_models').insert([def]);
                }
                const { data: seededMod } = await supabase.from('asd_aircraft_models').select('*').order('name', { ascending: true });
                setModels(seededMod || DEFAULT_ASD_MODELS);
            } else {
                const savedM = localStorage.getItem('asd_models_v2');
                setModels(savedM ? JSON.parse(savedM) : DEFAULT_ASD_MODELS);
            }
        } catch (e) {
            console.warn('Aircraft models fetch fallback:', e);
            const savedM = localStorage.getItem('asd_models_v2');
            setModels(savedM ? JSON.parse(savedM) : DEFAULT_ASD_MODELS);
        }

        // 6. Flight Logs from Supabase
        try {
            const { data: dbLogs, error: logErr } = await supabase
                .from('asd_flight_logs')
                .select('*')
                .order('created_at', { ascending: false });

            if (!logErr && dbLogs && dbLogs.length > 0) {
                setFlightLogs(dbLogs);
                localStorage.setItem('asd_flight_logs_v2', JSON.stringify(dbLogs));
            } else if (!logErr && dbLogs && dbLogs.length === 0) {
                for (const def of DEFAULT_ASD_FLIGHT_LOGS) {
                    await supabase.from('asd_flight_logs').insert([def]);
                }
                const { data: seededLogs } = await supabase.from('asd_flight_logs').select('*').order('created_at', { ascending: false });
                setFlightLogs(seededLogs || DEFAULT_ASD_FLIGHT_LOGS);
            } else {
                const savedLogs = localStorage.getItem('asd_flight_logs_v2');
                setFlightLogs(savedLogs ? JSON.parse(savedLogs) : DEFAULT_ASD_FLIGHT_LOGS);
            }
        } catch (e) {
            console.warn('Flight logs fetch fallback:', e);
            const savedLogs = localStorage.getItem('asd_flight_logs_v2');
            setFlightLogs(savedLogs ? JSON.parse(savedLogs) : DEFAULT_ASD_FLIGHT_LOGS);
        }
    };

    // --- Member Actions (Supabase + Local) ---
    const handleOpenCreateMember = () => {
        setEditingMember(null);
        setAvatarFile(null);
        setAvatarPreview(null);
        setMemberForm({
            nombre: '',
            apellido: '',
            callsign: '',
            no_placa: '',
            rank_id: ranks[0]?.id || '',
            licenses: [],
            avatar: '',
            status: 'En Servicio',
            phone: ''
        });
        setIsMemberModalOpen(true);
    };

    const handleOpenEditMember = (m) => {
        setEditingMember(m);
        setAvatarFile(null);
        setAvatarPreview(m.avatar || null);
        setMemberForm({
            nombre: m.nombre,
            apellido: m.apellido,
            callsign: m.callsign,
            no_placa: m.no_placa || '',
            rank_id: m.rank_id,
            licenses: m.licenses || [],
            avatar: m.avatar || '',
            status: m.status || 'En Servicio',
            phone: m.phone || ''
        });
        setIsMemberModalOpen(true);
    };

    const handleAvatarFileSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setAvatarLoading(true);
            // Compress aggressively on the client: max 220px, 0.60 quality (~15-25 KB)
            const compressedBlob = await compressImage(file, 220, 0.60);
            setAvatarFile(compressedBlob);
            const previewUrl = URL.createObjectURL(compressedBlob);
            setAvatarPreview(previewUrl);
        } catch (err) {
            console.error('Error compressing avatar image:', err);
        } finally {
            setAvatarLoading(false);
            e.target.value = '';
        }
    };

    const handleRemoveAvatar = () => {
        setAvatarFile(null);
        setAvatarPreview(null);
        setMemberForm(prev => ({ ...prev, avatar: '' }));
    };

    const handleSaveMember = async (e) => {
        e.preventDefault();
        if (!memberForm.nombre || !memberForm.apellido || !memberForm.callsign) return;

        setSavingMember(true);
        try {
            let finalAvatarUrl = memberForm.avatar;

            // If a new compressed image is staged, upload to Supabase Storage ('uploads/avatars')
            // This applies Cache-Control: '31536000' (1 year) to eliminate repeat Egress costs.
            if (avatarFile) {
                try {
                    finalAvatarUrl = await uploadImageToStorage(avatarFile, 'avatars');
                } catch (uploadErr) {
                    console.error('Error uploading pilot avatar to storage:', uploadErr);
                }
            } else if (finalAvatarUrl && finalAvatarUrl.startsWith('data:')) {
                try {
                    finalAvatarUrl = await uploadImageToStorage(finalAvatarUrl, 'avatars');
                } catch (uploadErr) {
                    console.error('Error uploading base64 avatar to storage:', uploadErr);
                }
            }

            const memberPayload = {
                ...memberForm,
                avatar: finalAvatarUrl || ''
            };

            let updated;
            if (editingMember) {
                updated = members.map(m => m.id === editingMember.id ? { ...m, ...memberPayload } : m);
                setMembers(updated);
                localStorage.setItem('asd_members_v2', JSON.stringify(updated));

                try {
                    await supabase.from('asd_members').update(memberPayload).eq('id', editingMember.id);
                } catch (err) {
                    console.warn('Supabase member update error:', err);
                }
            } else {
                const newMem = {
                    id: 'asd-user-' + Date.now(),
                    ...memberPayload,
                    joined_at: new Date().toISOString().split('T')[0]
                };
                updated = [...members, newMem];
                setMembers(updated);
                localStorage.setItem('asd_members_v2', JSON.stringify(updated));

                try {
                    await supabase.from('asd_members').insert([newMem]);
                } catch (err) {
                    console.warn('Supabase member insert error:', err);
                }
            }

            setIsMemberModalOpen(false);
        } finally {
            setSavingMember(false);
            setAvatarFile(null);
            setAvatarPreview(null);
        }
    };

    const handleDeleteMember = async (id) => {
        if (!window.confirm(language === 'es' ? '¿Eliminar a este integrante de la cuadrilla de ASD?' : 'Delete this member from the ASD roster?')) return;
        const updated = members.filter(m => m.id !== id);
        setMembers(updated);
        localStorage.setItem('asd_members_v2', JSON.stringify(updated));

        try {
            await supabase.from('asd_members').delete().eq('id', id);
        } catch (err) {
            console.warn('Supabase member delete error:', err);
        }
    };

    // --- Rank Actions (Supabase + Local) ---
    const handleSaveRank = async (e) => {
        e.preventDefault();
        if (!rankForm.name) return;

        let updated;
        if (editingRank) {
            const payload = { ...rankForm, level: Number(rankForm.level) };
            updated = ranks.map(r => r.id === editingRank.id ? { ...r, ...payload } : r);
            updated.sort((a, b) => a.level - b.level);
            setRanks(updated);
            localStorage.setItem('asd_ranks_v2', JSON.stringify(updated));

            try {
                await supabase.from('asd_ranks').update(payload).eq('id', editingRank.id);
            } catch (err) {
                console.warn('Supabase rank update error:', err);
            }
        } else {
            const newRank = {
                id: 'rank-' + Date.now(),
                ...rankForm,
                level: Number(rankForm.level) || (ranks.length + 1)
            };
            updated = [...ranks, newRank];
            updated.sort((a, b) => a.level - b.level);
            setRanks(updated);
            localStorage.setItem('asd_ranks_v2', JSON.stringify(updated));

            try {
                await supabase.from('asd_ranks').insert([newRank]);
            } catch (err) {
                console.warn('Supabase rank insert error:', err);
            }
        }

        setIsRankModalOpen(false);
        setEditingRank(null);
    };

    const handleDeleteRank = async (id) => {
        if (ranks.length <= 1) {
            alert(language === 'es' ? 'Debe haber al menos un rango en la división.' : 'There must be at least one rank.');
            return;
        }
        if (!window.confirm(language === 'es' ? '¿Eliminar este rango de la división? Los agentes asignados deberán reasignarse.' : 'Delete this rank?')) return;
        const updated = ranks.filter(r => r.id !== id);
        setRanks(updated);
        localStorage.setItem('asd_ranks_v2', JSON.stringify(updated));

        try {
            await supabase.from('asd_ranks').delete().eq('id', id);
        } catch (err) {
            console.warn('Supabase rank delete error:', err);
        }
    };

    const handleMoveRank = async (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= ranks.length) return;

        const newRanks = [...ranks];
        const temp = newRanks[index];
        newRanks[index] = newRanks[targetIndex];
        newRanks[targetIndex] = temp;

        const reordered = newRanks.map((r, i) => ({ ...r, level: i + 1 }));
        setRanks(reordered);
        localStorage.setItem('asd_ranks_v2', JSON.stringify(reordered));

        try {
            for (const r of reordered) {
                await supabase.from('asd_ranks').update({ level: r.level }).eq('id', r.id);
            }
        } catch (err) {
            console.warn('Supabase rank reorder error:', err);
        }
    };

    // --- License Actions (Supabase + Local) ---
    const handleSaveLicense = async (e) => {
        e.preventDefault();
        if (!licenseForm.name) return;

        let updated;
        if (editingLicense) {
            const payload = { ...licenseForm };
            updated = licenses.map(l => l.id === editingLicense.id ? { ...l, ...payload } : l);
            setLicenses(updated);
            localStorage.setItem('asd_licenses_v2', JSON.stringify(updated));

            try {
                await supabase.from('asd_licenses').update(payload).eq('id', editingLicense.id);
            } catch (err) {
                console.warn('Supabase license update error:', err);
            }
        } else {
            const newLic = {
                id: 'lic-' + Date.now(),
                ...licenseForm,
                code: licenseForm.code || 'ASD-' + licenseForm.name.substring(0, 3).toUpperCase()
            };
            updated = [...licenses, newLic];
            setLicenses(updated);
            localStorage.setItem('asd_licenses_v2', JSON.stringify(updated));

            try {
                await supabase.from('asd_licenses').insert([newLic]);
            } catch (err) {
                console.warn('Supabase license insert error:', err);
            }
        }

        setIsLicenseModalOpen(false);
        setEditingLicense(null);
    };

    const handleDeleteLicense = async (id, name) => {
        if (!window.confirm(language === 'es' ? `¿Eliminar la licencia "${name}"?` : `Delete license "${name}"?`)) return;
        const updated = licenses.filter(l => l.id !== id);
        setLicenses(updated);
        localStorage.setItem('asd_licenses_v2', JSON.stringify(updated));

        try {
            await supabase.from('asd_licenses').delete().eq('id', id);
        } catch (err) {
            console.warn('Supabase license delete error:', err);
        }

        const updatedMembers = members.map(m => ({
            ...m,
            licenses: (m.licenses || []).filter(lName => lName !== name)
        }));
        setMembers(updatedMembers);
        localStorage.setItem('asd_members_v2', JSON.stringify(updatedMembers));
    };

    const handleToggleMemberLicense = async (memberId, licenseName) => {
        let nextLic = [];
        const updated = members.map(m => {
            if (m.id === memberId) {
                const currentLic = m.licenses || [];
                const hasLic = currentLic.includes(licenseName);
                nextLic = hasLic ? currentLic.filter(l => l !== licenseName) : [...currentLic, licenseName];
                return { ...m, licenses: nextLic };
            }
            return m;
        });
        setMembers(updated);
        localStorage.setItem('asd_members_v2', JSON.stringify(updated));

        if (selectedMemberForLicenses && selectedMemberForLicenses.id === memberId) {
            const updatedSelected = updated.find(m => m.id === memberId);
            setSelectedMemberForLicenses(updatedSelected);
        }

        try {
            await supabase.from('asd_members').update({ licenses: nextLic }).eq('id', memberId);
        } catch (err) {
            console.warn('Supabase member license update error:', err);
        }
    };

    // --- Infraction Actions (Supabase + Local) ---
    const handleOpenCreateInfraction = (member = null) => {
        setInfractionForm({
            member_id: member ? member.id : (members[0]?.id || ''),
            level: 'Leve',
            reason: '',
            sanction: '',
            status: 'Activa',
            date: new Date().toISOString().split('T')[0]
        });
        setIsInfractionModalOpen(true);
    };

    const handleSaveInfraction = async (e) => {
        e.preventDefault();
        if (!infractionForm.member_id || !infractionForm.reason) return;

        const targetMember = members.find(m => m.id === infractionForm.member_id);
        const newInf = {
            id: 'inf-' + Date.now(),
            ...infractionForm,
            member_name: targetMember ? `${targetMember.nombre} ${targetMember.apellido}` : 'Desconocido',
            member_callsign: targetMember?.callsign || 'N/A',
            issued_by: profile ? `${profile.nombre} ${profile.apellido} (${profile.rango})` : 'Mando ASD'
        };

        const updated = [newInf, ...infractions];
        setInfractions(updated);
        localStorage.setItem('asd_infractions_v2', JSON.stringify(updated));

        try {
            await supabase.from('asd_infractions').insert([newInf]);
        } catch (err) {
            console.warn('Supabase infraction insert error:', err);
        }

        setIsInfractionModalOpen(false);
    };

    const handleDeleteInfraction = async (id) => {
        if (!window.confirm(language === 'es' ? '¿Eliminar este registro de infracción?' : 'Delete this infraction?')) return;
        const updated = infractions.filter(i => i.id !== id);
        setInfractions(updated);
        localStorage.setItem('asd_infractions_v2', JSON.stringify(updated));

        try {
            await supabase.from('asd_infractions').delete().eq('id', id);
        } catch (err) {
            console.warn('Supabase infraction delete error:', err);
        }
    };

    const handleToggleInfractionStatus = async (id) => {
        let nextStatus = 'Activa';
        const updated = infractions.map(i => {
            if (i.id === id) {
                nextStatus = i.status === 'Activa' ? 'Cumplida' : 'Activa';
                return { ...i, status: nextStatus };
            }
            return i;
        });
        setInfractions(updated);
        localStorage.setItem('asd_infractions_v2', JSON.stringify(updated));

        try {
            await supabase.from('asd_infractions').update({ status: nextStatus }).eq('id', id);
        } catch (err) {
            console.warn('Supabase infraction status update error:', err);
        }
    };

    // --- Aircraft Models Actions (Supabase + Local) ---
    const handleSaveModel = async (e) => {
        e.preventDefault();
        if (!modelForm.name) return;

        let updated;
        if (editingModel) {
            const payload = { ...modelForm };
            updated = models.map(m => m.id === editingModel.id ? { ...m, ...payload } : m);
            setModels(updated);
            localStorage.setItem('asd_models_v2', JSON.stringify(updated));

            try {
                await supabase.from('asd_aircraft_models').update(payload).eq('id', editingModel.id);
            } catch (err) {
                console.warn('Supabase model update error:', err);
            }
        } else {
            const newMod = {
                id: 'model-' + Date.now(),
                ...modelForm
            };
            updated = [...models, newMod];
            setModels(updated);
            localStorage.setItem('asd_models_v2', JSON.stringify(updated));

            try {
                await supabase.from('asd_aircraft_models').insert([newMod]);
            } catch (err) {
                console.warn('Supabase model insert error:', err);
            }
        }

        setIsModelModalOpen(false);
        setEditingModel(null);
    };

    const handleDeleteModel = async (id, name) => {
        if (models.length <= 1) {
            alert(language === 'es' ? 'Debe haber al menos un modelo de aeronave registrado.' : 'There must be at least one aircraft model.');
            return;
        }
        if (!window.confirm(language === 'es' ? `¿Eliminar el modelo de aeronave "${name}"?` : `Delete aircraft model "${name}"?`)) return;
        const updated = models.filter(m => m.id !== id);
        setModels(updated);
        localStorage.setItem('asd_models_v2', JSON.stringify(updated));

        try {
            await supabase.from('asd_aircraft_models').delete().eq('id', id);
        } catch (err) {
            console.warn('Supabase model delete error:', err);
        }
    };

    // --- Flight Logs Actions (Supabase + Local) ---
    const handleApproveFlightLog = async (id) => {
        const reviewer = profile ? `${profile.nombre} ${profile.apellido}` : 'Mando ASD';
        const updated = flightLogs.map(fl => fl.id === id ? { ...fl, status: 'Aprobado', reviewed_by: reviewer } : fl);
        setFlightLogs(updated);
        localStorage.setItem('asd_flight_logs_v2', JSON.stringify(updated));

        try {
            await supabase.from('asd_flight_logs').update({ status: 'Aprobado', reviewed_by: reviewer }).eq('id', id);
        } catch (err) {
            console.warn('Supabase flight log approve error:', err);
        }
    };

    const handleRejectFlightLog = async (id) => {
        const reviewer = profile ? `${profile.nombre} ${profile.apellido}` : 'Mando ASD';
        const updated = flightLogs.map(fl => fl.id === id ? { ...fl, status: 'Rechazado', reviewed_by: reviewer } : fl);
        setFlightLogs(updated);
        localStorage.setItem('asd_flight_logs_v2', JSON.stringify(updated));

        try {
            await supabase.from('asd_flight_logs').update({ status: 'Rechazado', reviewed_by: reviewer }).eq('id', id);
        } catch (err) {
            console.warn('Supabase flight log reject error:', err);
        }
    };

    const handleDeleteFlightLog = async (id) => {
        if (!window.confirm(language === 'es' ? '¿Eliminar este registro de vuelo?' : 'Delete this flight log?')) return;
        const updated = flightLogs.filter(fl => fl.id !== id);
        setFlightLogs(updated);
        localStorage.setItem('asd_flight_logs_v2', JSON.stringify(updated));

        try {
            await supabase.from('asd_flight_logs').delete().eq('id', id);
        } catch (err) {
            console.warn('Supabase flight log delete error:', err);
        }
    };

    const handleCopyPublicLink = () => {
        const url = `${window.location.origin}/registro-vuelo`;
        navigator.clipboard.writeText(url);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 3000);
    };

    const handleSaveManualFlightLog = async (e) => {
        e.preventDefault();
        const targetPilot = members.find(m => m.id === flightLogForm.pilot_id) || members[0];
        if (!targetPilot) return;

        const [depH, depM] = flightLogForm.departure_time.split(':').map(Number);
        const [lanH, lanM] = flightLogForm.landing_time.split(':').map(Number);
        let depMinutes = depH * 60 + depM;
        let lanMinutes = lanH * 60 + lanM;
        if (lanMinutes < depMinutes) lanMinutes += 24 * 60;
        const dur = lanMinutes - depMinutes;

        const newLog = {
            id: 'flight-' + Date.now(),
            pilot_id: targetPilot.id,
            pilot_name: `${targetPilot.nombre} ${targetPilot.apellido}`,
            pilot_callsign: targetPilot.callsign,
            aircraft_model: flightLogForm.aircraft_model,
            reason: flightLogForm.reason,
            reason_other: flightLogForm.reason === 'Otro' ? flightLogForm.reason_other : null,
            date: flightLogForm.date,
            departure_time: flightLogForm.departure_time,
            landing_time: flightLogForm.landing_time,
            duration_minutes: dur,
            notes: flightLogForm.notes || null,
            status: flightLogForm.status || 'Aprobado',
            reviewed_by: profile ? `${profile.nombre} ${profile.apellido}` : 'Mando ASD',
            created_at: new Date().toISOString()
        };

        const updated = [newLog, ...flightLogs];
        setFlightLogs(updated);
        localStorage.setItem('asd_flight_logs_v2', JSON.stringify(updated));

        try {
            await supabase.from('asd_flight_logs').insert([newLog]);
        } catch (err) {
            console.warn('Supabase manual flight log insert error:', err);
        }

        setIsFlightLogModalOpen(false);
    };

    // Sorted & Filtered lists
    const sortedRanks = useMemo(() => {
        return [...ranks].sort((a, b) => a.level - b.level);
    }, [ranks]);

    const filteredMembers = useMemo(() => {
        if (!searchTerm.trim()) return members;
        const q = searchTerm.toLowerCase();
        return members.filter(m =>
            m.nombre.toLowerCase().includes(q) ||
            m.apellido.toLowerCase().includes(q) ||
            m.callsign.toLowerCase().includes(q) ||
            (m.no_placa && m.no_placa.toLowerCase().includes(q))
        );
    }, [members, searchTerm]);

    const filteredInfractions = useMemo(() => {
        if (!searchTerm.trim()) return infractions;
        const q = searchTerm.toLowerCase();
        return infractions.filter(i =>
            i.member_name.toLowerCase().includes(q) ||
            i.member_callsign.toLowerCase().includes(q) ||
            i.reason.toLowerCase().includes(q) ||
            i.level.toLowerCase().includes(q)
        );
    }, [infractions, searchTerm]);

    const filteredFlightLogs = useMemo(() => {
        return flightLogs.filter(fl => {
            const matchesStatus = flightStatusFilter === 'Todos' || fl.status === flightStatusFilter;
            if (!matchesStatus) return false;
            if (!searchTerm.trim()) return true;
            const q = searchTerm.toLowerCase();
            return (
                fl.pilot_name.toLowerCase().includes(q) ||
                fl.pilot_callsign.toLowerCase().includes(q) ||
                fl.aircraft_model.toLowerCase().includes(q) ||
                fl.reason.toLowerCase().includes(q) ||
                (fl.reason_other && fl.reason_other.toLowerCase().includes(q)) ||
                (fl.notes && fl.notes.toLowerCase().includes(q))
            );
        });
    }, [flightLogs, flightStatusFilter, searchTerm]);

    const filteredModels = useMemo(() => {
        if (!searchTerm.trim()) return models;
        const q = searchTerm.toLowerCase();
        return models.filter(m =>
            m.name.toLowerCase().includes(q) ||
            (m.type && m.type.toLowerCase().includes(q)) ||
            (m.registration && m.registration.toLowerCase().includes(q))
        );
    }, [models, searchTerm]);

    const totalFlightMinutes = useMemo(() => {
        return flightLogs.reduce((acc, curr) => acc + (Number(curr.duration_minutes) || 0), 0);
    }, [flightLogs]);

    const pendingLogsCount = useMemo(() => {
        return flightLogs.filter(fl => fl.status === 'Pendiente').length;
    }, [flightLogs]);

    if (loading) {
        return (
            <div className="flex-center" style={{ minHeight: '70vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (!hasAccess()) {
        return (
            <div className="documentation-container" style={{ padding: '3rem 2rem', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                <div style={{ background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '16px', padding: '3rem 2rem', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', border: '2px solid #ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2.5rem' }}>
                        🚁
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.75rem' }}>
                        Acceso Restringido • Air Support Division
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '1rem', maxWidth: '600px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
                        Este apartado está reservado exclusivamente para agentes asignados a la división ASD o personal de Coordinación / Administración.
                    </p>
                    <button onClick={() => navigate('/dashboard')} className="btn-primary" style={{ padding: '0.75rem 2rem', borderRadius: '10px' }}>
                        Volver al Panel Principal
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="documentation-container" style={{ padding: '1.5rem 2rem 4rem', maxWidth: '1440px', margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
            {/* Top ASD Header & Stats Bar */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.18) 0%, rgba(15, 23, 42, 0.92) 100%)',
                border: '1px solid rgba(2, 132, 199, 0.35)',
                borderRadius: '16px',
                padding: '1.75rem 2rem',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.5rem',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{
                        width: '66px',
                        height: '66px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2.2rem',
                        boxShadow: '0 8px 24px rgba(2, 132, 199, 0.45)',
                        border: '1px solid rgba(255, 255, 255, 0.25)'
                    }}>
                        🚁
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '0.5px' }}>
                                AIR SUPPORT DIVISION
                            </h1>
                            <span style={{
                                background: 'rgba(2, 132, 199, 0.3)',
                                color: '#38bdf8',
                                border: '1px solid rgba(2, 132, 199, 0.6)',
                                borderRadius: '6px',
                                padding: '0.2rem 0.65rem',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                textTransform: 'uppercase'
                            }}>
                                ASD • S.C.U.B. / SAPD
                            </span>
                        </div>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.92rem' }}>
                            Cuadrilla y Gestión Jerárquica de Vuelo, Habilitaciones e Infracciones de la División
                        </p>
                    </div>
                </div>

                {/* Quick Division Badges */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(2, 132, 199, 0.3)', borderRadius: '10px', padding: '0.5rem 1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Integrantes ASD</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8' }}>{members.length}</div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '0.5rem 1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Rangos Internos</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fbbf24' }}>{ranks.length}</div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '0.5rem 1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Habilitaciones</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#34d399' }}>{licenses.length}</div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '10px', padding: '0.5rem 1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Vuelos Registrados</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <span>{flightLogs.length}</span>
                            {pendingLogsCount > 0 && (
                                <span style={{ fontSize: '0.72rem', background: '#f59e0b', color: '#000', padding: '1px 6px', borderRadius: '10px', fontWeight: 800 }}>
                                    {pendingLogsCount} pend.
                                </span>
                            )}
                        </div>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '0.5rem 1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Infracciones</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f87171' }}>{infractions.filter(i => i.status === 'Activa').length} Activas</div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs Bar & Global Actions */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.75rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                paddingBottom: '1rem'
            }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('cuadrilla')}
                        style={{
                            background: activeTab === 'cuadrilla' ? 'rgba(2, 132, 199, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'cuadrilla' ? '#38bdf8' : '#94a3b8',
                            border: `1px solid ${activeTab === 'cuadrilla' ? 'rgba(2, 132, 199, 0.55)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '8px',
                            padding: '0.65rem 1.15rem',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>👥</span>
                        <span>Cuadrilla ASD</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('flight_logs')}
                        style={{
                            background: activeTab === 'flight_logs' ? 'rgba(2, 132, 199, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'flight_logs' ? '#38bdf8' : '#94a3b8',
                            border: `1px solid ${activeTab === 'flight_logs' ? 'rgba(2, 132, 199, 0.55)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '8px',
                            padding: '0.65rem 1.15rem',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>📋</span>
                        <span>Registros de Vuelo</span>
                        {pendingLogsCount > 0 ? (
                            <span style={{
                                background: '#f59e0b',
                                color: '#000',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                borderRadius: '10px',
                                padding: '1px 6px'
                            }}>
                                {pendingLogsCount}
                            </span>
                        ) : (
                            <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>({flightLogs.length})</span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('aircraft_models')}
                        style={{
                            background: activeTab === 'aircraft_models' ? 'rgba(2, 132, 199, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'aircraft_models' ? '#38bdf8' : '#94a3b8',
                            border: `1px solid ${activeTab === 'aircraft_models' ? 'rgba(2, 132, 199, 0.55)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '8px',
                            padding: '0.65rem 1.15rem',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>🚁</span>
                        <span>Modelos ({models.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('ranks')}
                        style={{
                            background: activeTab === 'ranks' ? 'rgba(2, 132, 199, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'ranks' ? '#38bdf8' : '#94a3b8',
                            border: `1px solid ${activeTab === 'ranks' ? 'rgba(2, 132, 199, 0.55)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '8px',
                            padding: '0.65rem 1.15rem',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>🎖️</span>
                        <span>Rangos</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('licenses')}
                        style={{
                            background: activeTab === 'licenses' ? 'rgba(2, 132, 199, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'licenses' ? '#38bdf8' : '#94a3b8',
                            border: `1px solid ${activeTab === 'licenses' ? 'rgba(2, 132, 199, 0.55)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '8px',
                            padding: '0.65rem 1.15rem',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>🪪</span>
                        <span>Licencias ({licenses.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('infractions')}
                        style={{
                            background: activeTab === 'infractions' ? 'rgba(2, 132, 199, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'infractions' ? '#38bdf8' : '#94a3b8',
                            border: `1px solid ${activeTab === 'infractions' ? 'rgba(2, 132, 199, 0.55)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '8px',
                            padding: '0.65rem 1.15rem',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>⚠️</span>
                        <span>Infracciones ({infractions.length})</span>
                    </button>
                </div>

                {/* Right Search & Action */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        placeholder="Buscar en ASD..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            background: 'rgba(15, 23, 42, 0.85)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            padding: '0.6rem 1rem',
                            fontSize: '0.85rem',
                            width: '200px'
                        }}
                    />

                    {activeTab === 'cuadrilla' && (
                        <button
                            type="button"
                            onClick={handleOpenCreateMember}
                            style={{
                                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0.65rem 1.25rem',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>+</span>
                            <span>Añadir a la Cuadrilla</span>
                        </button>
                    )}

                    {activeTab === 'flight_logs' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                type="button"
                                onClick={handleCopyPublicLink}
                                style={{
                                    background: copyFeedback ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.15)',
                                    border: `1px solid ${copyFeedback ? '#10b981' : 'rgba(56, 189, 248, 0.4)'}`,
                                    borderRadius: '8px',
                                    padding: '0.65rem 1rem',
                                    color: copyFeedback ? '#34d399' : '#38bdf8',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s'
                                }}
                                title="Copiar enlace del formulario público estilo iOS"
                            >
                                <span>{copyFeedback ? '✓' : '🔗'}</span>
                                <span>{copyFeedback ? 'Enlace Copiado!' : 'Copiar Enlace Público'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setFlightLogForm({
                                        pilot_id: members[0]?.id || '',
                                        aircraft_model: models[0]?.name || 'Maverick',
                                        reason: 'Patrullaje',
                                        reason_other: '',
                                        date: new Date().toISOString().split('T')[0],
                                        departure_time: '12:00',
                                        landing_time: '13:00',
                                        notes: '',
                                        status: 'Aprobado'
                                    });
                                    setIsFlightLogModalOpen(true);
                                }}
                                style={{
                                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.65rem 1.15rem',
                                    color: '#ffffff',
                                    fontWeight: 700,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span>+</span>
                                <span>Registrar Vuelo</span>
                            </button>
                        </div>
                    )}

                    {activeTab === 'aircraft_models' && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingModel(null);
                                setModelForm({
                                    name: '',
                                    type: 'Helicóptero Ligero / Patrullaje',
                                    registration: 'POLMAV-0' + (models.length + 1),
                                    description: '',
                                    status: 'Operativo'
                                });
                                setIsModelModalOpen(true);
                            }}
                            style={{
                                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0.65rem 1.25rem',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>+</span>
                            <span>Nuevo Modelo</span>
                        </button>
                    )}

                    {activeTab === 'ranks' && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingRank(null);
                                setRankForm({ name: '', level: ranks.length + 1, color: '#3b82f6', abbrev: '' });
                                setIsRankModalOpen(true);
                            }}
                            style={{
                                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0.65rem 1.25rem',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>+</span>
                            <span>Crear Nuevo Rango</span>
                        </button>
                    )}

                    {activeTab === 'licenses' && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingLicense(null);
                                setLicenseForm({ name: '', code: '', color: '#3b82f6', icon: '🪪', description: '' });
                                setIsLicenseModalOpen(true);
                            }}
                            style={{
                                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0.65rem 1.25rem',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>+</span>
                            <span>Crear Licencia</span>
                        </button>
                    )}

                    {activeTab === 'infractions' && (
                        <button
                            type="button"
                            onClick={() => handleOpenCreateInfraction(null)}
                            style={{
                                background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0.65rem 1.25rem',
                                color: '#ffffff',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>+</span>
                            <span>Registrar Infracción</span>
                        </button>
                    )}
                </div>
            </div>

            {/* TAB 1: CUADRILLA ASD (VERTICAL ORDER BY RANK HIERARCHY) */}
            {activeTab === 'cuadrilla' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {sortedRanks.map((rank) => {
                        const rankMembers = filteredMembers.filter(m => m.rank_id === rank.id);

                        return (
                            <div
                                key={rank.id}
                                style={{
                                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.45) 0%, rgba(15, 23, 42, 0.75) 100%)',
                                    border: `1px solid ${rank.color}40`,
                                    borderRadius: '16px',
                                    padding: '1.5rem',
                                    boxShadow: '0 8px 30px rgba(0,0,0,0.25)'
                                }}
                            >
                                {/* Rank Header */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '1.25rem',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                    paddingBottom: '0.75rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{
                                            background: `${rank.color}25`,
                                            color: rank.color,
                                            border: `1px solid ${rank.color}60`,
                                            borderRadius: '6px',
                                            padding: '0.2rem 0.6rem',
                                            fontSize: '0.78rem',
                                            fontWeight: 800
                                        }}>
                                            JERARQUÍA #{rank.level}
                                        </span>
                                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                                            {rank.name}
                                        </h2>
                                        {rank.abbrev && (
                                            <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
                                                ({rank.abbrev})
                                            </span>
                                        )}
                                    </div>
                                    <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
                                        {rankMembers.length} {rankMembers.length === 1 ? 'Integrante' : 'Integrantes'}
                                    </span>
                                </div>

                                {/* Rank Members Grid */}
                                {rankMembers.length === 0 ? (
                                    <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem', fontStyle: 'italic', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '10px' }}>
                                        No hay personal asignado a este rango actualmente.
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
                                        {rankMembers.map((m) => {
                                            const memberInfs = infractions.filter(i => i.member_id === m.id && i.status === 'Activa');

                                            return (
                                                <div
                                                    key={m.id}
                                                    style={{
                                                        background: 'rgba(15, 23, 42, 0.85)',
                                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                                        borderRadius: '12px',
                                                        padding: '1.15rem',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'space-between',
                                                        gap: '0.75rem',
                                                        transition: 'all 0.2s',
                                                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.borderColor = rank.color;
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                                        {/* Avatar */}
                                                        <div style={{
                                                            width: '58px',
                                                            height: '58px',
                                                            borderRadius: '50%',
                                                            overflow: 'hidden',
                                                            background: '#0b1120',
                                                            border: `2px solid ${rank.color}`,
                                                            flexShrink: 0,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '1.6rem',
                                                            boxShadow: `0 4px 14px ${rank.color}25`
                                                        }}>
                                                            {m.avatar ? (
                                                                <img
                                                                    src={getProfileImage(m.avatar, '/logowebp/anon.webp')}
                                                                    alt={`${m.nombre} ${m.apellido}`}
                                                                    loading="lazy"
                                                                    decoding="async"
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                    onError={(e) => {
                                                                        e.currentTarget.onerror = null;
                                                                        e.currentTarget.src = '/logowebp/anon.webp';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <span role="img" aria-label="pilot">👨‍✈️</span>
                                                            )}
                                                        </div>

                                                        {/* Details */}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                                                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {m.nombre} {m.apellido}
                                                                </h3>
                                                                <span style={{
                                                                    background: 'rgba(2, 132, 199, 0.25)',
                                                                    color: '#38bdf8',
                                                                    border: '1px solid rgba(2, 132, 199, 0.5)',
                                                                    borderRadius: '6px',
                                                                    padding: '0.15rem 0.5rem',
                                                                    fontSize: '0.78rem',
                                                                    fontWeight: 800
                                                                }}>
                                                                    {m.callsign}
                                                                </span>
                                                            </div>

                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '0.25rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                                                                {m.no_placa && <span>Placa: #{m.no_placa}</span>}
                                                                <span>•</span>
                                                                <span style={{ color: m.status === 'En Servicio' ? '#34d399' : '#fbbf24' }}>
                                                                    ● {m.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Licenses Chips */}
                                                    <div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                                                                Licencias de Vuelo ({m.licenses?.length || 0})
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedMemberForLicenses(m)}
                                                                style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                                            >
                                                                + Gestionar
                                                            </button>
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', minHeight: '26px' }}>
                                                            {m.licenses && m.licenses.length > 0 ? (
                                                                m.licenses.map((licName) => {
                                                                    const licObj = licenses.find(l => l.name === licName);
                                                                    const licColor = licObj?.color || '#3b82f6';
                                                                    return (
                                                                        <span
                                                                            key={licName}
                                                                            style={{
                                                                                background: `${licColor}20`,
                                                                                color: licColor,
                                                                                border: `1px solid ${licColor}50`,
                                                                                borderRadius: '5px',
                                                                                padding: '0.15rem 0.45rem',
                                                                                fontSize: '0.72rem',
                                                                                fontWeight: 700,
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '4px'
                                                                            }}
                                                                        >
                                                                            {licObj?.icon || '🪪'} {licName}
                                                                        </span>
                                                                    );
                                                                })
                                                            ) : (
                                                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>Sin licencias registradas</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Infractions summary badge & Action Buttons */}
                                                    <div style={{
                                                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                                        paddingTop: '0.65rem',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}>
                                                        <div>
                                                            {memberInfs.length > 0 ? (
                                                                <span style={{
                                                                    background: 'rgba(239, 68, 68, 0.2)',
                                                                    color: '#f87171',
                                                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                                                    borderRadius: '5px',
                                                                    padding: '0.2rem 0.5rem',
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: 800
                                                                }}>
                                                                    ⚠️ {memberInfs.length} Infracción(es)
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: '#10b981', fontSize: '0.72rem', fontWeight: 600 }}>
                                                                    ✓ Expediente limpio
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div style={{ display: 'flex', gap: '6px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenCreateInfraction(m)}
                                                                style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '6px', color: '#f87171', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                                                                title="Sancionar / Infracción"
                                                            >
                                                                + Sanción
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEditMember(m)}
                                                                style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: '6px', color: '#cbd5e1', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' }}
                                                                title="Editar Integrante"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteMember(m.id)}
                                                                style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '6px', color: '#ef4444', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' }}
                                                                title="Eliminar de ASD"
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
                        );
                    })}
                </div>
            )}

            {/* TAB 2: GESTIÓN DE RANGOS DE ASD */}
            {activeTab === 'ranks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.25rem', color: '#94a3b8', fontSize: '0.88rem' }}>
                        ℹ️ <strong>Jerarquía de la División:</strong> Los rangos se ordenan de mayor autoridad (Nivel 1 arriba) a menor autoridad. Puedes cambiar su orden, añadir nuevos rangos personalizados y editar sus colores y abreviaturas.
                    </div>

                    <div style={{
                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '14px',
                        overflow: 'hidden'
                    }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                            <thead>
                                <tr style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(255, 255, 255, 0.15)', color: '#94a3b8' }}>
                                    <th style={{ padding: '0.9rem 1.25rem' }}>NIVEL / ORDEN</th>
                                    <th style={{ padding: '0.9rem 1.25rem' }}>NOMBRE DEL RANGO</th>
                                    <th style={{ padding: '0.9rem 1.25rem' }}>ABREVIATURA</th>
                                    <th style={{ padding: '0.9rem 1.25rem' }}>COLOR DISTINTIVO</th>
                                    <th style={{ padding: '0.9rem 1.25rem' }}>INTEGRANTES</th>
                                    <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>ACCIONES & JERARQUÍA</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRanks.map((r, index) => {
                                    const count = members.filter(m => m.rank_id === r.id).length;

                                    return (
                                        <tr
                                            key={r.id}
                                            style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}
                                        >
                                            <td style={{ padding: '1rem 1.25rem' }}>
                                                <span style={{
                                                    background: 'rgba(2, 132, 199, 0.25)',
                                                    color: '#38bdf8',
                                                    border: '1px solid rgba(2, 132, 199, 0.5)',
                                                    borderRadius: '6px',
                                                    padding: '0.2rem 0.6rem',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 800
                                                }}>
                                                    #{r.level}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                                                {r.name}
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem', color: '#94a3b8', fontWeight: 600 }}>
                                                {r.abbrev || '-'}
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: r.color, display: 'inline-block' }}></span>
                                                    <span style={{ color: r.color, fontSize: '0.8rem', fontWeight: 700 }}>{r.color}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem', color: '#cbd5e1' }}>
                                                {count} {count === 1 ? 'persona' : 'personas'}
                                            </td>
                                            <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                                                <div style={{ display: 'inline-flex', gap: '6px' }}>
                                                    <button
                                                        type="button"
                                                        disabled={index === 0}
                                                        onClick={() => handleMoveRank(index, -1)}
                                                        style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: '6px', color: index === 0 ? '#475569' : '#38bdf8', padding: '0.35rem 0.6rem', cursor: index === 0 ? 'not-allowed' : 'pointer' }}
                                                        title="Subir Jerarquía"
                                                    >
                                                        ▲
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={index === sortedRanks.length - 1}
                                                        onClick={() => handleMoveRank(index, 1)}
                                                        style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: '6px', color: index === sortedRanks.length - 1 ? '#475569' : '#38bdf8', padding: '0.35rem 0.6rem', cursor: index === sortedRanks.length - 1 ? 'not-allowed' : 'pointer' }}
                                                        title="Bajar Jerarquía"
                                                    >
                                                        ▼
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingRank(r);
                                                            setRankForm(r);
                                                            setIsRankModalOpen(true);
                                                        }}
                                                        style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: '6px', color: '#cbd5e1', padding: '0.35rem 0.6rem', cursor: 'pointer' }}
                                                        title="Editar Rango"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteRank(r.id)}
                                                        style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '6px', color: '#f87171', padding: '0.35rem 0.6rem', cursor: 'pointer' }}
                                                        title="Eliminar Rango"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: LICENCIAS DE VUELO DE ASD */}
            {activeTab === 'licenses' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                        {licenses.map((lic) => {
                            const holders = members.filter(m => m.licenses && m.licenses.includes(lic.name));

                            return (
                                <div
                                    key={lic.id}
                                    style={{
                                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.75), rgba(15, 23, 42, 0.9))',
                                        border: `1px solid ${lic.color}40`,
                                        borderRadius: '14px',
                                        padding: '1.5rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        boxShadow: '0 8px 25px rgba(0,0,0,0.3)'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '42px',
                                                    height: '42px',
                                                    borderRadius: '10px',
                                                    background: `${lic.color}20`,
                                                    border: `1px solid ${lic.color}50`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.3rem'
                                                }}>
                                                    {lic.icon || '🪪'}
                                                </div>
                                                <div>
                                                    <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem', fontWeight: 800 }}>
                                                        {lic.name}
                                                    </h3>
                                                    <span style={{ fontSize: '0.75rem', color: lic.color, fontWeight: 700 }}>
                                                        {lic.code}
                                                    </span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setEditingLicense(lic);
                                                        setLicenseForm(lic);
                                                        setIsLicenseModalOpen(true);
                                                    }}
                                                    style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: '6px', color: '#cbd5e1', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteLicense(lic.id, lic.name)}
                                                    style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '6px', color: '#f87171', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>

                                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.4, margin: '0 0 1rem 0' }}>
                                            {lic.description || 'Habilitación oficial otorgada por la división de apoyo aéreo.'}
                                        </p>
                                    </div>

                                    <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.75rem' }}>
                                        <div style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.4rem' }}>
                                            Agentes Habilitados ({holders.length}):
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {holders.length > 0 ? (
                                                holders.map(h => (
                                                    <span key={h.id} style={{ background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', padding: '0.15rem 0.4rem', fontSize: '0.72rem', color: '#f1f5f9' }}>
                                                        {h.callsign} ({h.apellido})
                                                    </span>
                                                ))
                                            ) : (
                                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>Ningún agente con esta habilitación aún</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 4: INFRACCIONES DE LA DIVISIÓN (LEVES, MEDIAS, GRAVES) */}
            {activeTab === 'infractions' && (
                <div>
                    {filteredInfractions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3.5rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '14px', border: '1px dashed rgba(255, 255, 255, 0.15)', color: '#94a3b8' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛡️</div>
                            <h3 style={{ color: '#f8fafc', margin: '0 0 0.5rem 0' }}>Sin Infracciones Registradas</h3>
                            <p style={{ margin: 0 }}>No hay infracciones activas ni pendientes en el registro de la división.</p>
                        </div>
                    ) : (
                        <div style={{
                            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '14px',
                            overflow: 'hidden',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(255, 255, 255, 0.15)', color: '#94a3b8' }}>
                                        <th style={{ padding: '0.9rem 1.25rem' }}>NIVEL DE GRAVEDAD</th>
                                        <th style={{ padding: '0.9rem 1.25rem' }}>AGENTE SANCIONADO</th>
                                        <th style={{ padding: '0.9rem 1.25rem' }}>MOTIVO DE LA INFRACCIÓN</th>
                                        <th style={{ padding: '0.9rem 1.25rem' }}>SANCIÓN IMPUESTA</th>
                                        <th style={{ padding: '0.9rem 1.25rem' }}>OFICIAL SANCIONADOR</th>
                                        <th style={{ padding: '0.9rem 1.25rem' }}>ESTADO</th>
                                        <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>ACCIONES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInfractions.map((inf) => {
                                        const levelStyles = {
                                            'Leve': { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '#22c55e' },
                                            'Media': { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '#f59e0b' },
                                            'Grave': { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '#ef4444' }
                                        };
                                        const ls = levelStyles[inf.level] || levelStyles['Leve'];

                                        return (
                                            <tr key={inf.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <span style={{
                                                        background: ls.bg,
                                                        color: ls.color,
                                                        border: `1px solid ${ls.border}`,
                                                        borderRadius: '6px',
                                                        padding: '0.25rem 0.6rem',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 800
                                                    }}>
                                                        ● {inf.level}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>{inf.member_name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600 }}>{inf.member_callsign}</div>
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem', color: '#cbd5e1', maxWidth: '300px', lineHeight: 1.4 }}>
                                                    {inf.reason}
                                                    <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>Fecha: {inf.date}</div>
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem', color: '#fbbf24', fontWeight: 600 }}>
                                                    {inf.sanction}
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                                    {inf.issued_by}
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleInfractionStatus(inf.id)}
                                                        style={{
                                                            background: inf.status === 'Activa' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                                            color: inf.status === 'Activa' ? '#f87171' : '#34d399',
                                                            border: `1px solid ${inf.status === 'Activa' ? '#ef4444' : '#10b981'}`,
                                                            borderRadius: '6px',
                                                            padding: '0.25rem 0.6rem',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {inf.status === 'Activa' ? '● En Vigor' : '✓ Cumplida'}
                                                    </button>
                                                </td>
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteInfraction(inf.id)}
                                                        style={{ background: 'rgba(239, 68, 68, 0.15)', border: 'none', borderRadius: '6px', color: '#f87171', padding: '0.35rem 0.65rem', cursor: 'pointer', fontSize: '0.75rem' }}
                                                        title="Eliminar registro"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: REGISTROS DE VUELO (FLIGHT LOGS) */}
            {activeTab === 'flight_logs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Top Stats & Public Link Banner */}
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
                        border: '1px solid rgba(2, 132, 199, 0.35)',
                        borderRadius: '14px',
                        padding: '1.25rem 1.75rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: 'rgba(2, 132, 199, 0.2)',
                                border: '1px solid #0284c7',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.6rem'
                            }}>
                                ✈️
                            </div>
                            <div>
                                <h3 style={{ margin: '0 0 0.2rem 0', color: '#f8fafc', fontSize: '1.15rem', fontWeight: 800 }}>
                                    Bitácora de Vuelos ASD • Enlace Público
                                </h3>
                                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
                                    Los pilotos pueden enviar sus reportes de vuelo desde el enlace público estilo Apple iOS sin necesidad de iniciar sesión.
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Tiempo Total de Vuelo</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>
                                    {Math.floor(totalFlightMinutes / 60)}h {totalFlightMinutes % 60}m
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleCopyPublicLink}
                                style={{
                                    background: copyFeedback ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #0284c7, #0369a1)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.65rem 1.25rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)'
                                }}
                            >
                                <span>{copyFeedback ? '✓' : '🔗'}</span>
                                <span>{copyFeedback ? '¡Enlace Copiado al Portapapeles!' : 'Copiar URL Pública de Vuelo'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Filter Status Pills */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            {['Todos', 'Pendiente', 'Aprobado', 'Rechazado'].map(st => {
                                const isSel = flightStatusFilter === st;
                                const count = st === 'Todos' ? flightLogs.length : flightLogs.filter(f => f.status === st).length;
                                return (
                                    <button
                                        key={st}
                                        type="button"
                                        onClick={() => setFlightStatusFilter(st)}
                                        style={{
                                            background: isSel ? 'rgba(2, 132, 199, 0.35)' : 'transparent',
                                            color: isSel ? '#38bdf8' : '#94a3b8',
                                            border: `1px solid ${isSel ? 'rgba(2, 132, 199, 0.5)' : 'transparent'}`,
                                            borderRadius: '7px',
                                            padding: '0.45rem 0.95rem',
                                            fontSize: '0.82rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <span>{st}</span>
                                        <span style={{
                                            fontSize: '0.72rem',
                                            background: isSel ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                                            color: isSel ? '#38bdf8' : '#64748b',
                                            padding: '1px 6px',
                                            borderRadius: '8px',
                                            fontWeight: 800
                                        }}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                            Mostrando {filteredFlightLogs.length} registro(s) de vuelo
                        </span>
                    </div>

                    {/* Flight Logs Table / Cards */}
                    {filteredFlightLogs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '14px', border: '1px dashed rgba(255, 255, 255, 0.15)', color: '#94a3b8' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛫</div>
                            <h3 style={{ color: '#f8fafc', margin: '0 0 0.5rem 0' }}>No hay registros de vuelo</h3>
                            <p style={{ margin: '0 0 1.5rem 0', maxWidth: '480px', marginInline: 'auto', fontSize: '0.9rem' }}>
                                No se han encontrado registros con el filtro actual. Comparte el enlace público o añade un vuelo manualmente.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={handleCopyPublicLink}
                                    style={{
                                        background: 'rgba(2, 132, 199, 0.2)',
                                        border: '1px solid #0284c7',
                                        color: '#38bdf8',
                                        borderRadius: '8px',
                                        padding: '0.6rem 1.25rem',
                                        fontWeight: 700,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    🔗 Copiar Enlace Público
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFlightLogForm({
                                            pilot_id: members[0]?.id || '',
                                            aircraft_model: models[0]?.name || 'Maverick',
                                            reason: 'Patrullaje',
                                            reason_other: '',
                                            date: new Date().toISOString().split('T')[0],
                                            departure_time: '12:00',
                                            landing_time: '13:00',
                                            notes: '',
                                            status: 'Aprobado'
                                        });
                                        setIsFlightLogModalOpen(true);
                                    }}
                                    style={{
                                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                        border: 'none',
                                        color: '#ffffff',
                                        borderRadius: '8px',
                                        padding: '0.6rem 1.25rem',
                                        fontWeight: 700,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    + Registrar Manualmente
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '14px',
                            overflow: 'hidden',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(255, 255, 255, 0.15)', color: '#94a3b8' }}>
                                        <th style={{ padding: '0.9rem 1.25rem' }}>FECHA Y HORARIO</th>
                                        <th style={{ padding: '0.9rem 1.25rem' }}>PILOTO / CALLSIGN</th>
                                        <th style={{ padding: '0.9rem 1.25rem' }}>AERONAVE</th>
                                        <th style={{ padding: '0.9rem 1.25rem' }}>MOTIVO DE VUELO</th>
                                        <th style={{ padding: '0.9rem 1.25rem' }}>OBSERVACIONES</th>
                                        <th style={{ padding: '0.9rem 1.25rem' }}>ESTADO</th>
                                        <th style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>ACCIONES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFlightLogs.map((log) => {
                                        const statusColors = {
                                            'Aprobado': { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '#10b981' },
                                            'Pendiente': { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '#f59e0b' },
                                            'Rechazado': { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '#ef4444' }
                                        };
                                        const sc = statusColors[log.status] || statusColors['Pendiente'];
                                        const pilotObj = members.find(m => m.id === log.pilot_id || m.callsign === log.pilot_callsign);

                                        const durH = Math.floor((Number(log.duration_minutes) || 0) / 60);
                                        const durM = (Number(log.duration_minutes) || 0) % 60;

                                        return (
                                            <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                                {/* Date & Flight Times */}
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.92rem' }}>
                                                        {log.date}
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                                                        <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 700 }}>
                                                            {log.departure_time} ➔ {log.landing_time}
                                                        </span>
                                                        <span style={{
                                                            background: 'rgba(56, 189, 248, 0.15)',
                                                            color: '#38bdf8',
                                                            borderRadius: '4px',
                                                            padding: '1px 5px',
                                                            fontSize: '0.7rem',
                                                            fontWeight: 800
                                                        }}>
                                                            ⏱️ {durH > 0 ? `${durH}h ` : ''}{durM}m
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Pilot */}
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                                        <div style={{
                                                            width: '32px',
                                                            height: '32px',
                                                            borderRadius: '50%',
                                                            overflow: 'hidden',
                                                            background: '#0b1120',
                                                            border: '1.5px solid #0284c7',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '0.9rem',
                                                            flexShrink: 0
                                                        }}>
                                                            {pilotObj?.avatar ? (
                                                                <img
                                                                    src={getProfileImage(pilotObj.avatar, '/logowebp/anon.webp')}
                                                                    alt={log.pilot_name}
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                    onError={(e) => {
                                                                        e.currentTarget.onerror = null;
                                                                        e.currentTarget.src = '/logowebp/anon.webp';
                                                                    }}
                                                                />
                                                            ) : (
                                                                <span>👨‍✈️</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '0.88rem' }}>
                                                                {log.pilot_name}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 800 }}>
                                                                {log.pilot_callsign}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Model */}
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <span style={{
                                                        background: 'rgba(2, 132, 199, 0.2)',
                                                        color: '#38bdf8',
                                                        border: '1px solid rgba(2, 132, 199, 0.45)',
                                                        borderRadius: '6px',
                                                        padding: '0.25rem 0.6rem',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 800,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <span>🚁</span>
                                                        <span>{log.aircraft_model}</span>
                                                    </span>
                                                </td>

                                                {/* Reason */}
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <div style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.85rem' }}>
                                                        {log.reason}
                                                    </div>
                                                    {log.reason_other && (
                                                        <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '2px', fontStyle: 'italic' }}>
                                                            "{log.reason_other}"
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Notes */}
                                                <td style={{ padding: '1rem 1.25rem', color: '#cbd5e1', maxWidth: '260px', lineHeight: 1.4, fontSize: '0.82rem' }}>
                                                    {log.notes || <span style={{ color: '#64748b', fontStyle: 'italic' }}>Sin observaciones adicionales</span>}
                                                </td>

                                                {/* Status */}
                                                <td style={{ padding: '1rem 1.25rem' }}>
                                                    <span style={{
                                                        background: sc.bg,
                                                        color: sc.color,
                                                        border: `1px solid ${sc.border}`,
                                                        borderRadius: '6px',
                                                        padding: '0.25rem 0.6rem',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 800,
                                                        display: 'inline-block'
                                                    }}>
                                                        ● {log.status}
                                                    </span>
                                                    {log.reviewed_by && (
                                                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '3px' }}>
                                                            Por: {log.reviewed_by}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                                                    <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                                        {log.status === 'Pendiente' ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleApproveFlightLog(log.id)}
                                                                    style={{
                                                                        background: 'rgba(16, 185, 129, 0.2)',
                                                                        border: '1px solid #10b981',
                                                                        color: '#34d399',
                                                                        borderRadius: '6px',
                                                                        padding: '0.35rem 0.65rem',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: 800,
                                                                        cursor: 'pointer'
                                                                    }}
                                                                    title="Aprobar registro de vuelo"
                                                                >
                                                                    ✓ Aprobar
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRejectFlightLog(log.id)}
                                                                    style={{
                                                                        background: 'rgba(239, 68, 68, 0.2)',
                                                                        border: '1px solid #ef4444',
                                                                        color: '#f87171',
                                                                        borderRadius: '6px',
                                                                        padding: '0.35rem 0.65rem',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: 800,
                                                                        cursor: 'pointer'
                                                                    }}
                                                                    title="Rechazar registro de vuelo"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (log.status === 'Aprobado') handleRejectFlightLog(log.id);
                                                                    else handleApproveFlightLog(log.id);
                                                                }}
                                                                style={{
                                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                                                    color: '#cbd5e1',
                                                                    borderRadius: '6px',
                                                                    padding: '0.35rem 0.65rem',
                                                                    fontSize: '0.74rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                Cambiar
                                                            </button>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteFlightLog(log.id)}
                                                            style={{
                                                                background: 'rgba(239, 68, 68, 0.15)',
                                                                border: 'none',
                                                                borderRadius: '6px',
                                                                color: '#f87171',
                                                                padding: '0.35rem 0.65rem',
                                                                cursor: 'pointer',
                                                                fontSize: '0.75rem'
                                                            }}
                                                            title="Eliminar registro"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: MODELOS DE AERONAVES (AIRCRAFT MODELS) */}
            {activeTab === 'aircraft_models' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(15, 23, 42, 0.8) 100%)',
                        border: '1px solid rgba(2, 132, 199, 0.35)',
                        borderRadius: '14px',
                        padding: '1.25rem 1.75rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '1rem'
                    }}>
                        <div>
                            <h3 style={{ margin: '0 0 0.25rem 0', color: '#f8fafc', fontSize: '1.15rem', fontWeight: 800 }}>
                                Flota y Modelos de Aeronaves ASD
                            </h3>
                            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.85rem' }}>
                                Crea, edita y organiza los modelos de helicópteros disponibles para los registros de vuelo de la división.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setEditingModel(null);
                                setModelForm({
                                    name: '',
                                    type: 'Helicóptero Ligero / Patrullaje',
                                    registration: 'POLMAV-0' + (models.length + 1),
                                    description: '',
                                    status: 'Operativo'
                                });
                                setIsModelModalOpen(true);
                            }}
                            style={{
                                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0.65rem 1.25rem',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>+</span>
                            <span>Añadir Nuevo Modelo</span>
                        </button>
                    </div>

                    {/* Aircraft Models Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                        {filteredModels.map((mod) => {
                            const flightsWithThisModel = flightLogs.filter(f => f.aircraft_model === mod.name).length;

                            return (
                                <div
                                    key={mod.id}
                                    style={{
                                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.85) 100%)',
                                        border: '1px solid rgba(2, 132, 199, 0.3)',
                                        borderRadius: '14px',
                                        padding: '1.5rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        gap: '1rem',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {/* Top Card Details */}
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '42px',
                                                    height: '42px',
                                                    borderRadius: '10px',
                                                    background: 'rgba(2, 132, 199, 0.2)',
                                                    border: '1px solid #0284c7',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.4rem'
                                                }}>
                                                    🚁
                                                </div>
                                                <div>
                                                    <h4 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                                                        {mod.name}
                                                    </h4>
                                                    <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 700 }}>
                                                        {mod.registration || 'SIN MATRÍCULA'}
                                                    </span>
                                                </div>
                                            </div>

                                            <span style={{
                                                background: mod.status === 'Operativo' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                                color: mod.status === 'Operativo' ? '#34d399' : '#fbbf24',
                                                border: `1px solid ${mod.status === 'Operativo' ? '#10b981' : '#f59e0b'}`,
                                                borderRadius: '6px',
                                                padding: '2px 8px',
                                                fontSize: '0.72rem',
                                                fontWeight: 800
                                            }}>
                                                ● {mod.status || 'Operativo'}
                                            </span>
                                        </div>

                                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.5rem' }}>
                                            Tipo: <span style={{ color: '#cbd5e1' }}>{mod.type || 'Helicóptero'}</span>
                                        </div>

                                        <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                                            {mod.description || 'Sin descripción técnica detallada.'}
                                        </p>
                                    </div>

                                    {/* Bottom Card Footer with Flight Count & Actions */}
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                        paddingTop: '0.75rem',
                                        marginTop: '0.25rem'
                                    }}>
                                        <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                            📊 <strong style={{ color: '#38bdf8' }}>{flightsWithThisModel}</strong> vuelos registrados
                                        </div>

                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setEditingModel(mod);
                                                    setModelForm({
                                                        name: mod.name,
                                                        type: mod.type || 'Helicóptero Ligero / Patrullaje',
                                                        registration: mod.registration || '',
                                                        description: mod.description || '',
                                                        status: mod.status || 'Operativo'
                                                    });
                                                    setIsModelModalOpen(true);
                                                }}
                                                style={{
                                                    background: 'rgba(2, 132, 199, 0.15)',
                                                    border: '1px solid rgba(2, 132, 199, 0.4)',
                                                    borderRadius: '6px',
                                                    color: '#38bdf8',
                                                    padding: '0.35rem 0.75rem',
                                                    fontSize: '0.76rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteModel(mod.id, mod.name)}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                                    borderRadius: '6px',
                                                    color: '#f87171',
                                                    padding: '0.35rem 0.65rem',
                                                    fontSize: '0.76rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                                title="Eliminar modelo"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* MODAL 1: AÑADIR / EDITAR INTEGRANTE */}
            {isMemberModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(2, 132, 199, 0.4)', borderRadius: '16px', padding: '2rem', maxWidth: '540px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                                {editingMember ? 'Editar Integrante de ASD' : 'Añadir Integrante a ASD'}
                            </h2>
                            <button type="button" onClick={() => setIsMemberModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <form onSubmit={handleSaveMember} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                            {/* Pilot Avatar Upload & Compression Preview */}
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.1) 0%, rgba(15, 23, 42, 0.7) 100%)',
                                border: '1px solid rgba(2, 132, 199, 0.35)',
                                borderRadius: '12px',
                                padding: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1.25rem'
                            }}>
                                {/* Circular Avatar Preview */}
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    background: '#0b1120',
                                    border: '2px solid #0284c7',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.8rem',
                                    flexShrink: 0,
                                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)',
                                    position: 'relative'
                                }}>
                                    {avatarLoading ? (
                                        <div style={{ width: '22px', height: '22px', border: '2px solid #38bdf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                    ) : (avatarPreview || memberForm.avatar) ? (
                                        <img
                                            src={avatarPreview || getProfileImage(memberForm.avatar, '/logowebp/anon.webp')}
                                            alt="Avatar Preview"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={(e) => {
                                                e.currentTarget.onerror = null;
                                                e.currentTarget.src = '/logowebp/anon.webp';
                                            }}
                                        />
                                    ) : (
                                        <span role="img" aria-label="pilot">👨‍✈️</span>
                                    )}
                                </div>

                                {/* Upload Controls & Egress Badge */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                        <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#f8fafc' }}>
                                            Foto del Piloto / Operador ASD
                                        </span>
                                        <span style={{
                                            fontSize: '0.68rem',
                                            fontWeight: 800,
                                            background: 'rgba(16, 185, 129, 0.2)',
                                            color: '#34d399',
                                            border: '1px solid rgba(16, 185, 129, 0.4)',
                                            borderRadius: '5px',
                                            padding: '1px 6px'
                                        }}>
                                            ⚡ Anti-Egress Caching
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.6rem', lineHeight: 1.3 }}>
                                        Comprime automáticamente la imagen (&lt; 25 KB) con cabecera Cache-Control a 1 año para no gastar ancho de banda en BBDD.
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                        <label style={{
                                            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                            color: '#ffffff',
                                            borderRadius: '6px',
                                            padding: '0.35rem 0.85rem',
                                            fontSize: '0.76rem',
                                            fontWeight: 700,
                                            cursor: avatarLoading || savingMember ? 'not-allowed' : 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)'
                                        }}>
                                            <span>📷</span>
                                            <span>{avatarPreview || memberForm.avatar ? 'Cambiar Foto' : 'Subir Foto'}</span>
                                            <input
                                                ref={avatarInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleAvatarFileSelect}
                                                disabled={avatarLoading || savingMember}
                                                style={{ display: 'none' }}
                                            />
                                        </label>

                                        {(avatarPreview || memberForm.avatar) && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveAvatar}
                                                disabled={avatarLoading || savingMember}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                                    color: '#f87171',
                                                    borderRadius: '6px',
                                                    padding: '0.35rem 0.75rem',
                                                    fontSize: '0.76rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Eliminar Foto
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Nombre *</label>
                                    <input type="text" required value={memberForm.nombre} onChange={(e) => setMemberForm({ ...memberForm, nombre: e.target.value })} placeholder="Marcus" style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.6rem 0.8rem', fontSize: '0.88rem' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Apellido *</label>
                                    <input type="text" required value={memberForm.apellido} onChange={(e) => setMemberForm({ ...memberForm, apellido: e.target.value })} placeholder="Miller" style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.6rem 0.8rem', fontSize: '0.88rem' }} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#38bdf8', marginBottom: '0.35rem', fontWeight: 700 }}>Callsign / Indicativo *</label>
                                    <input type="text" required value={memberForm.callsign} onChange={(e) => setMemberForm({ ...memberForm, callsign: e.target.value })} placeholder="AIR-01" style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(2, 132, 199, 0.4)', borderRadius: '8px', color: '#38bdf8', fontWeight: 800, padding: '0.6rem 0.8rem', fontSize: '0.88rem' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Nº de Placa</label>
                                    <input type="text" value={memberForm.no_placa} onChange={(e) => setMemberForm({ ...memberForm, no_placa: e.target.value })} placeholder="101" style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.6rem 0.8rem', fontSize: '0.88rem' }} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.35rem', fontWeight: 700 }}>Rango en ASD *</label>
                                    <select value={memberForm.rank_id} onChange={(e) => setMemberForm({ ...memberForm, rank_id: e.target.value })} style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '8px', color: '#fff', padding: '0.6rem 0.8rem', fontSize: '0.88rem' }}>
                                        {sortedRanks.map(r => (
                                             <option key={r.id} value={r.id}>#{r.level} - {r.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Estado Operativo</label>
                                    <select value={memberForm.status} onChange={(e) => setMemberForm({ ...memberForm, status: e.target.value })} style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.6rem 0.8rem', fontSize: '0.88rem' }}>
                                        <option value="En Servicio">En Servicio</option>
                                        <option value="En Prácticas">En Prácticas</option>
                                        <option value="Reserva">Reserva</option>
                                        <option value="Suspendido">Suspendido</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Licencias Asignadas</label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', background: 'rgba(15, 23, 42, 0.65)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    {licenses.map(lic => {
                                        const isChecked = memberForm.licenses?.includes(lic.name);
                                        return (
                                            <label key={lic.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: isChecked ? '#38bdf8' : '#cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        const next = e.target.checked
                                                            ? [...memberForm.licenses, lic.name]
                                                            : memberForm.licenses.filter(l => l !== lic.name);
                                                        setMemberForm({ ...memberForm, licenses: next });
                                                    }}
                                                />
                                                {lic.name}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button type="button" onClick={() => setIsMemberModalOpen(false)} disabled={savingMember} style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', color: '#94a3b8', padding: '0.65rem 1.25rem', cursor: 'pointer' }}>Cancelar</button>
                                <button type="submit" disabled={savingMember || avatarLoading} style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 700, padding: '0.65rem 1.5rem', cursor: savingMember ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {savingMember && <div style={{ width: '14px', height: '14px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
                                    <span>{savingMember ? 'Guardando...' : (editingMember ? 'Guardar Cambios' : 'Crear Integrante')}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: CREAR / EDITAR RANGO */}
            {isRankModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(2, 132, 199, 0.4)', borderRadius: '16px', padding: '2rem', maxWidth: '480px', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                                {editingRank ? 'Editar Rango de ASD' : 'Nuevo Rango de ASD'}
                            </h2>
                            <button type="button" onClick={() => setIsRankModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <form onSubmit={handleSaveRank} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Nombre del Rango *</label>
                                <input type="text" required value={rankForm.name} onChange={(e) => setRankForm({ ...rankForm, name: e.target.value })} placeholder="Ej: Piloto Instructor" style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Nivel de Jerarquía (1 = Max)</label>
                                    <input type="number" min="1" required value={rankForm.level} onChange={(e) => setRankForm({ ...rankForm, level: e.target.value })} style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Abreviatura (Siglas)</label>
                                    <input type="text" value={rankForm.abbrev} onChange={(e) => setRankForm({ ...rankForm, abbrev: e.target.value })} placeholder="Ej: PTI" style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Color del Rango</label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input type="color" value={rankForm.color} onChange={(e) => setRankForm({ ...rankForm, color: e.target.value })} style={{ width: '40px', height: '40px', background: 'none', border: 'none', cursor: 'pointer' }} />
                                    <input type="text" value={rankForm.color} onChange={(e) => setRankForm({ ...rankForm, color: e.target.value })} style={{ flex: 1, background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }} />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setIsRankModalOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', color: '#94a3b8', padding: '0.65rem 1.25rem', cursor: 'pointer' }}>Cancelar</button>
                                <button type="submit" style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 700, padding: '0.65rem 1.5rem', cursor: 'pointer' }}>Guardar Rango</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: CREAR / EDITAR LICENCIA */}
            {isLicenseModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(2, 132, 199, 0.4)', borderRadius: '16px', padding: '2rem', maxWidth: '480px', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                                {editingLicense ? 'Editar Licencia de Vuelo' : 'Nueva Licencia de Vuelo ASD'}
                            </h2>
                            <button type="button" onClick={() => setIsLicenseModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <form onSubmit={handleSaveLicense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Nombre de la Licencia *</label>
                                <input type="text" required value={licenseForm.name} onChange={(e) => setLicenseForm({ ...licenseForm, name: e.target.value })} placeholder="Ej: Artillero Pesado" style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Código Identificador</label>
                                    <input type="text" value={licenseForm.code} onChange={(e) => setLicenseForm({ ...licenseForm, code: e.target.value })} placeholder="ASD-ART" style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Icono Emoji</label>
                                    <input type="text" value={licenseForm.icon} onChange={(e) => setLicenseForm({ ...licenseForm, icon: e.target.value })} placeholder="🪢" style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Descripción de la Habilitación</label>
                                <textarea rows="2" value={licenseForm.description} onChange={(e) => setLicenseForm({ ...licenseForm, description: e.target.value })} placeholder="Describe las maniobras o capacidades habilitadas..." style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem', resize: 'vertical' }} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setIsLicenseModalOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', color: '#94a3b8', padding: '0.65rem 1.25rem', cursor: 'pointer' }}>Cancelar</button>
                                <button type="submit" style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 700, padding: '0.65rem 1.5rem', cursor: 'pointer' }}>Guardar Licencia</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: REGISTRAR INFRACCIÓN */}
            {isInfractionModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '16px', padding: '2rem', maxWidth: '520px', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f87171', margin: 0 }}>
                                ⚠️ Registrar Infracción en ASD
                            </h2>
                            <button type="button" onClick={() => setIsInfractionModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <form onSubmit={handleSaveInfraction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Agente Sancionado *</label>
                                <select required value={infractionForm.member_id} onChange={(e) => setInfractionForm({ ...infractionForm, member_id: e.target.value })} style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}>
                                    {members.map(m => (
                                        <option key={m.id} value={m.id}>{m.callsign} - {m.nombre} {m.apellido}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#f87171', marginBottom: '0.35rem', fontWeight: 700 }}>Nivel de Infracción *</label>
                                    <select value={infractionForm.level} onChange={(e) => setInfractionForm({ ...infractionForm, level: e.target.value })} style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', color: '#f87171', fontWeight: 800, padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}>
                                        <option value="Leve">🟢 Leve (Amonestación / Informe)</option>
                                        <option value="Media">🟡 Media (Suspensión temporal)</option>
                                        <option value="Grave">🔴 Grave (Suspensión total / Mando)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Fecha de la Infracción</label>
                                    <input type="date" value={infractionForm.date} onChange={(e) => setInfractionForm({ ...infractionForm, date: e.target.value })} style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Motivo / Hechos Ocurridos *</label>
                                <textarea rows="3" required value={infractionForm.reason} onChange={(e) => setInfractionForm({ ...infractionForm, reason: e.target.value })} placeholder="Describe detalladamente el incumplimiento o falta operativa..." style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem', resize: 'vertical' }} />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Sanción Impuesta / Medida Correctiva</label>
                                <input type="text" value={infractionForm.sanction} onChange={(e) => setInfractionForm({ ...infractionForm, sanction: e.target.value })} placeholder="Ej: 3 días de inhabilitación de vuelo, amonestación..." style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setIsInfractionModalOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', color: '#94a3b8', padding: '0.65rem 1.25rem', cursor: 'pointer' }}>Cancelar</button>
                                <button type="submit" style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 700, padding: '0.65rem 1.5rem', cursor: 'pointer' }}>Registrar Infracción</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 5: GESTIÓN RÁPIDA DE LICENCIAS DE UN AGENTE */}
            {selectedMemberForLicenses && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(2, 132, 199, 0.4)', borderRadius: '16px', padding: '2rem', maxWidth: '480px', width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                                    Habilitaciones de Vuelo
                                </h2>
                                <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 700 }}>
                                    {selectedMemberForLicenses.callsign} - {selectedMemberForLicenses.nombre} {selectedMemberForLicenses.apellido}
                                </span>
                            </div>
                            <button type="button" onClick={() => setSelectedMemberForLicenses(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1rem' }}>
                            Haz clic para otorgar o retirar habilitaciones a este integrante:
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                            {licenses.map(lic => {
                                const isGranted = selectedMemberForLicenses.licenses?.includes(lic.name);

                                return (
                                    <div
                                        key={lic.id}
                                        onClick={() => handleToggleMemberLicense(selectedMemberForLicenses.id, lic.name)}
                                        style={{
                                            background: isGranted ? 'rgba(2, 132, 199, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                                            border: `1px solid ${isGranted ? '#0284c7' : 'rgba(255, 255, 255, 0.1)'}`,
                                            borderRadius: '10px',
                                            padding: '0.75rem 1rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '1.2rem' }}>{lic.icon || '🪪'}</span>
                                            <div>
                                                <div style={{ fontWeight: 700, color: isGranted ? '#f8fafc' : '#94a3b8', fontSize: '0.9rem' }}>{lic.name}</div>
                                                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{lic.code}</div>
                                            </div>
                                        </div>
                                        <span style={{
                                            background: isGranted ? '#0284c7' : 'rgba(255, 255, 255, 0.1)',
                                            color: '#ffffff',
                                            borderRadius: '6px',
                                            padding: '0.2rem 0.5rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 800
                                        }}>
                                            {isGranted ? '✓ Habilitado' : '+ Otorgar'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setSelectedMemberForLicenses(null)}
                                style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 700, padding: '0.65rem 1.5rem', cursor: 'pointer' }}
                            >
                                Listo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 6: CREAR / EDITAR MODELO DE AERONAVE */}
            {isModelModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(2, 132, 199, 0.4)', borderRadius: '16px', padding: '2rem', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>🚁</span>
                                <span>{editingModel ? 'Editar Modelo de Aeronave' : 'Nuevo Modelo de Aeronave'}</span>
                            </h2>
                            <button type="button" onClick={() => setIsModelModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <form onSubmit={handleSaveModel} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Nombre del Modelo *</label>
                                <input
                                    type="text"
                                    required
                                    value={modelForm.name}
                                    onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
                                    placeholder="Ej: Maverick, SuperVolito, Frogger..."
                                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Tipo / Clasificación</label>
                                    <input
                                        type="text"
                                        value={modelForm.type}
                                        onChange={(e) => setModelForm({ ...modelForm, type: e.target.value })}
                                        placeholder="Ej: Patrullaje / Rescate"
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Matrícula / Registro</label>
                                    <input
                                        type="text"
                                        value={modelForm.registration}
                                        onChange={(e) => setModelForm({ ...modelForm, registration: e.target.value })}
                                        placeholder="Ej: POLMAV-01"
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Estado Operativo</label>
                                <select
                                    value={modelForm.status}
                                    onChange={(e) => setModelForm({ ...modelForm, status: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                >
                                    <option value="Operativo">🟢 Operativo (Listo para vuelo)</option>
                                    <option value="Mantenimiento">🟡 Mantenimiento en Hangar</option>
                                    <option value="Fuera de Servicio">🔴 Fuera de Servicio</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Descripción / Equipamiento Especial</label>
                                <textarea
                                    rows="3"
                                    value={modelForm.description}
                                    onChange={(e) => setModelForm({ ...modelForm, description: e.target.value })}
                                    placeholder="Equipado con cámara infrarroja FLIR, foco NiteSun, gancho de rescate..."
                                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                                <button type="button" onClick={() => setIsModelModalOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', color: '#94a3b8', padding: '0.65rem 1.25rem', cursor: 'pointer' }}>Cancelar</button>
                                <button type="submit" style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 700, padding: '0.65rem 1.5rem', cursor: 'pointer' }}>Guardar Modelo</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 7: REGISTRO MANUAL DE VUELO */}
            {isFlightLogModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ background: '#0f172a', border: '1px solid rgba(2, 132, 199, 0.4)', borderRadius: '16px', padding: '2rem', maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>✈️</span>
                                <span>Registrar Vuelo (Manual)</span>
                            </h2>
                            <button type="button" onClick={() => setIsFlightLogModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <form onSubmit={handleSaveManualFlightLog} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Piloto al Mando *</label>
                                <select
                                    required
                                    value={flightLogForm.pilot_id}
                                    onChange={(e) => setFlightLogForm({ ...flightLogForm, pilot_id: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(2, 132, 199, 0.4)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                >
                                    {members.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.callsign} - {m.nombre} {m.apellido}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Modelo de Aeronave *</label>
                                    <select
                                        value={flightLogForm.aircraft_model}
                                        onChange={(e) => setFlightLogForm({ ...flightLogForm, aircraft_model: e.target.value })}
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    >
                                        {models.map(mod => (
                                            <option key={mod.id} value={mod.name}>{mod.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Motivo de Vuelo *</label>
                                    <select
                                        value={flightLogForm.reason}
                                        onChange={(e) => setFlightLogForm({ ...flightLogForm, reason: e.target.value })}
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    >
                                        <option value="Patrullaje">Patrullaje</option>
                                        <option value="487">487 (Robo de vehículo / Persecución)</option>
                                        <option value="207">207 (Secuestro)</option>
                                        <option value="215">215 (Robo a mano armada)</option>
                                        <option value="Búsqueda y Localización">Búsqueda y Localización</option>
                                        <option value="Operativo">Operativo</option>
                                        <option value="Práctica">Práctica</option>
                                        <option value="Otro">Otro (Especificar)</option>
                                    </select>
                                </div>
                            </div>

                            {flightLogForm.reason === 'Otro' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.35rem', fontWeight: 700 }}>Indicar Motivo de Vuelo *</label>
                                    <input
                                        type="text"
                                        required
                                        value={flightLogForm.reason_other}
                                        onChange={(e) => setFlightLogForm({ ...flightLogForm, reason_other: e.target.value })}
                                        placeholder="Ej: Traslado VIP, Apoyo marítimo..."
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(245, 158, 11, 0.4)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Fecha del Vuelo</label>
                                <input
                                    type="date"
                                    required
                                    value={flightLogForm.date}
                                    onChange={(e) => setFlightLogForm({ ...flightLogForm, date: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#38bdf8', marginBottom: '0.35rem', fontWeight: 700 }}>Hora de Salida *</label>
                                    <input
                                        type="time"
                                        required
                                        value={flightLogForm.departure_time}
                                        onChange={(e) => setFlightLogForm({ ...flightLogForm, departure_time: e.target.value })}
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(2, 132, 199, 0.4)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#38bdf8', marginBottom: '0.35rem', fontWeight: 700 }}>Hora de Aterrizaje *</label>
                                    <input
                                        type="time"
                                        required
                                        value={flightLogForm.landing_time}
                                        onChange={(e) => setFlightLogForm({ ...flightLogForm, landing_time: e.target.value })}
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(2, 132, 199, 0.4)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 700 }}>Observaciones / Informe Breve</label>
                                <textarea
                                    rows="2"
                                    value={flightLogForm.notes}
                                    onChange={(e) => setFlightLogForm({ ...flightLogForm, notes: e.target.value })}
                                    placeholder="Novedades del vuelo, persecuciones, condiciones meteorológicas..."
                                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#fff', padding: '0.65rem 0.9rem', fontSize: '0.88rem', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                                <button type="button" onClick={() => setIsFlightLogModalOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', color: '#94a3b8', padding: '0.65rem 1.25rem', cursor: 'pointer' }}>Cancelar</button>
                                <button type="submit" style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 700, padding: '0.65rem 1.5rem', cursor: 'pointer' }}>Guardar Registro</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AirSupport;
