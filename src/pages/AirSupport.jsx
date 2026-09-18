import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { getProfileImage } from '../utils/imageStorage';
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
        level: 'Leve', // 'Leve' | 'Media' | 'Grave'
        reason: 'Retraso en entrega del informe de inspección prevuelo en hangar',
        sanction: 'Amonestación verbal y registro en expediente de vuelo',
        issued_by: 'Marcus Miller (COM-ASD)',
        date: '2026-08-14',
        status: 'Cumplida' // 'Activa' | 'Cumplida' | 'Anulada'
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

function AirSupport() {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Active Navigation Tab: 'cuadrilla' | 'ranks' | 'licenses' | 'infractions'
    const [activeTab, setActiveTab] = useState('cuadrilla');

    // Data Collections
    const [ranks, setRanks] = useState([]);
    const [members, setMembers] = useState([]);
    const [licenses, setLicenses] = useState([]);
    const [infractions, setInfractions] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // --- Modal States ---
    // Member Modal
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
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

    // Rank Modal
    const [isRankModalOpen, setIsRankModalOpen] = useState(false);
    const [editingRank, setEditingRank] = useState(null);
    const [rankForm, setRankForm] = useState({
        name: '',
        level: 1,
        color: '#3b82f6',
        abbrev: ''
    });

    // License Modal
    const [isLicenseModalOpen, setIsLicenseModalOpen] = useState(false);
    const [editingLicense, setEditingLicense] = useState(null);
    const [licenseForm, setLicenseForm] = useState({
        name: '',
        code: '',
        color: '#3b82f6',
        icon: '🪪',
        description: ''
    });

    // Infraction Modal
    const [isInfractionModalOpen, setIsInfractionModalOpen] = useState(false);
    const [infractionForm, setInfractionForm] = useState({
        member_id: '',
        level: 'Leve',
        reason: '',
        sanction: '',
        status: 'Activa',
        date: new Date().toISOString().split('T')[0]
    });

    // Manage Member Licenses Quick Modal
    const [selectedMemberForLicenses, setSelectedMemberForLicenses] = useState(null);

    // Load initial data
    useEffect(() => {
        loadUserProfile();
    }, []);

    useEffect(() => {
        if (profile && hasAccess()) {
            loadASDData();
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
        // 1. Ranks
        try {
            const savedRanks = localStorage.getItem('asd_ranks_v2');
            if (savedRanks) {
                setRanks(JSON.parse(savedRanks));
            } else {
                setRanks(DEFAULT_ASD_RANKS);
                localStorage.setItem('asd_ranks_v2', JSON.stringify(DEFAULT_ASD_RANKS));
            }
        } catch (e) {
            setRanks(DEFAULT_ASD_RANKS);
        }

        // 2. Licenses
        try {
            const savedLic = localStorage.getItem('asd_licenses_v2');
            if (savedLic) {
                setLicenses(JSON.parse(savedLic));
            } else {
                setLicenses(DEFAULT_ASD_LICENSES);
                localStorage.setItem('asd_licenses_v2', JSON.stringify(DEFAULT_ASD_LICENSES));
            }
        } catch (e) {
            setLicenses(DEFAULT_ASD_LICENSES);
        }

        // 3. Members
        try {
            const savedMembers = localStorage.getItem('asd_members_v2');
            if (savedMembers) {
                setMembers(JSON.parse(savedMembers));
            } else {
                setMembers(DEFAULT_ASD_MEMBERS);
                localStorage.setItem('asd_members_v2', JSON.stringify(DEFAULT_ASD_MEMBERS));
            }
        } catch (e) {
            setMembers(DEFAULT_ASD_MEMBERS);
        }

        // 4. Infractions
        try {
            const savedInfs = localStorage.getItem('asd_infractions_v2');
            if (savedInfs) {
                setInfractions(JSON.parse(savedInfs));
            } else {
                setInfractions(DEFAULT_ASD_INFRACTIONS);
                localStorage.setItem('asd_infractions_v2', JSON.stringify(DEFAULT_ASD_INFRACTIONS));
            }
        } catch (e) {
            setInfractions(DEFAULT_ASD_INFRACTIONS);
        }
    };

    // --- Member Actions ---
    const handleOpenCreateMember = () => {
        setEditingMember(null);
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

    const handleSaveMember = (e) => {
        e.preventDefault();
        if (!memberForm.nombre || !memberForm.apellido || !memberForm.callsign) return;

        let updated;
        if (editingMember) {
            updated = members.map(m => m.id === editingMember.id ? { ...m, ...memberForm } : m);
        } else {
            const newMem = {
                id: 'asd-user-' + Date.now(),
                ...memberForm,
                joined_at: new Date().toISOString().split('T')[0]
            };
            updated = [...members, newMem];
        }

        setMembers(updated);
        localStorage.setItem('asd_members_v2', JSON.stringify(updated));
        setIsMemberModalOpen(false);
    };

    const handleDeleteMember = (id) => {
        if (!window.confirm(language === 'es' ? '¿Eliminar a este integrante de la cuadrilla de ASD?' : 'Delete this member from the ASD roster?')) return;
        const updated = members.filter(m => m.id !== id);
        setMembers(updated);
        localStorage.setItem('asd_members_v2', JSON.stringify(updated));
    };

    // --- Rank Actions ---
    const handleSaveRank = (e) => {
        e.preventDefault();
        if (!rankForm.name) return;

        let updated;
        if (editingRank) {
            updated = ranks.map(r => r.id === editingRank.id ? { ...r, ...rankForm, level: Number(rankForm.level) } : r);
        } else {
            const newRank = {
                id: 'rank-' + Date.now(),
                ...rankForm,
                level: Number(rankForm.level) || (ranks.length + 1)
            };
            updated = [...ranks, newRank];
        }

        // Sort by hierarchy level ascending (Level 1 at top)
        updated.sort((a, b) => a.level - b.level);

        setRanks(updated);
        localStorage.setItem('asd_ranks_v2', JSON.stringify(updated));
        setIsRankModalOpen(false);
        setEditingRank(null);
    };

    const handleDeleteRank = (id) => {
        if (ranks.length <= 1) {
            alert(language === 'es' ? 'Debe haber al menos un rango en la división.' : 'There must be at least one rank.');
            return;
        }
        if (!window.confirm(language === 'es' ? '¿Eliminar este rango de la división? Los agentes asignados deberán reasignarse.' : 'Delete this rank?')) return;
        const updated = ranks.filter(r => r.id !== id);
        setRanks(updated);
        localStorage.setItem('asd_ranks_v2', JSON.stringify(updated));
    };

    const handleMoveRank = (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= ranks.length) return;

        const newRanks = [...ranks];
        const temp = newRanks[index];
        newRanks[index] = newRanks[targetIndex];
        newRanks[targetIndex] = temp;

        // Reassign level numbers
        const reordered = newRanks.map((r, i) => ({ ...r, level: i + 1 }));
        setRanks(reordered);
        localStorage.setItem('asd_ranks_v2', JSON.stringify(reordered));
    };

    // --- License Actions ---
    const handleSaveLicense = (e) => {
        e.preventDefault();
        if (!licenseForm.name) return;

        let updated;
        if (editingLicense) {
            updated = licenses.map(l => l.id === editingLicense.id ? { ...l, ...licenseForm } : l);
        } else {
            const newLic = {
                id: 'lic-' + Date.now(),
                ...licenseForm,
                code: licenseForm.code || 'ASD-' + licenseForm.name.substring(0, 3).toUpperCase()
            };
            updated = [...licenses, newLic];
        }

        setLicenses(updated);
        localStorage.setItem('asd_licenses_v2', JSON.stringify(updated));
        setIsLicenseModalOpen(false);
        setEditingLicense(null);
    };

    const handleDeleteLicense = (id, name) => {
        if (!window.confirm(language === 'es' ? `¿Eliminar la licencia "${name}"?` : `Delete license "${name}"?`)) return;
        const updated = licenses.filter(l => l.id !== id);
        setLicenses(updated);
        localStorage.setItem('asd_licenses_v2', JSON.stringify(updated));

        // Remove from members
        const updatedMembers = members.map(m => ({
            ...m,
            licenses: (m.licenses || []).filter(lName => lName !== name)
        }));
        setMembers(updatedMembers);
        localStorage.setItem('asd_members_v2', JSON.stringify(updatedMembers));
    };

    const handleToggleMemberLicense = (memberId, licenseName) => {
        const updated = members.map(m => {
            if (m.id === memberId) {
                const currentLic = m.licenses || [];
                const hasLic = currentLic.includes(licenseName);
                const nextLic = hasLic ? currentLic.filter(l => l !== licenseName) : [...currentLic, licenseName];
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
    };

    // --- Infraction Actions ---
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

    const handleSaveInfraction = (e) => {
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
        setIsInfractionModalOpen(false);
    };

    const handleDeleteInfraction = (id) => {
        if (!window.confirm(language === 'es' ? '¿Eliminar este registro de infracción?' : 'Delete this infraction?')) return;
        const updated = infractions.filter(i => i.id !== id);
        setInfractions(updated);
        localStorage.setItem('asd_infractions_v2', JSON.stringify(updated));
    };

    const handleToggleInfractionStatus = (id) => {
        const updated = infractions.map(i => {
            if (i.id === id) {
                const nextStatus = i.status === 'Activa' ? 'Cumplida' : 'Activa';
                return { ...i, status: nextStatus };
            }
            return i;
        });
        setInfractions(updated);
        localStorage.setItem('asd_infractions_v2', JSON.stringify(updated));
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

    if (loading) {
        return (
            <div className="flex-center" style={{ minHeight: '70vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    // Access Denied Screen
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
                            padding: '0.65rem 1.35rem',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>👥</span>
                        <span>Cuadrilla ASD (Jerarquía)</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('ranks')}
                        style={{
                            background: activeTab === 'ranks' ? 'rgba(2, 132, 199, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'ranks' ? '#38bdf8' : '#94a3b8',
                            border: `1px solid ${activeTab === 'ranks' ? 'rgba(2, 132, 199, 0.55)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '8px',
                            padding: '0.65rem 1.35rem',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>🎖️</span>
                        <span>Gestión de Rangos</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('licenses')}
                        style={{
                            background: activeTab === 'licenses' ? 'rgba(2, 132, 199, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'licenses' ? '#38bdf8' : '#94a3b8',
                            border: `1px solid ${activeTab === 'licenses' ? 'rgba(2, 132, 199, 0.55)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '8px',
                            padding: '0.65rem 1.35rem',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <span>🪪</span>
                        <span>Licencias de Vuelo ({licenses.length})</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('infractions')}
                        style={{
                            background: activeTab === 'infractions' ? 'rgba(2, 132, 199, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'infractions' ? '#38bdf8' : '#94a3b8',
                            border: `1px solid ${activeTab === 'infractions' ? 'rgba(2, 132, 199, 0.55)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '8px',
                            padding: '0.65rem 1.35rem',
                            fontWeight: 700,
                            fontSize: '0.9rem',
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
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="Buscar integrante, callsign..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            background: 'rgba(15, 23, 42, 0.85)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            padding: '0.6rem 1rem',
                            fontSize: '0.85rem',
                            width: '220px'
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
                                                            width: '56px',
                                                            height: '56px',
                                                            borderRadius: '50%',
                                                            overflow: 'hidden',
                                                            background: '#0f172a',
                                                            border: `2px solid ${rank.color}`,
                                                            flexShrink: 0,
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '1.5rem'
                                                        }}>
                                                            {m.avatar ? (
                                                                <img src={getProfileImage(m.avatar)} alt={m.apellido} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                '👨‍✈️'
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

                        <form onSubmit={handleSaveMember} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                <button type="button" onClick={() => setIsMemberModalOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', color: '#94a3b8', padding: '0.65rem 1.25rem', cursor: 'pointer' }}>Cancelar</button>
                                <button type="submit" style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 700, padding: '0.65rem 1.5rem', cursor: 'pointer' }}>
                                    {editingMember ? 'Guardar Cambios' : 'Crear Integrante'}
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
        </div>
    );
}

export default AirSupport;
