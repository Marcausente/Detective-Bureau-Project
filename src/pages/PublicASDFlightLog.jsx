import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { getProfileImage } from '../utils/imageStorage';
import '../index.css';

// Default Fallback Pilots if DB not yet loaded
const DEFAULT_PILOTS = [
    { id: 'asd-user-1', nombre: 'Marcus', apellido: 'Miller', callsign: 'AIR-01', avatar: '', status: 'En Servicio' },
    { id: 'asd-user-2', nombre: 'Alex', apellido: 'Ross', callsign: 'AIR-02', avatar: '', status: 'En Servicio' },
    { id: 'asd-user-3', nombre: 'Sarah', apellido: 'Vance', callsign: 'HAWK-1', avatar: '', status: 'En Servicio' },
    { id: 'asd-user-4', nombre: 'David', apellido: 'Connor', callsign: 'EAGLE-3', avatar: '', status: 'En Servicio' },
    { id: 'asd-user-5', nombre: 'James', apellido: 'Carter', callsign: 'AIR-03', avatar: '', status: 'En Servicio' },
    { id: 'asd-user-6', nombre: 'Lucas', apellido: 'Miller', callsign: 'SPARROW-1', avatar: '', status: 'En Prácticas' }
];

// Default Fallback Aircraft Models
const DEFAULT_MODELS = [
    { id: 'model-1', name: 'Maverick', type: 'Helicóptero Ligero / Patrullaje', registration: 'POLMAV-01' },
    { id: 'model-2', 'name': 'SuperVolito Carbon', type: 'Helicóptero Táctico / VIP', registration: 'AIR-TAC-02' },
    { id: 'model-3', name: 'Frogger', type: 'Helicóptero de Apoyo y Rescate', registration: 'RESCUE-03' }
];

// Flight Reason Options
const FLIGHT_REASONS = [
    { id: 'Patrullaje', label: 'Patrullaje Aéreo', icon: '🚁', color: '#38bdf8' },
    { id: '487', label: '487 (Robo de Vehículo)', icon: '🚘', color: '#f59e0b' },
    { id: '207', label: '207 (Secuestro)', icon: '🚨', color: '#ef4444' },
    { id: '215', label: '215 (Carjacking)', icon: '⚠️', color: '#f97316' },
    { id: 'Búsqueda y Localización', label: 'Búsqueda y Localización', icon: '🔍', color: '#06b6d4' },
    { id: 'Operativo', label: 'Operativo Táctico', icon: '🎯', color: '#a855f7' },
    { id: 'Práctica', label: 'Vuelo de Instrucción / Práctica', icon: '🎓', color: '#10b981' },
    { id: 'Otro', label: 'Otro Motivo', icon: '✍️', color: '#94a3b8' }
];

