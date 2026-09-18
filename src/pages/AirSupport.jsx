import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { getProfileImage } from '../utils/imageStorage';
import '../index.css';

function AirSupport() {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    // Active Main Tab: 'ops' | 'logbook' | 'fleet' | 'roster'
    const [activeTab, setActiveTab] = useState('ops');

    // Data states
    const [missions, setMissions] = useState([]);
    const [flightLogs, setFlightLogs] = useState([]);
    const [fleet, setFleet] = useState([]);
    const [personnelList, setPersonnelList] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
    const [editingMission, setEditingMission] = useState(null);
    const [missionForm, setMissionForm] = useState({
        title: '',
        callsign: 'AIR-1',
        pilot: '',
        tfo: '',
        status: 'En Vuelo', // 'En Vuelo' | 'Patrulla' | 'Alerta' | 'Finalizada'
        zone: 'Los Santos Metro',
        altitude: '1500 FT',
        equipment: 'FLIR HD + Searchlight',
        objective: '',
        notes: ''
    });

    const [isLogModalOpen, setIsLogModalOpen] = useState(false);
    const [logForm, setLogForm] = useState({
        callsign: 'AIR-1',
        pilot: '',
        tfo: '',
        aircraft: 'Polmav AS350',
        departureTime: '',
        arrivalTime: '',
        flightType: 'Patrullaje Preventivo', // 'Patrullaje Preventivo' | 'Persecución Vehicular' | 'Apoyo Táctico' | 'Búsqueda y Rescate' | 'Vigilancia FLIR'
        incidentNumber: '',
        summary: ''
    });

    const [isAircraftModalOpen, setIsAircraftModalOpen] = useState(false);
    const [aircraftForm, setAircraftForm] = useState({
        id: '',
        model: 'Police Maverick (AS350)',
        tailNumber: 'N-911LS',
        callsign: 'AIR-1',
        status: 'Operativo', // 'Operativo' | 'En Vuelo' | 'Mantenimiento' | 'Standby'
        fuelLevel: 100,
        equipment: ['FLIR Camera', 'NiteSun Searchlight', 'Rescue Hoist', 'Police Radio Array'],
        lastMaintenance: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        loadUserProfile();
    }, []);

    useEffect(() => {
        if (profile && hasAccess()) {
            fetchMissions();
            fetchFlightLogs();
            fetchFleet();
            fetchASDPersonnel();
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

    // --- Data Fetching with LocalStorage fallbacks ---
    const fetchMissions = async () => {
        try {
            const { data, error } = await supabase
                .from('asd_missions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error || !data || data.length === 0) {
                const local = localStorage.getItem('asd_missions_v1');
                if (local) {
                    setMissions(JSON.parse(local));
                } else {
                    const defaultMissions = [
                        {
                            id: 'asd-m1',
                            title: 'Patrullaje Aéreo Nocturno & Cobertura Flir',
                            callsign: 'AIR-1',
                            pilot: 'Marcus Miller',
                            tfo: 'Sarah Connor',
                            status: 'En Vuelo',
                            zone: 'Los Santos Este & Vinewood',
                            altitude: '1200 FT',
                            equipment: 'FLIR HD Térmico + NiteSun',
                            objective: 'Monitoreo de tráfico sospechoso en zonas conflictivas y respuesta rápida a persecuciones.',
                            notes: 'Condiciones meteorológicas óptimas. 85% de combustible restante.',
                            created_at: new Date().toISOString()
                        },
                        {
                            id: 'asd-m2',
                            title: 'Apoyo Aéreo Operativo Táctico SEB',
                            callsign: 'AIR-TAC',
                            pilot: 'Dominic Vance',
                            tfo: 'David Ross',
                            status: 'Alerta',
                            zone: 'El Burro Heights / Puerto',
                            altitude: '2000 FT',
                            equipment: 'FLIR + Fast Rope Winch',
                            objective: 'Vigilancia perimetral en operativo conjunto de interdicción y soporte visual continuo.',
                            notes: 'En coordinación con canal táctico 4.',
                            created_at: new Date(Date.now() - 3600000 * 4).toISOString()
                        }
                    ];
                    setMissions(defaultMissions);
                    localStorage.setItem('asd_missions_v1', JSON.stringify(defaultMissions));
                }
            } else {
                setMissions(data);
            }
        } catch (err) {
            console.warn('Fallback to localStorage for ASD missions:', err);
        }
    };

    const fetchFlightLogs = async () => {
        try {
            const { data, error } = await supabase
                .from('asd_flight_logs')
                .select('*')
                .order('created_at', { ascending: false });

            if (error || !data || data.length === 0) {
                const local = localStorage.getItem('asd_flight_logs_v1');
                if (local) {
                    setFlightLogs(JSON.parse(local));
                } else {
                    const defaultLogs = [
                        {
                            id: 'log-1',
                            callsign: 'AIR-1',
                            pilot: 'Marcus Miller',
                            tfo: 'Sarah Connor',
                            aircraft: 'Polmav AS350',
                            departureTime: '21:30',
                            arrivalTime: '23:15',
                            flightType: 'Persecución Vehicular',
                            incidentNumber: 'INC-8892',
                            summary: 'Seguimiento visual de Sultán negro huyendo a alta velocidad por Great Ocean Hwy hasta detención por unidades terrestres.',
                            created_at: new Date().toISOString()
                        },
                        {
                            id: 'log-2',
                            callsign: 'AIR-2',
                            pilot: 'Alex Mercer',
                            tfo: 'James Carter',
                            aircraft: 'Polmav AS350',
                            departureTime: '17:00',
                            arrivalTime: '19:30',
                            flightType: 'Búsqueda y Rescate',
                            incidentNumber: 'INC-8840',
                            summary: 'Localización de senderista extraviado en Mount Chiliad mediante cámara térmica FLIR. Coordinación con EMS.',
                            created_at: new Date(Date.now() - 86400000).toISOString()
                        }
                    ];
                    setFlightLogs(defaultLogs);
                    localStorage.setItem('asd_flight_logs_v1', JSON.stringify(defaultLogs));
                }
            } else {
                setFlightLogs(data);
            }
        } catch (err) {
            console.warn('Fallback to localStorage for ASD flight logs:', err);
        }
    };

    const fetchFleet = async () => {
        try {
            const { data, error } = await supabase
                .from('asd_fleet')
                .select('*')
                .order('callsign');

            if (error || !data || data.length === 0) {
                const local = localStorage.getItem('asd_fleet_v1');
                if (local) {
                    setFleet(JSON.parse(local));
                } else {
                    const defaultFleet = [
                        {
                            id: 'ac-1',
                            model: 'Police Maverick (Eurocopter AS350)',
                            tailNumber: 'N-911LS',
                            callsign: 'AIR-1',
                            status: 'Operativo',
                            fuelLevel: 90,
                            equipment: ['FLIR Camera HD', 'NiteSun 30M CP Searchlight', 'Police Dual Radio', 'Loudspeaker Array'],
                            lastMaintenance: new Date().toISOString().split('T')[0]
                        },
                        {
                            id: 'ac-2',
                            model: 'Police Maverick (Eurocopter AS350)',
                            tailNumber: 'N-912LS',
                            callsign: 'AIR-2',
                            status: 'Operativo',
                            fuelLevel: 75,
                            equipment: ['FLIR Camera HD', 'NiteSun Searchlight', 'Rescue Hoist'],
                            lastMaintenance: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0]
                        },
                        {
                            id: 'ac-3',
                            model: 'Bell 412 Tactical Transport',
                            tailNumber: 'N-920TAC',
                            callsign: 'AIR-TAC',
                            status: 'Standby',
                            fuelLevel: 100,
                            equipment: ['Fast Rope Winch System', 'Thermal Array', 'Heavy Cargo Hoist'],
                            lastMaintenance: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0]
                        }
                    ];
                    setFleet(defaultFleet);
                    localStorage.setItem('asd_fleet_v1', JSON.stringify(defaultFleet));
                }
            } else {
                setFleet(data);
            }
        } catch (err) {
            console.warn('Fallback to localStorage for ASD fleet:', err);
        }
    };

    const fetchASDPersonnel = async () => {
        try {
            const { data } = await supabase
                .from('users')
                .select('*')
                .order('rango');
            if (data) {
                const filtered = data.filter(u =>
                    u.rango === 'ASD Agent' ||
                    (u.divisions && u.divisions.includes('ASD'))
                );
                setPersonnelList(filtered);
            }
        } catch (err) {
            console.error('Error fetching ASD personnel:', err);
        }
    };

    // --- Action Handlers ---
    const handleSaveMission = async (e) => {
        e.preventDefault();
        if (!missionForm.title || !missionForm.callsign) return;

        let updatedMissions;
        if (editingMission) {
            updatedMissions = missions.map(m => m.id === editingMission.id ? { ...m, ...missionForm } : m);
        } else {
            const newEntry = {
                id: 'asd-m-' + Date.now(),
                ...missionForm,
                created_at: new Date().toISOString()
            };
            updatedMissions = [newEntry, ...missions];
        }

        setMissions(updatedMissions);
        localStorage.setItem('asd_missions_v1', JSON.stringify(updatedMissions));

        try {
            if (editingMission) {
                await supabase.from('asd_missions').update(missionForm).eq('id', editingMission.id);
            } else {
                await supabase.from('asd_missions').insert([{ ...missionForm, id: 'asd-m-' + Date.now() }]);
            }
        } catch (e) {
            console.warn('Supabase mission save error:', e);
        }

        setIsMissionModalOpen(false);
        setEditingMission(null);
        setMissionForm({
            title: '',
            callsign: 'AIR-1',
            pilot: profile ? `${profile.nombre} ${profile.apellido}` : '',
            tfo: '',
            status: 'En Vuelo',
            zone: 'Los Santos Metro',
            altitude: '1500 FT',
            equipment: 'FLIR HD + Searchlight',
            objective: '',
            notes: ''
        });
    };

    const handleDeleteMission = async (id) => {
        if (!window.confirm(language === 'es' ? '¿Eliminar esta misión aérea?' : 'Delete this air mission?')) return;
        const updated = missions.filter(m => m.id !== id);
        setMissions(updated);
        localStorage.setItem('asd_missions_v1', JSON.stringify(updated));
        try {
            await supabase.from('asd_missions').delete().eq('id', id);
        } catch (e) {
            console.warn('Supabase mission delete error:', e);
        }
    };

    const handleSaveFlightLog = async (e) => {
        e.preventDefault();
        if (!logForm.callsign || !logForm.pilot) return;

        const newLog = {
            id: 'log-' + Date.now(),
            ...logForm,
            created_at: new Date().toISOString()
        };
        const updatedLogs = [newLog, ...flightLogs];
        setFlightLogs(updatedLogs);
        localStorage.setItem('asd_flight_logs_v1', JSON.stringify(updatedLogs));

        try {
            await supabase.from('asd_flight_logs').insert([newLog]);
        } catch (e) {
            console.warn('Supabase flight log save error:', e);
        }

        setIsLogModalOpen(false);
        setLogForm({
            callsign: 'AIR-1',
            pilot: profile ? `${profile.nombre} ${profile.apellido}` : '',
            tfo: '',
            aircraft: 'Polmav AS350',
            departureTime: '',
            arrivalTime: '',
            flightType: 'Patrullaje Preventivo',
            incidentNumber: '',
            summary: ''
        });
    };

    const handleDeleteFlightLog = async (id) => {
        if (!window.confirm(language === 'es' ? '¿Eliminar este registro de vuelo?' : 'Delete this flight log?')) return;
        const updated = flightLogs.filter(l => l.id !== id);
        setFlightLogs(updated);
        localStorage.setItem('asd_flight_logs_v1', JSON.stringify(updated));
        try {
            await supabase.from('asd_flight_logs').delete().eq('id', id);
        } catch (e) {
            console.warn('Supabase flight log delete error:', e);
        }
    };

    const handleUpdateAircraftStatus = async (id, newStatus, newFuel) => {
        const updated = fleet.map(ac => {
            if (ac.id === id) {
                return {
                    ...ac,
                    status: newStatus !== undefined ? newStatus : ac.status,
                    fuelLevel: newFuel !== undefined ? newFuel : ac.fuelLevel
                };
            }
            return ac;
        });
        setFleet(updated);
        localStorage.setItem('asd_fleet_v1', JSON.stringify(updated));

        try {
            await supabase.from('asd_fleet').update({
                status: newStatus,
                fuelLevel: newFuel
            }).eq('id', id);
        } catch (e) {
            console.warn('Supabase fleet update error:', e);
        }
    };

    // Filtered lists
    const filteredMissions = useMemo(() => {
        if (!searchTerm.trim()) return missions;
        const q = searchTerm.toLowerCase();
        return missions.filter(m =>
            m.title?.toLowerCase().includes(q) ||
            m.callsign?.toLowerCase().includes(q) ||
            m.pilot?.toLowerCase().includes(q) ||
            m.zone?.toLowerCase().includes(q)
        );
    }, [missions, searchTerm]);

    const filteredLogs = useMemo(() => {
        if (!searchTerm.trim()) return flightLogs;
        const q = searchTerm.toLowerCase();
        return flightLogs.filter(l =>
            l.callsign?.toLowerCase().includes(q) ||
            l.pilot?.toLowerCase().includes(q) ||
            l.tfo?.toLowerCase().includes(q) ||
            l.flightType?.toLowerCase().includes(q) ||
            l.incidentNumber?.toLowerCase().includes(q) ||
            l.summary?.toLowerCase().includes(q)
        );
    }, [flightLogs, searchTerm]);

    const filteredPersonnel = useMemo(() => {
        if (!searchTerm.trim()) return personnelList;
        const q = searchTerm.toLowerCase();
        return personnelList.filter(u =>
            (u.nombre && u.nombre.toLowerCase().includes(q)) ||
            (u.apellido && u.apellido.toLowerCase().includes(q)) ||
            (u.rango && u.rango.toLowerCase().includes(q)) ||
            (u.no_placa && u.no_placa.toLowerCase().includes(q))
        );
    }, [personnelList, searchTerm]);

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
            <div className="documentation-container" style={{
                padding: '3rem 2rem',
                maxWidth: '900px',
                margin: '0 auto',
                textAlign: 'center'
            }}>
                <div style={{
                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '16px',
                    padding: '3rem 2rem',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '2px solid #ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        fontSize: '2.5rem'
                    }}>
                        🚁
                    </div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.75rem' }}>
                        {language === 'es' ? 'Acceso Restringido • Air Support Division' : 'Restricted Access • Air Support Division'}
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '1rem', maxWidth: '600px', margin: '0 auto 2rem', lineHeight: 1.6 }}>
                        {language === 'es'
                            ? 'Este apartado está reservado exclusivamente para agentes asignados al rango/división ASD (Air Support Division) o personal con rango de Coordinador, Comisionado o Administrador.'
                            : 'This section is strictly reserved for ASD (Air Support Division) rank/division personnel or Coordination/Commissioner/Admin roles.'}
                    </p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="btn-primary"
                        style={{ padding: '0.75rem 2rem', borderRadius: '10px' }}
                    >
                        {language === 'es' ? 'Volver al Inicio' : 'Back to Dashboard'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="documentation-container" style={{
            padding: '1.5rem 2rem 4rem',
            maxWidth: '1400px',
            margin: '0 auto',
            animation: 'fadeIn 0.4s ease-out'
        }}>
            {/* Top ASD Header & Stats Bar */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(15, 23, 42, 0.85) 100%)',
                border: '1px solid rgba(14, 165, 233, 0.35)',
                borderRadius: '16px',
                padding: '1.75rem 2rem',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.5rem',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        boxShadow: '0 8px 20px rgba(2, 132, 199, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}>
                        🚁
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '0.5px' }}>
                                AIR SUPPORT DIVISION
                            </h1>
                            <span style={{
                                background: 'rgba(14, 165, 233, 0.25)',
                                color: '#38bdf8',
                                border: '1px solid rgba(14, 165, 233, 0.5)',
                                borderRadius: '6px',
                                padding: '0.15rem 0.6rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                            }}>
                                ASD • S.C.U.B. / SAPD
                            </span>
                        </div>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
                            {language === 'es' ? 'Centro de Control Táctico de Operaciones Aéreas, Bitácora y Cuadrilla de Vuelo' : 'Tactical Air Operations Command, Flight Logs & Air Crew Center'}
                        </p>
                    </div>
                </div>

                {/* Live Stats Pills */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(14, 165, 233, 0.25)',
                        borderRadius: '10px',
                        padding: '0.5rem 1rem',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                            {language === 'es' ? 'Aeronaves en Vuelo' : 'Airborne Units'}
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
                            {missions.filter(m => m.status === 'En Vuelo').length}
                        </div>
                    </div>
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: '10px',
                        padding: '0.5rem 1rem',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                            {language === 'es' ? 'Flota Operativa' : 'Fleet Ready'}
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399' }}>
                            {fleet.filter(f => f.status === 'Operativo').length} / {fleet.length}
                        </div>
                    </div>
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(245, 158, 11, 0.25)',
                        borderRadius: '10px',
                        padding: '0.5rem 1rem',
                        textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                            {language === 'es' ? 'Agentes ASD' : 'ASD Pilots & Crew'}
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24' }}>
                            {personnelList.length}
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs Bar & Action Buttons */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                paddingBottom: '1rem'
            }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => setActiveTab('ops')}
                        className={`tab-btn ${activeTab === 'ops' ? 'active' : ''}`}
                        style={{
                            background: activeTab === 'ops' ? 'rgba(14, 165, 233, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'ops' ? '#38bdf8' : '#94a3b8',
                            border: `1px solid ${activeTab === 'ops' ? 'rgba(14, 165, 233, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '8px',
                            padding: '0.6rem 1.25rem',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>📡</span>
                        <span>{language === 'es' ? 'Misiones & Despacho' : 'Missions & Dispatch'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('logbook')}
                        className={`tab-btn ${activeTab === 'logbook' ? 'active' : ''}`}
                        style={{
                            background: activeTab === 'logbook' ? 'rgba(14, 165, 233, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'logbook' ? '#38bdf8' : '#94a3b8',
                            border: `1px solid ${activeTab === 'logbook' ? 'rgba(14, 165, 233, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '8px',
                            padding: '0.6rem 1.25rem',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>📖</span>
                        <span>{language === 'es' ? 'Bitácora de Vuelos' : 'Flight Logbook'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('fleet')}
                        className={`tab-btn ${activeTab === 'fleet' ? 'active' : ''}`}
                        style={{
                            background: activeTab === 'fleet' ? 'rgba(14, 165, 233, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'fleet' ? '#38bdf8' : '#94a3b8',
                            border: `1px solid ${activeTab === 'fleet' ? 'rgba(14, 165, 233, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '8px',
                            padding: '0.6rem 1.25rem',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>🚁</span>
                        <span>{language === 'es' ? 'Flota de Aeronaves' : 'Aircraft Fleet'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('roster')}
                        className={`tab-btn ${activeTab === 'roster' ? 'active' : ''}`}
                        style={{
                            background: activeTab === 'roster' ? 'rgba(14, 165, 233, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                            color: activeTab === 'roster' ? '#38bdf8' : '#94a3b8',
                            border: `1px solid ${activeTab === 'roster' ? 'rgba(14, 165, 233, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                            borderRadius: '8px',
                            padding: '0.6rem 1.25rem',
                            fontWeight: 700,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>👨‍✈️</span>
                        <span>{language === 'es' ? 'Cuadrilla ASD' : 'ASD Roster'}</span>
                    </button>
                </div>

                {/* Right controls: Search & New Action */}
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder={language === 'es' ? 'Buscar en ASD...' : 'Search ASD...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            padding: '0.55rem 1rem',
                            fontSize: '0.85rem',
                            width: '200px'
                        }}
                    />

                    {activeTab === 'ops' && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingMission(null);
                                setMissionForm({
                                    title: '',
                                    callsign: 'AIR-1',
                                    pilot: profile ? `${profile.nombre} ${profile.apellido}` : '',
                                    tfo: '',
                                    status: 'En Vuelo',
                                    zone: 'Los Santos Metro',
                                    altitude: '1500 FT',
                                    equipment: 'FLIR HD + Searchlight',
                                    objective: '',
                                    notes: ''
                                });
                                setIsMissionModalOpen(true);
                            }}
                            className="btn-primary"
                            style={{
                                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0.6rem 1.25rem',
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
                            <span>{language === 'es' ? 'Nueva Misión Aérea' : 'New Air Mission'}</span>
                        </button>
                    )}

                    {activeTab === 'logbook' && (
                        <button
                            type="button"
                            onClick={() => {
                                setLogForm({
                                    callsign: 'AIR-1',
                                    pilot: profile ? `${profile.nombre} ${profile.apellido}` : '',
                                    tfo: '',
                                    aircraft: 'Polmav AS350',
                                    departureTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                    arrivalTime: '',
                                    flightType: 'Patrullaje Preventivo',
                                    incidentNumber: '',
                                    summary: ''
                                });
                                setIsLogModalOpen(true);
                            }}
                            className="btn-primary"
                            style={{
                                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '0.6rem 1.25rem',
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
                            <span>{language === 'es' ? 'Nuevo Registro de Vuelo' : 'New Flight Log'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* TAB 1: MISSIONS & OPERATIONS */}
            {activeTab === 'ops' && (
                <div>
                    {filteredMissions.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '3rem',
                            background: 'rgba(15, 23, 42, 0.5)',
                            borderRadius: '12px',
                            border: '1px dashed rgba(255, 255, 255, 0.15)',
                            color: '#94a3b8'
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🚁</div>
                            <p style={{ margin: 0, fontSize: '1rem' }}>
                                {language === 'es' ? 'No hay misiones aéreas activas en este momento.' : 'No active air missions right now.'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '1.25rem' }}>
                            {filteredMissions.map((m) => {
                                const statusColors = {
                                    'En Vuelo': { bg: 'rgba(14, 165, 233, 0.2)', border: '#0284c7', text: '#38bdf8' },
                                    'Patrulla': { bg: 'rgba(16, 185, 129, 0.2)', border: '#059669', text: '#34d399' },
                                    'Alerta': { bg: 'rgba(245, 158, 11, 0.2)', border: '#d97706', text: '#fbbf24' },
                                    'Finalizada': { bg: 'rgba(100, 116, 139, 0.2)', border: '#475569', text: '#94a3b8' }
                                };
                                const st = statusColors[m.status] || statusColors['En Vuelo'];

                                return (
                                    <div
                                        key={m.id}
                                        style={{
                                            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '12px',
                                            padding: '1.25rem',
                                            position: 'relative',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            transition: 'transform 0.2s, border-color 0.2s',
                                            boxShadow: '0 4px 15px rgba(0,0,0,0.25)'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.borderColor = 'rgba(14, 165, 233, 0.4)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{
                                                        background: 'rgba(2, 132, 199, 0.3)',
                                                        color: '#38bdf8',
                                                        border: '1px solid rgba(2, 132, 199, 0.5)',
                                                        borderRadius: '6px',
                                                        padding: '0.2rem 0.5rem',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 800
                                                    }}>
                                                        {m.callsign}
                                                    </span>
                                                    <span style={{
                                                        background: st.bg,
                                                        color: st.text,
                                                        border: `1px solid ${st.border}`,
                                                        borderRadius: '6px',
                                                        padding: '0.2rem 0.6rem',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700
                                                    }}>
                                                        ● {m.status}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingMission(m);
                                                            setMissionForm(m);
                                                            setIsMissionModalOpen(true);
                                                        }}
                                                        style={{
                                                            background: 'rgba(255, 255, 255, 0.08)',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            color: '#cbd5e1',
                                                            padding: '0.3rem 0.6rem',
                                                            cursor: 'pointer',
                                                            fontSize: '0.75rem'
                                                        }}
                                                        title="Editar Misión"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteMission(m.id)}
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            border: 'none',
                                                            borderRadius: '6px',
                                                            color: '#f87171',
                                                            padding: '0.3rem 0.6rem',
                                                            cursor: 'pointer',
                                                            fontSize: '0.75rem'
                                                        }}
                                                        title="Eliminar Misión"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>

                                            <h3 style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                                                {m.title}
                                            </h3>

                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: '1fr 1fr',
                                                gap: '0.5rem',
                                                background: 'rgba(15, 23, 42, 0.6)',
                                                padding: '0.75rem',
                                                borderRadius: '8px',
                                                marginBottom: '0.75rem',
                                                fontSize: '0.82rem'
                                            }}>
                                                <div>
                                                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>PILOTO AL MANDO</span>
                                                    <span style={{ color: '#ffffff', fontWeight: 600 }}>{m.pilot || 'Sin asignar'}</span>
                                                </div>
                                                <div>
                                                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>OFICIAL TÁCTICO (TFO)</span>
                                                    <span style={{ color: '#ffffff', fontWeight: 600 }}>{m.tfo || 'Sin asignar'}</span>
                                                </div>
                                                <div>
                                                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>ZONA DE VUELO</span>
                                                    <span style={{ color: '#38bdf8', fontWeight: 600 }}>{m.zone || 'Metropolitana'}</span>
                                                </div>
                                                <div>
                                                    <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.72rem' }}>ALTITUD OPERATIVA</span>
                                                    <span style={{ color: '#fbbf24', fontWeight: 600 }}>{m.altitude || '1500 FT'}</span>
                                                </div>
                                            </div>

                                            {m.objective && (
                                                <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: '0 0 0.5rem 0', lineHeight: 1.4 }}>
                                                    <strong style={{ color: '#94a3b8' }}>Objetivo:</strong> {m.objective}
                                                </p>
                                            )}

                                            {m.notes && (
                                                <p style={{ color: '#94a3b8', fontSize: '0.8rem', fontStyle: 'italic', margin: 0 }}>
                                                    <strong>Notas:</strong> {m.notes}
                                                </p>
                                            )}
                                        </div>

                                        <div style={{
                                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                            marginTop: '0.75rem',
                                            paddingTop: '0.5rem',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            fontSize: '0.75rem',
                                            color: '#64748b'
                                        }}>
                                            <span>Equipamiento: {m.equipment || 'Estándar'}</span>
                                            <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: FLIGHT LOGBOOK */}
            {activeTab === 'logbook' && (
                <div>
                    {filteredLogs.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '3rem',
                            background: 'rgba(15, 23, 42, 0.5)',
                            borderRadius: '12px',
                            border: '1px dashed rgba(255, 255, 255, 0.15)',
                            color: '#94a3b8'
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📖</div>
                            <p style={{ margin: 0, fontSize: '1rem' }}>
                                {language === 'es' ? 'No se han registrado vuelos en la bitácora.' : 'No flights logged yet.'}
                            </p>
                        </div>
                    ) : (
                        <div style={{
                            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                        }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(255, 255, 255, 0.15)', color: '#94a3b8' }}>
                                        <th style={{ padding: '0.9rem 1rem' }}>INDICATIVO / AERONAVE</th>
                                        <th style={{ padding: '0.9rem 1rem' }}>TRIPULACIÓN (PILOTO / TFO)</th>
                                        <th style={{ padding: '0.9rem 1rem' }}>TIPO DE VUELO</th>
                                        <th style={{ padding: '0.9rem 1rem' }}>HORARIOS</th>
                                        <th style={{ padding: '0.9rem 1rem' }}>INCIDENTE</th>
                                        <th style={{ padding: '0.9rem 1rem' }}>RESUMEN OPERACIONAL</th>
                                        <th style={{ padding: '0.9rem 1rem', textAlign: 'right' }}>ACCIONES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.map((log) => (
                                        <tr
                                            key={log.id}
                                            style={{
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 700, color: '#38bdf8' }}>{log.callsign}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{log.aircraft}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ color: '#ffffff', fontWeight: 600 }}>👨‍✈️ {log.pilot}</div>
                                                {log.tfo && <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>🎯 TFO: {log.tfo}</div>}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{
                                                    background: 'rgba(14, 165, 233, 0.15)',
                                                    color: '#38bdf8',
                                                    border: '1px solid rgba(14, 165, 233, 0.3)',
                                                    borderRadius: '6px',
                                                    padding: '0.2rem 0.5rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600
                                                }}>
                                                    {log.flightType}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', color: '#cbd5e1', fontSize: '0.82rem' }}>
                                                <div>🛫 Salida: <strong>{log.departureTime || '--:--'}</strong></div>
                                                <div>🛬 Llegada: <strong>{log.arrivalTime || '--:--'}</strong></div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                {log.incidentNumber ? (
                                                    <span style={{
                                                        background: 'rgba(245, 158, 11, 0.15)',
                                                        color: '#fbbf24',
                                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                                        borderRadius: '6px',
                                                        padding: '0.2rem 0.5rem',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700
                                                    }}>
                                                        {log.incidentNumber}
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#64748b', fontSize: '0.78rem' }}>N/A</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '1rem', color: '#cbd5e1', maxWidth: '300px', lineHeight: 1.4 }}>
                                                {log.summary}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
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
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: FLEET & HANGAR */}
            {activeTab === 'fleet' && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
                        {fleet.map((ac) => {
                            const statusColor = ac.status === 'Operativo' ? '#10b981' : ac.status === 'En Vuelo' ? '#0ea5e9' : ac.status === 'Mantenimiento' ? '#ef4444' : '#f59e0b';

                            return (
                                <div
                                    key={ac.id}
                                    style={{
                                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.75), rgba(15, 23, 42, 0.9))',
                                        border: `1px solid ${statusColor}40`,
                                        borderRadius: '14px',
                                        padding: '1.5rem',
                                        boxShadow: '0 8px 25px rgba(0,0,0,0.35)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '44px',
                                                    height: '44px',
                                                    borderRadius: '10px',
                                                    background: 'rgba(14, 165, 233, 0.15)',
                                                    border: '1px solid rgba(14, 165, 233, 0.3)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.4rem'
                                                }}>
                                                    🚁
                                                </div>
                                                <div>
                                                    <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.15rem', fontWeight: 800 }}>
                                                        {ac.callsign}
                                                    </h3>
                                                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                                        Matrícula: {ac.tailNumber}
                                                    </span>
                                                </div>
                                            </div>

                                            <select
                                                value={ac.status}
                                                onChange={(e) => handleUpdateAircraftStatus(ac.id, e.target.value, undefined)}
                                                style={{
                                                    background: 'rgba(15, 23, 42, 0.9)',
                                                    border: `1px solid ${statusColor}`,
                                                    color: statusColor,
                                                    borderRadius: '8px',
                                                    padding: '0.35rem 0.6rem',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <option value="Operativo">● Operativo</option>
                                                <option value="En Vuelo">● En Vuelo</option>
                                                <option value="Standby">● Standby</option>
                                                <option value="Mantenimiento">● Mantenimiento</option>
                                            </select>
                                        </div>

                                        <div style={{ color: '#cbd5e1', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                                            Modelo: {ac.model}
                                        </div>

                                        {/* Fuel Meter */}
                                        <div style={{ marginBottom: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                                                <span>Combustible (Jet-A)</span>
                                                <span style={{ fontWeight: 700, color: ac.fuelLevel > 50 ? '#34d399' : ac.fuelLevel > 25 ? '#fbbf24' : '#f87171' }}>
                                                    {ac.fuelLevel}%
                                                </span>
                                            </div>
                                            <div style={{ width: '100%', height: '8px', background: 'rgba(15, 23, 42, 0.8)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{
                                                    width: `${ac.fuelLevel}%`,
                                                    height: '100%',
                                                    background: ac.fuelLevel > 50 ? 'linear-gradient(90deg, #10b981, #34d399)' : ac.fuelLevel > 25 ? 'linear-gradient(90deg, #d97706, #fbbf24)' : '#ef4444',
                                                    borderRadius: '4px'
                                                }}></div>
                                            </div>
                                        </div>

                                        {/* Avionics & Equipment */}
                                        <div style={{ marginBottom: '1rem' }}>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>
                                                Sistemas & Equipamiento Táctico
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {ac.equipment?.map((eq, i) => (
                                                    <span key={i} style={{
                                                        background: 'rgba(255, 255, 255, 0.06)',
                                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                                        borderRadius: '6px',
                                                        padding: '0.2rem 0.5rem',
                                                        fontSize: '0.75rem',
                                                        color: '#e2e8f0'
                                                    }}>
                                                        ✓ {eq}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{
                                        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                        paddingTop: '0.75rem',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontSize: '0.78rem',
                                        color: '#64748b'
                                    }}>
                                        <span>Última revisión: {ac.lastMaintenance}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newF = prompt('Nuevo porcentaje de combustible (0-100):', ac.fuelLevel);
                                                if (newF !== null && !isNaN(newF)) {
                                                    handleUpdateAircraftStatus(ac.id, undefined, Math.min(100, Math.max(0, parseInt(newF, 10))));
                                                }
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: '1px solid rgba(255,255,255,0.15)',
                                                borderRadius: '6px',
                                                color: '#cbd5e1',
                                                padding: '0.2rem 0.5rem',
                                                cursor: 'pointer',
                                                fontSize: '0.75rem'
                                            }}
                                        >
                                            ⛽ Recargar
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 4: ASD ROSTER / CREW */}
            {activeTab === 'roster' && (
                <div>
                    {filteredPersonnel.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '3rem',
                            background: 'rgba(15, 23, 42, 0.5)',
                            borderRadius: '12px',
                            border: '1px dashed rgba(255, 255, 255, 0.15)',
                            color: '#94a3b8'
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👨‍✈️</div>
                            <p style={{ margin: 0, fontSize: '1rem' }}>
                                {language === 'es' ? 'No se encontraron agentes asignados a ASD.' : 'No ASD agents found.'}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                            {filteredPersonnel.map((u) => (
                                <div
                                    key={u.id}
                                    onClick={() => navigate(`/personnel/${u.id}`)}
                                    style={{
                                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.85))',
                                        border: '1px solid rgba(14, 165, 233, 0.25)',
                                        borderRadius: '12px',
                                        padding: '1.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 4px 15px rgba(0,0,0,0.25)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-3px)';
                                        e.currentTarget.style.borderColor = 'rgba(14, 165, 233, 0.6)';
                                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(14, 165, 233, 0.2)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.borderColor = 'rgba(14, 165, 233, 0.25)';
                                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.25)';
                                    }}
                                >
                                    <div style={{
                                        width: '54px',
                                        height: '54px',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        background: '#0f172a',
                                        border: '2px solid rgba(14, 165, 233, 0.5)',
                                        flexShrink: 0
                                    }}>
                                        <img
                                            src={getProfileImage(u.profile_image) || '/logowebp/anon.webp'}
                                            alt={u.apellido}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div style={{ overflow: 'hidden' }}>
                                        <h4 style={{ color: '#f8fafc', fontSize: '0.98rem', fontWeight: 700, margin: '0 0 0.2rem 0' }}>
                                            {u.nombre} {u.apellido}
                                        </h4>
                                        <div style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 600 }}>
                                            {u.rango}
                                        </div>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '0.35rem' }}>
                                            <span style={{
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                color: '#cbd5e1',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '4px',
                                                padding: '0.1rem 0.4rem',
                                                fontSize: '0.72rem',
                                                fontWeight: 700
                                            }}>
                                                #{u.no_placa}
                                            </span>
                                            <span style={{
                                                background: 'rgba(14, 165, 233, 0.2)',
                                                color: '#38bdf8',
                                                borderRadius: '4px',
                                                padding: '0.1rem 0.4rem',
                                                fontSize: '0.72rem',
                                                fontWeight: 700
                                            }}>
                                                ASD
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* MODAL: CREATE / EDIT MISSION */}
            {isMissionModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#0f172a',
                        border: '1px solid rgba(14, 165, 233, 0.3)',
                        borderRadius: '16px',
                        padding: '2rem',
                        maxWidth: '560px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                                {editingMission ? 'Editar Misión Aérea' : 'Nueva Misión Aérea (ASD)'}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsMissionModalOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveMission} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                    Título / Asunto de la Misión
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={missionForm.title}
                                    onChange={(e) => setMissionForm({ ...missionForm, title: e.target.value })}
                                    placeholder="Ej: Cobertura Nocturna & Patrullaje FLIR"
                                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                        Indicativo / Callsign
                                    </label>
                                    <select
                                        value={missionForm.callsign}
                                        onChange={(e) => setMissionForm({ ...missionForm, callsign: e.target.value })}
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    >
                                        <option value="AIR-1">AIR-1</option>
                                        <option value="AIR-2">AIR-2</option>
                                        <option value="AIR-TAC">AIR-TAC</option>
                                        <option value="SPARROW-1">SPARROW-1</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                        Estado Operacional
                                    </label>
                                    <select
                                        value={missionForm.status}
                                        onChange={(e) => setMissionForm({ ...missionForm, status: e.target.value })}
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    >
                                        <option value="En Vuelo">En Vuelo</option>
                                        <option value="Patrulla">Patrulla</option>
                                        <option value="Alerta">Alerta</option>
                                        <option value="Finalizada">Finalizada</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                        Piloto al Mando (PIC)
                                    </label>
                                    <input
                                        type="text"
                                        value={missionForm.pilot}
                                        onChange={(e) => setMissionForm({ ...missionForm, pilot: e.target.value })}
                                        placeholder="Nombre del Piloto"
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                        Oficial Táctico (TFO)
                                    </label>
                                    <input
                                        type="text"
                                        value={missionForm.tfo}
                                        onChange={(e) => setMissionForm({ ...missionForm, tfo: e.target.value })}
                                        placeholder="Nombre del TFO"
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                        Zona Asignada
                                    </label>
                                    <input
                                        type="text"
                                        value={missionForm.zone}
                                        onChange={(e) => setMissionForm({ ...missionForm, zone: e.target.value })}
                                        placeholder="Ej: Los Santos Centro / Vinewood"
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                        Altitud de Vuelo
                                    </label>
                                    <input
                                        type="text"
                                        value={missionForm.altitude}
                                        onChange={(e) => setMissionForm({ ...missionForm, altitude: e.target.value })}
                                        placeholder="Ej: 1500 FT"
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                    Objetivo Operacional
                                </label>
                                <textarea
                                    rows="3"
                                    value={missionForm.objective}
                                    onChange={(e) => setMissionForm({ ...missionForm, objective: e.target.value })}
                                    placeholder="Detalles sobre el objetivo táctico o perimetral..."
                                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsMissionModalOpen(false)}
                                    style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', color: '#94a3b8', padding: '0.65rem 1.25rem', cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 700, padding: '0.65rem 1.5rem', cursor: 'pointer' }}
                                >
                                    {editingMission ? 'Guardar Cambios' : 'Crear Misión'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: CREATE FLIGHT LOG */}
            {isLogModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#0f172a',
                        border: '1px solid rgba(14, 165, 233, 0.3)',
                        borderRadius: '16px',
                        padding: '2rem',
                        maxWidth: '560px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                                Nuevo Registro en Bitácora de Vuelo
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsLogModalOpen(false)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveFlightLog} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                        Indicativo / Callsign
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={logForm.callsign}
                                        onChange={(e) => setLogForm({ ...logForm, callsign: e.target.value })}
                                        placeholder="AIR-1"
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                        Aeronave / Modelo
                                    </label>
                                    <input
                                        type="text"
                                        value={logForm.aircraft}
                                        onChange={(e) => setLogForm({ ...logForm, aircraft: e.target.value })}
                                        placeholder="Polmav AS350"
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                        Piloto al Mando (PIC)
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={logForm.pilot}
                                        onChange={(e) => setLogForm({ ...logForm, pilot: e.target.value })}
                                        placeholder="Nombre del Piloto"
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                        Oficial Táctico (TFO)
                                    </label>
                                    <input
                                        type="text"
                                        value={logForm.tfo}
                                        onChange={(e) => setLogForm({ ...logForm, tfo: e.target.value })}
                                        placeholder="Nombre del TFO"
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                        Hora Salida (HH:MM)
                                    </label>
                                    <input
                                        type="text"
                                        value={logForm.departureTime}
                                        onChange={(e) => setLogForm({ ...logForm, departureTime: e.target.value })}
                                        placeholder="21:30"
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                        Hora Llegada (HH:MM)
                                    </label>
                                    <input
                                        type="text"
                                        value={logForm.arrivalTime}
                                        onChange={(e) => setLogForm({ ...logForm, arrivalTime: e.target.value })}
                                        placeholder="23:15"
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                        Tipo de Vuelo
                                    </label>
                                    <select
                                        value={logForm.flightType}
                                        onChange={(e) => setLogForm({ ...logForm, flightType: e.target.value })}
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    >
                                        <option value="Patrullaje Preventivo">Patrullaje Preventivo</option>
                                        <option value="Persecución Vehicular">Persecución Vehicular</option>
                                        <option value="Apoyo Táctico">Apoyo Táctico</option>
                                        <option value="Búsqueda y Rescate">Búsqueda y Rescate</option>
                                        <option value="Vigilancia FLIR">Vigilancia FLIR</option>
                                        <option value="Entrenamiento / Certificación">Entrenamiento / Certificación</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                        Nº Incidente Relacionado (Opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={logForm.incidentNumber}
                                        onChange={(e) => setLogForm({ ...logForm, incidentNumber: e.target.value })}
                                        placeholder="Ej: INC-8921"
                                        style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem' }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
                                    Resumen Operacional del Vuelo
                                </label>
                                <textarea
                                    rows="3"
                                    required
                                    value={logForm.summary}
                                    onChange={(e) => setLogForm({ ...logForm, summary: e.target.value })}
                                    placeholder="Describa los eventos ocurridos durante el vuelo..."
                                    style={{ width: '100%', background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', color: '#ffffff', padding: '0.65rem 0.9rem', fontSize: '0.88rem', resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsLogModalOpen(false)}
                                    style={{ background: 'transparent', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '8px', color: '#94a3b8', padding: '0.65rem 1.25rem', cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    style={{ background: 'linear-gradient(135deg, #0284c7, #0369a1)', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: 700, padding: '0.65rem 1.5rem', cursor: 'pointer' }}
                                >
                                    Guardar en Bitácora
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AirSupport;