function PublicASDFlightLog() {
    const [pilots, setPilots] = useState(DEFAULT_PILOTS);
    const [models, setModels] = useState(DEFAULT_MODELS);
    const [loadingData, setLoadingData] = useState(true);

    // Form state
    const [selectedPilotId, setSelectedPilotId] = useState('');
    const [selectedModel, setSelectedModel] = useState('Maverick');
    const [selectedReason, setSelectedReason] = useState('Patrullaje');
    const [customReason, setCustomReason] = useState('');
    const [flightDate, setFlightDate] = useState(new Date().toISOString().split('T')[0]);
    const [departureTime, setDepartureTime] = useState('');
    const [landingTime, setLandingTime] = useState('');
    const [notes, setNotes] = useState('');

    // Submission states
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [submittedLog, setSubmittedLog] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        // Ensure standard scrolling on public view
        const prevOverflowY = document.body.style.overflowY;
        const prevHeight = document.body.style.height;
        document.body.style.overflowY = 'auto';
        document.body.style.height = 'auto';

        fetchASDData();

        return () => {
            document.body.style.overflowY = prevOverflowY;
            document.body.style.height = prevHeight;
        };
    }, []);

    // Set initial default times
    useEffect(() => {
        const now = new Date();
        const dep = now.toTimeString().slice(0, 5);
        setDepartureTime(dep);

        const thirtyMinLater = new Date(now.getTime() + 45 * 60000);
        setLandingTime(thirtyMinLater.toTimeString().slice(0, 5));
    }, []);

    const fetchASDData = async () => {
        try {
            setLoadingData(true);

            // Fetch pilots from asd_members
            const { data: dbPilots, error: pErr } = await supabase
                .from('asd_members')
                .select('*')
                .order('created_at', { ascending: true });

            if (!pErr && dbPilots && dbPilots.length > 0) {
                setPilots(dbPilots);
                setSelectedPilotId(dbPilots[0].id);
            } else {
                const saved = localStorage.getItem('asd_members_v2');
                const localPilots = saved ? JSON.parse(saved) : DEFAULT_PILOTS;
                setPilots(localPilots);
                if (localPilots.length > 0) setSelectedPilotId(localPilots[0].id);
            }

            // Fetch aircraft models from asd_aircraft_models
            const { data: dbModels, error: mErr } = await supabase
                .from('asd_aircraft_models')
                .select('*')
                .order('name', { ascending: true });

            if (!mErr && dbModels && dbModels.length > 0) {
                setModels(dbModels);
                setSelectedModel(dbModels[0].name);
            } else {
                const savedM = localStorage.getItem('asd_models_v2');
                const localModels = savedM ? JSON.parse(savedM) : DEFAULT_MODELS;
                setModels(localModels);
                if (localModels.length > 0) setSelectedModel(localModels[0].name);
            }
        } catch (err) {
            console.warn('Fallback loading public ASD data:', err);
        } finally {
            setLoadingData(false);
        }
    };

    // Calculate flight duration in minutes
    const calculateDuration = () => {
        if (!departureTime || !landingTime) return 0;
        const [depH, depM] = departureTime.split(':').map(Number);
        const [lanH, lanM] = landingTime.split(':').map(Number);

        let depMinutes = depH * 60 + depM;
        let lanMinutes = lanH * 60 + lanM;

        if (lanMinutes < depMinutes) {
            lanMinutes += 24 * 60; // Next day midnight wrap
        }

        return lanMinutes - depMinutes;
    };

    const durationMinutes = calculateDuration();

    const formatDuration = (mins) => {
        if (mins <= 0) return '0 min';
        const hours = Math.floor(mins / 60);
        const remMins = mins % 60;
        if (hours === 0) return `${remMins} min`;
        if (remMins === 0) return `${hours} h`;
        return `${hours}h ${remMins}m`;
    };

    const selectedPilotObj = pilots.find(p => p.id === selectedPilotId) || pilots[0];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!selectedPilotId) {
            setErrorMsg('Por favor, selecciona un piloto.');
            return;
        }

        if (!departureTime || !landingTime) {
            setErrorMsg('Por favor, indica la hora de salida y aterrizaje.');
            return;
        }

        if (selectedReason === 'Otro' && !customReason.trim()) {
            setErrorMsg('Por favor, especifica el motivo del vuelo.');
            return;
        }

        setSubmitting(true);

        const newLog = {
            id: 'flight-' + Date.now(),
            pilot_id: selectedPilotObj?.id || null,
            pilot_name: `${selectedPilotObj?.nombre || ''} ${selectedPilotObj?.apellido || ''}`.trim(),
            pilot_callsign: selectedPilotObj?.callsign || 'N/A',
            aircraft_model: selectedModel,
            reason: selectedReason,
            reason_other: selectedReason === 'Otro' ? customReason.trim() : null,
            date: flightDate,
            departure_time: departureTime,
            landing_time: landingTime,
            duration_minutes: durationMinutes,
            notes: notes.trim() || null,
            status: 'Pendiente',
            created_at: new Date().toISOString()
        };

        try {
            const { error } = await supabase
                .from('asd_flight_logs')
                .insert([newLog]);

            if (error) {
                console.warn('Supabase flight log insert fallback:', error);
                // Also save to localStorage fallback so it isn't lost
                const existing = JSON.parse(localStorage.getItem('asd_flight_logs_v2') || '[]');
                localStorage.setItem('asd_flight_logs_v2', JSON.stringify([newLog, ...existing]));
            }

            setSubmittedLog(newLog);
            setSubmitted(true);
        } catch (err) {
            console.error('Error submitting flight log:', err);
            const existing = JSON.parse(localStorage.getItem('asd_flight_logs_v2') || '[]');
            localStorage.setItem('asd_flight_logs_v2', JSON.stringify([newLog, ...existing]));
            setSubmittedLog(newLog);
            setSubmitted(true);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        setSubmitted(false);
        setSubmittedLog(null);
        setNotes('');
        setCustomReason('');
        setSelectedReason('Patrullaje');
        const now = new Date();
        setDepartureTime(now.toTimeString().slice(0, 5));
        setLandingTime(new Date(now.getTime() + 45 * 60000).toTimeString().slice(0, 5));
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(ellipse at top, #0f172a 0%, #020617 100%)',
            color: '#f8fafc',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
            padding: '2rem 1rem 4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflowX: 'hidden'
        }}>
            {/* Background Ambient Glows (iOS Aurora Style) */}
            <div style={{
                position: 'fixed',
                top: '-15%',
                left: '20%',
                width: '550px',
                height: '550px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(2, 132, 199, 0.25) 0%, rgba(2, 132, 199, 0) 70%)',
                filter: 'blur(70px)',
                pointerEvents: 'none',
                zIndex: 0
            }} />
            <div style={{
                position: 'fixed',
                bottom: '-15%',
                right: '15%',
                width: '500px',
                height: '500px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(56, 189, 248, 0) 70%)',
                filter: 'blur(80px)',
                pointerEvents: 'none',
                zIndex: 0
            }} />

            {/* Main Form Container */}
            <div style={{
                width: '100%',
                maxWidth: '680px',
                position: 'relative',
                zIndex: 1,
                animation: 'fadeIn 0.4s ease-out'
            }}>
                {/* Header Card */}
                <div style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '24px',
                    padding: '1.75rem 2rem',
                    marginBottom: '1.25rem',
                    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '54px',
                            height: '54px',
                            borderRadius: '16px',
                            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.8rem',
                            boxShadow: '0 8px 20px rgba(2, 132, 199, 0.45)',
                            border: '1px solid rgba(255, 255, 255, 0.25)'
                        }}>
                            🚁
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' }}>
                                    Registro de Vuelo ASD
                                </h1>
                                <span style={{
                                    background: 'rgba(2, 132, 199, 0.25)',
                                    color: '#38bdf8',
                                    border: '1px solid rgba(2, 132, 199, 0.5)',
                                    borderRadius: '6px',
                                    padding: '0.15rem 0.5rem',
                                    fontSize: '0.7rem',
                                    fontWeight: 800
                                }}>
                                    AIR SUPPORT
                                </span>
                            </div>
                            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                                Formulario público de control de horas y misiones aéreas
                            </p>
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#34d399',
                        borderRadius: '20px',
                        padding: '0.35rem 0.85rem',
                        fontSize: '0.75rem',
                        fontWeight: 700
                    }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                        <span>Recepción Activa</span>
                    </div>
                </div>

                {/* Main Content Area */}
                {submitted ? (
                    /* iOS Flight Confirmation Screen */
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: '1px solid rgba(2, 132, 199, 0.4)',
                        borderRadius: '28px',
                        padding: '2.5rem 2rem',
                        textAlign: 'center',
                        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <div style={{
                            width: '72px',
                            height: '72px',
                            borderRadius: '50%',
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '2px solid #10b981',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2.2rem',
                            color: '#10b981',
                            margin: '0 auto 1.25rem',
                            boxShadow: '0 0 25px rgba(16, 185, 129, 0.35)'
                        }}>
                            ✓
                        </div>

                        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.5rem' }}>
                            ¡Vuelo Registrado con Éxito!
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 2rem', lineHeight: 1.5 }}>
                            El parte de vuelo ha sido transmitido a la central de Air Support Division para su revisión y cómputo de horas.
                        </p>

                        {/* Summary Pass Card (Apple Wallet Style) */}
                        {submittedLog && (
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                borderRadius: '20px',
                                padding: '1.5rem',
                                maxWidth: '440px',
                                margin: '0 auto 2rem',
                                textAlign: 'left',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                                position: 'relative'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>PILOTO ASIGNADO</div>
                                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                                            {submittedLog.pilot_name}
                                        </div>
                                    </div>
                                    <span style={{
                                        background: 'rgba(2, 132, 199, 0.25)',
                                        color: '#38bdf8',
                                        border: '1px solid rgba(2, 132, 199, 0.5)',
                                        borderRadius: '8px',
                                        padding: '0.25rem 0.65rem',
                                        fontSize: '0.82rem',
                                        fontWeight: 800
                                    }}>
                                        {submittedLog.pilot_callsign}
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>AERONAVE</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#cbd5e1' }}>{submittedLog.aircraft_model}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>MOTIVO</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8' }}>
                                            {submittedLog.reason === 'Otro' ? submittedLog.reason_other : submittedLog.reason}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>HORARIOS</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#cbd5e1' }}>
                                            {submittedLog.departure_time} ➔ {submittedLog.landing_time}
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>TIEMPO DE VUELO</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#34d399' }}>
                                            ⏱️ {formatDuration(submittedLog.duration_minutes)}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.6rem' }}>
                                    ID Registro: #{submittedLog.id} • Fecha: {submittedLog.date}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                            <button
                                type="button"
                                onClick={handleReset}
                                style={{
                                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '14px',
                                    padding: '0.85rem 2rem',
                                    fontSize: '0.92rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 8px 24px rgba(2, 132, 199, 0.45)',
                                    transition: 'all 0.2s'
                                }}
                            >
                                + Rellenar Nuevo Vuelo
                            </button>
                        </div>
                    </div>
                ) : (
                    /* iOS-Style Form Card */
                    <form onSubmit={handleSubmit} style={{
                        background: 'rgba(15, 23, 42, 0.72)',
                        backdropFilter: 'blur(24px)',
                        WebkitBackdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '28px',
                        padding: '2rem',
                        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.55)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.4rem'
                    }}>
                        {errorMsg && (
                            <div style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#f87171',
                                borderRadius: '12px',
                                padding: '0.75rem 1rem',
                                fontSize: '0.85rem',
                                fontWeight: 600
                            }}>
                                ⚠️ {errorMsg}
                            </div>
                        )}

                        {/* SECTION 1: PILOTO ASD */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                                1. Seleccionar Piloto de ASD *
                            </label>

                            <div style={{
                                background: 'rgba(15, 23, 42, 0.85)',
                                border: '1px solid rgba(2, 132, 199, 0.35)',
                                borderRadius: '16px',
                                padding: '0.6rem 0.9rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem'
                            }}>
                                {/* Pilot Mini Avatar */}
                                <div style={{
                                    width: '46px',
                                    height: '46px',
                                    borderRadius: '50%',
                                    overflow: 'hidden',
                                    background: '#0b1120',
                                    border: '2px solid #0284c7',
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.4rem'
                                }}>
                                    {selectedPilotObj?.avatar ? (
                                        <img
                                            src={getProfileImage(selectedPilotObj.avatar, '/logowebp/anon.webp')}
                                            alt={selectedPilotObj.apellido}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={(e) => {
                                                e.currentTarget.onerror = null;
                                                e.currentTarget.src = '/logowebp/anon.webp';
                                            }}
                                        />
                                    ) : (
                                        '👨‍✈️'
                                    )}
                                </div>

                                <div style={{ flex: 1 }}>
                                    <select
                                        value={selectedPilotId}
                                        onChange={(e) => setSelectedPilotId(e.target.value)}
                                        style={{
                                            width: '100%',
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#f8fafc',
                                            fontSize: '1rem',
                                            fontWeight: 700,
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {pilots.map(p => (
                                            <option key={p.id} value={p.id} style={{ background: '#0f172a', color: '#ffffff' }}>
                                                {p.callsign} — {p.nombre} {p.apellido} {p.no_placa ? `(#${p.no_placa})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <div style={{ fontSize: '0.72rem', color: '#38bdf8', marginTop: '2px' }}>
                                        {selectedPilotObj?.status || 'En Servicio'} • Cuadrilla ASD
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: MODELO DE AERONAVE */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                                2. Modelo de Aeronave *
                            </label>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.6rem' }}>
                                {models.map(m => {
                                    const isSelected = selectedModel === m.name;
                                    return (
                                        <div
                                            key={m.id || m.name}
                                            onClick={() => setSelectedModel(m.name)}
                                            style={{
                                                background: isSelected ? 'rgba(2, 132, 199, 0.25)' : 'rgba(15, 23, 42, 0.7)',
                                                border: `1.5px solid ${isSelected ? '#0284c7' : 'rgba(255, 255, 255, 0.1)'}`,
                                                borderRadius: '14px',
                                                padding: '0.75rem 0.9rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
                                                boxShadow: isSelected ? '0 4px 15px rgba(2, 132, 199, 0.25)' : 'none'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontWeight: 800, color: isSelected ? '#38bdf8' : '#f8fafc', fontSize: '0.92rem' }}>
                                                    {m.name}
                                                </span>
                                                {isSelected && <span style={{ color: '#38bdf8', fontSize: '0.85rem' }}>✓</span>}
                                            </div>
                                            {m.type && (
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                                                    {m.type}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* SECTION 3: MOTIVO DEL VUELO */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                                3. Motivo de la Misión / Vuelo *
                            </label>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem', marginBottom: selectedReason === 'Otro' ? '0.75rem' : '0' }}>
                                {FLIGHT_REASONS.map(r => {
                                    const isSelected = selectedReason === r.id;
                                    return (
                                        <button
                                            key={r.id}
                                            type="button"
                                            onClick={() => setSelectedReason(r.id)}
                                            style={{
                                                background: isSelected ? `${r.color}25` : 'rgba(15, 23, 42, 0.65)',
                                                border: `1.5px solid ${isSelected ? r.color : 'rgba(255, 255, 255, 0.08)'}`,
                                                color: isSelected ? '#f8fafc' : '#94a3b8',
                                                borderRadius: '12px',
                                                padding: '0.65rem 0.5rem',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s ease',
                                                fontSize: '0.82rem',
                                                fontWeight: isSelected ? 800 : 600,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <span style={{ fontSize: '1.2rem' }}>{r.icon}</span>
                                            <span>{r.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedReason === 'Otro' && (
                                <div style={{ marginTop: '0.5rem', animation: 'fadeIn 0.2s ease-out' }}>
                                    <input
                                        type="text"
                                        required
                                        value={customReason}
                                        onChange={(e) => setCustomReason(e.target.value)}
                                        placeholder="Especifica el motivo o código de la misión..."
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.9)',
                                            border: '1px solid rgba(2, 132, 199, 0.5)',
                                            borderRadius: '12px',
                                            color: '#ffffff',
                                            padding: '0.75rem 1rem',
                                            fontSize: '0.88rem'
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* SECTION 4: FECHA Y HORAS (iOS TIME PICKER) */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                                4. Fecha y Horarios Operativos *
                            </label>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                <div>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginBottom: '0.25rem', fontWeight: 600 }}>Fecha</span>
                                    <input
                                        type="date"
                                        required
                                        value={flightDate}
                                        onChange={(e) => setFlightDate(e.target.value)}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.85)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '12px',
                                            color: '#ffffff',
                                            padding: '0.65rem 0.75rem',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                </div>

                                <div>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#38bdf8', marginBottom: '0.25rem', fontWeight: 700 }}>Hora Salida</span>
                                    <input
                                        type="time"
                                        required
                                        value={departureTime}
                                        onChange={(e) => setDepartureTime(e.target.value)}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.85)',
                                            border: '1px solid rgba(2, 132, 199, 0.4)',
                                            borderRadius: '12px',
                                            color: '#38bdf8',
                                            fontWeight: 800,
                                            padding: '0.65rem 0.75rem',
                                            fontSize: '0.88rem'
                                        }}
                                    />
                                </div>

                                <div>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#34d399', marginBottom: '0.25rem', fontWeight: 700 }}>Hora Aterrizaje</span>
                                    <input
                                        type="time"
                                        required
                                        value={landingTime}
                                        onChange={(e) => setLandingTime(e.target.value)}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.85)',
                                            border: '1px solid rgba(16, 185, 129, 0.4)',
                                            borderRadius: '12px',
                                            color: '#34d399',
                                            fontWeight: 800,
                                            padding: '0.65rem 0.75rem',
                                            fontSize: '0.88rem'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Auto Flight Duration Pill */}
                            <div style={{
                                marginTop: '0.65rem',
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '10px',
                                padding: '0.5rem 0.85rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.8rem'
                            }}>
                                <span style={{ color: '#94a3b8' }}>Duración calculada de vuelo:</span>
                                <span style={{ color: '#fbbf24', fontWeight: 800 }}>
                                    ⏱️ {formatDuration(durationMinutes)} ({durationMinutes} minutos)
                                </span>
                            </div>
                        </div>

                        {/* SECTION 5: OBSERVACIONES (OPCIONAL) */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.82rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, marginBottom: '0.4rem', letterSpacing: '0.04em' }}>
                                5. Observaciones / Novedades (Opcional)
                            </label>
                            <textarea
                                rows="2"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Incidencias con el helicóptero, apoyo a patrullas en tierra, aterrizaje de emergencia..."
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.85)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '12px',
                                    color: '#ffffff',
                                    padding: '0.75rem 1rem',
                                    fontSize: '0.88rem',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        {/* SUBMIT BUTTON */}
                        <div style={{ marginTop: '0.5rem' }}>
                            <button
                                type="submit"
                                disabled={submitting || loadingData}
                                style={{
                                    width: '100%',
                                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '16px',
                                    padding: '0.95rem 1.5rem',
                                    fontSize: '1rem',
                                    fontWeight: 800,
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 8px 25px rgba(2, 132, 199, 0.45)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {submitting ? (
                                    <>
                                        <div style={{ width: '18px', height: '18px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                        <span>Registrando Vuelo...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>✈️</span>
                                        <span>Enviar Registro de Vuelo</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default PublicASDFlightLog;
