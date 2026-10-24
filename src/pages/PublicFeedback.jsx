import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import '../index.css';

const FEEDBACK_TYPES = [
    {
        id: 'Positivo',
        label: 'Positivo',
        desc: 'Reconocimiento, mérito, profesionalismo o apoyo destacado.',
        icon: '🌟',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.15)',
        border: 'rgba(16, 185, 129, 0.45)'
    },
    {
        id: 'Negativo',
        label: 'Negativo',
        desc: 'Conducta deficiente, negligencia o falta de coordinación.',
        icon: '⚠️',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        border: 'rgba(239, 68, 68, 0.45)'
    },
    {
        id: 'Mixto',
        label: 'Mixto',
        desc: 'Aspectos positivos combinados con áreas críticas de mejora.',
        icon: '⚖️',
        color: '#38bdf8',
        bg: 'rgba(56, 189, 248, 0.15)',
        border: 'rgba(56, 189, 248, 0.45)'
    }
];

export default function PublicFeedback() {
    const navigate = useNavigate();
    const { isLSSD, branding } = useTheme();

    const [authorName, setAuthorName] = useState('');
    const [targetAgentName, setTargetAgentName] = useState('');
    const [feedbackType, setFeedbackType] = useState('Positivo');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [motivo, setMotivo] = useState('');

    // Fichas Evaluativas Autocomplete State
    const [existingFichas, setExistingFichas] = useState([]);
    const [loadingFichas, setLoadingFichas] = useState(true);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const autocompleteRef = useRef(null);

    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        // Enable scrolling
        const prevOverflowY = document.body.style.overflowY;
        const prevHeight = document.body.style.height;
        document.body.style.overflowY = 'auto';
        document.body.style.height = 'auto';

        loadInitialData();

        // Close autocomplete when clicking outside
        const handleClickOutside = (e) => {
            if (autocompleteRef.current && !autocompleteRef.current.contains(e.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.body.style.overflowY = prevOverflowY;
            document.body.style.height = prevHeight;
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const loadInitialData = async () => {
        try {
            // If user is currently signed in, prefill author name
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profile } = await supabase
                    .from('users')
                    .select('nombre, apellido, no_placa')
                    .eq('id', session.user.id)
                    .single();
                if (profile) {
                    setAuthorName(`${profile.nombre || ''} ${profile.apellido || ''}`.trim());
                }
            }

            await loadExistingFichas();
        } catch (err) {
            console.warn('Error loading initial data:', err);
        }
    };

    const loadExistingFichas = async () => {
        try {
            setLoadingFichas(true);
            let fichasList = [];

            // 1. Try RPC get_feedback_fichas
            const { data: rpcData, error: rpcErr } = await supabase.rpc('get_feedback_fichas');
            if (!rpcErr && rpcData && rpcData.length > 0) {
                fichasList = rpcData.map(r => ({
                    name: r.agent_name,
                    count: Number(r.feedbacks_count || 0),
                    positives: Number(r.positives_count || 0),
                    negatives: Number(r.negatives_count || 0),
                    mixed: Number(r.mixed_count || 0),
                    lastDate: r.last_feedback
                }));
            } else {
                // 2. Direct query fallback
                const { data: fbData } = await supabase
                    .from('agent_feedbacks')
                    .select('target_name, tipo, fecha');

                if (fbData && fbData.length > 0) {
                    const map = {};
                    fbData.forEach(item => {
                        const name = (item.target_name || '').trim();
                        if (!name) return;
                        if (!map[name]) {
                            map[name] = { name, count: 0, positives: 0, negatives: 0, mixed: 0, lastDate: item.fecha };
                        }
                        map[name].count += 1;
                        if (item.tipo === 'Positivo') map[name].positives += 1;
                        else if (item.tipo === 'Negativo') map[name].negatives += 1;
                        else if (item.tipo === 'Mixto') map[name].mixed += 1;
                    });
                    fichasList = Object.values(map);
                } else {
                    // 3. Fallback to app_settings
                    const { data: settingData } = await supabase
                        .from('app_settings')
                        .select('value')
                        .eq('key', 'agent_feedbacks')
                        .single();

                    if (settingData?.value) {
                        const items = typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value;
                        if (Array.isArray(items)) {
                            const map = {};
                            items.forEach(item => {
                                const name = (item.target_name || item.target_agent_name || '').trim();
                                if (!name) return;
                                if (!map[name]) {
                                    map[name] = { name, count: 0, positives: 0, negatives: 0, mixed: 0, lastDate: item.fecha };
                                }
                                map[name].count += 1;
                                const t = (item.tipo || item.feedback_type || '').toLowerCase();
                                if (t === 'positivo') map[name].positives += 1;
                                else if (t === 'negativo') map[name].negatives += 1;
                                else if (t === 'mixto') map[name].mixed += 1;
                            });
                            fichasList = Object.values(map);
                        }
                    }
                }
            }

            fichasList.sort((a, b) => a.name.localeCompare(b.name));
            setExistingFichas(fichasList);
        } catch (err) {
            console.warn('Error fetching existing fichas:', err);
        } finally {
            setLoadingFichas(false);
        }
    };

    // Filter suggestions based on typed text
    const filteredSuggestions = useMemo(() => {
        const q = targetAgentName.trim().toLowerCase();
        if (!q) {
            return existingFichas.slice(0, 8);
        }
        return existingFichas.filter(f => f.name.toLowerCase().includes(q));
    }, [existingFichas, targetAgentName]);

    // Check if the current typed name exactly matches an existing ficha
    const matchedFicha = useMemo(() => {
        const q = targetAgentName.trim().toLowerCase();
        if (!q) return null;
        return existingFichas.find(f => f.name.toLowerCase() === q) || null;
    }, [existingFichas, targetAgentName]);

    const isExistingFicha = Boolean(matchedFicha);

    const handleSelectFicha = (fichaName) => {
        setTargetAgentName(fichaName);
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
    };

    const handleKeyDown = (e) => {
        if (!isDropdownOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsDropdownOpen(true);
            }
            return;
        }

        const maxIndex = filteredSuggestions.length - 1;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < maxIndex ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : maxIndex));
        } else if (e.key === 'Enter') {
            if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
                e.preventDefault();
                handleSelectFicha(filteredSuggestions[highlightedIndex].name);
            } else {
                setIsDropdownOpen(false);
            }
        } else if (e.key === 'Escape') {
            setIsDropdownOpen(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!authorName.trim()) {
            setErrorMsg('Por favor, indica tu nombre y apellido.');
            return;
        }

        const finalTargetName = targetAgentName.trim();
        if (!finalTargetName) {
            setErrorMsg('Por favor, indica hacia qué agente va dirigido el feedback.');
            return;
        }

        if (!motivo.trim()) {
            setErrorMsg('Por favor, explica el motivo del feedback.');
            return;
        }

        try {
            setSubmitting(true);

            const payload = {
                id: crypto.randomUUID ? crypto.randomUUID() : `fb-${Date.now()}`,
                tipo: feedbackType,
                author_name: authorName.trim(),
                target_name: finalTargetName,
                target_user_id: null,
                fecha: fecha || new Date().toISOString().split('T')[0],
                motivo: motivo.trim(),
                status: 'Activo',
                created_at: new Date().toISOString()
            };

            // 1. Try inserting to table
            const { error: tblError } = await supabase
                .from('agent_feedbacks')
                .insert([payload]);

            if (tblError) {
                // Fallback to app_settings
                const { data: settingData } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'agent_feedbacks')
                    .single();

                const existing = settingData?.value
                    ? (typeof settingData.value === 'string' ? JSON.parse(settingData.value) : settingData.value)
                    : [];

                await supabase.from('app_settings').upsert({
                    key: 'agent_feedbacks',
                    value: [payload, ...existing],
                    updated_at: new Date().toISOString()
                }, { onConflict: 'key' });
            }

            // Refresh fichas in background so newly created agent is immediately available
            loadExistingFichas();

            setSubmitted(true);
        } catch (err) {
            console.error('Error submitting feedback:', err);
            setErrorMsg('Error al enviar el feedback: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReset = () => {
        setSubmitted(false);
        setFeedbackType('Positivo');
        setTargetAgentName('');
        setMotivo('');
        setFecha(new Date().toISOString().split('T')[0]);
        loadExistingFichas();
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'radial-gradient(circle at 50% 0%, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 1) 100%)',
            color: '#f8fafc',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            padding: '2.5rem 1rem',
            boxSizing: 'border-box'
        }}>
            <div style={{ maxWidth: '680px', margin: '0 auto' }}>
                {/* Header Badge & Title */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        padding: '5px 14px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: '#fbbf24',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: '0.85rem'
                    }}>
                        <span>🏛️</span>
                        <span>Comandancia General • Formulario Oficial</span>
                    </div>

                    <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                        Evaluación & Feedback de Agentes
                    </h1>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.5 }}>
                        Canal oficial y abierto para registrar valoraciones de desempeño, méritos y observaciones de conducta entre agentes.
                    </p>
                </div>

                {/* Submitted Success View */}
                {submitted ? (
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.75)',
                        backdropFilter: 'blur(25px)',
                        border: '1px solid rgba(16, 185, 129, 0.4)',
                        borderRadius: '24px',
                        padding: '2.5rem 2rem',
                        textAlign: 'center',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8)'
                    }}>
                        <div style={{
                            width: '70px',
                            height: '70px',
                            borderRadius: '50%',
                            background: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '2rem',
                            margin: '0 auto 1.25rem auto',
                            color: '#10b981'
                        }}>
                            ✓
                        </div>

                        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc' }}>
                            ¡Feedback Registrado con Éxito!
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '460px', margin: '0 auto 1.75rem auto', lineHeight: 1.5 }}>
                            El feedback hacia <strong>{targetAgentName}</strong> ha sido transmitido directamente a los registros de la <strong>Comandancia General</strong> y al historial del agente en Personal.
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={handleReset}
                                className="login-button btn-secondary"
                                style={{ width: 'auto', padding: '0.6rem 1.6rem', borderRadius: '12px' }}
                            >
                                Enviar Otro Feedback
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/login')}
                                className="login-button"
                                style={{ width: 'auto', padding: '0.6rem 1.6rem', borderRadius: '12px', fontWeight: 700 }}
                            >
                                Acceder al Sistema
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Main Form */
                    <form
                        onSubmit={handleSubmit}
                        style={{
                            background: 'rgba(30, 41, 59, 0.65)',
                            backdropFilter: 'blur(25px)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '24px',
                            padding: '2rem',
                            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8)'
                        }}
                    >
                        {errorMsg && (
                            <div style={{
                                padding: '0.75rem 1rem',
                                borderRadius: '10px',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                color: '#fca5a5',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                marginBottom: '1.5rem'
                            }}>
                                ⚠️ {errorMsg}
                            </div>
                        )}

                        {/* Step 1: Tipo de Feedback */}
                        <div style={{ marginBottom: '1.75rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.65rem' }}>
                                1. Selecciona el Tipo de Feedback
                            </label>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                                {FEEDBACK_TYPES.map(type => {
                                    const isSelected = feedbackType === type.id;
                                    return (
                                        <div
                                            key={type.id}
                                            onClick={() => setFeedbackType(type.id)}
                                            style={{
                                                background: isSelected ? type.bg : 'rgba(15, 23, 42, 0.6)',
                                                border: `2px solid ${isSelected ? type.color : 'rgba(255, 255, 255, 0.1)'}`,
                                                borderRadius: '14px',
                                                padding: '1rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                                                <span style={{ fontSize: '1.4rem' }}>{type.icon}</span>
                                                <input
                                                    type="radio"
                                                    name="feedbackType"
                                                    checked={isSelected}
                                                    onChange={() => setFeedbackType(type.id)}
                                                    style={{ accentColor: type.color }}
                                                />
                                            </div>
                                            <div style={{ fontWeight: 800, color: isSelected ? type.color : '#f8fafc', fontSize: '0.95rem' }}>
                                                {type.label}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem', lineHeight: 1.3 }}>
                                                {type.desc}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Step 2: Autor del Feedback */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.4rem' }}>
                                2. Nombre y Apellido del Agente que rellena el Feedback
                            </label>
                            <input
                                required
                                type="text"
                                placeholder="Ej. John Doe (o tu placa)"
                                value={authorName}
                                onChange={(e) => setAuthorName(e.target.value)}
                                className="form-input"
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.85)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '12px',
                                    color: '#ffffff',
                                    padding: '0.7rem 1rem',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>

                        {/* Step 3: Agente hacia quien va dirigido (Fichas Evaluativas Autocomplete) */}
                        <div style={{ marginBottom: '1.25rem', position: 'relative' }} ref={autocompleteRef}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                                    3. Agente hacia quien va dirigido el Feedback
                                </label>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                    {existingFichas.length} {existingFichas.length === 1 ? 'ficha registrada' : 'fichas registradas'}
                                </span>
                            </div>

                            {/* Autocomplete Input Container */}
                            <div style={{ position: 'relative' }}>
                                <span style={{
                                    position: 'absolute',
                                    left: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: '1rem',
                                    pointerEvents: 'none',
                                    opacity: 0.7
                                }}>
                                    👤
                                </span>

                                <input
                                    required
                                    type="text"
                                    autoComplete="off"
                                    placeholder="Escribe el nombre del agente (ej. Matthew, Matias...)"
                                    value={targetAgentName}
                                    onChange={(e) => {
                                        setTargetAgentName(e.target.value);
                                        setIsDropdownOpen(true);
                                        setHighlightedIndex(-1);
                                    }}
                                    onFocus={() => setIsDropdownOpen(true)}
                                    onKeyDown={handleKeyDown}
                                    className="form-input"
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.85)',
                                        border: `1px solid ${isExistingFicha ? 'rgba(16, 185, 129, 0.6)' : isDropdownOpen ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)'}`,
                                        borderRadius: '12px',
                                        color: '#ffffff',
                                        padding: '0.75rem 2.5rem 0.75rem 2.8rem',
                                        fontSize: '0.92rem',
                                        boxShadow: isDropdownOpen ? '0 0 15px rgba(56, 189, 248, 0.2)' : 'none',
                                        transition: 'all 0.2s ease'
                                    }}
                                />

                                {targetAgentName && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTargetAgentName('');
                                            setIsDropdownOpen(true);
                                        }}
                                        style={{
                                            position: 'absolute',
                                            right: '0.85rem',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'rgba(255, 255, 255, 0.1)',
                                            border: 'none',
                                            color: '#94a3b8',
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '50%',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Autocomplete Dropdown List */}
                            {isDropdownOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 6px)',
                                    left: 0,
                                    right: 0,
                                    zIndex: 50,
                                    background: 'rgba(15, 23, 42, 0.98)',
                                    backdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(56, 189, 248, 0.35)',
                                    borderRadius: '14px',
                                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(56, 189, 248, 0.15)',
                                    maxHeight: '260px',
                                    overflowY: 'auto',
                                    padding: '6px'
                                }}>
                                    <div style={{
                                        padding: '6px 12px 4px 12px',
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        letterSpacing: '0.08em',
                                        color: '#38bdf8',
                                        textTransform: 'uppercase',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                                    }}>
                                        <span>Fichas Evaluativas Existentes</span>
                                        <span>{filteredSuggestions.length} encontradas</span>
                                    </div>

                                    {filteredSuggestions.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                                            {filteredSuggestions.map((ficha, idx) => {
                                                const isHighlighted = idx === highlightedIndex;
                                                const isSelected = matchedFicha?.name.toLowerCase() === ficha.name.toLowerCase();

                                                return (
                                                    <div
                                                        key={ficha.name}
                                                        onClick={() => handleSelectFicha(ficha.name)}
                                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                                        style={{
                                                            padding: '0.6rem 0.85rem',
                                                            borderRadius: '10px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            background: isHighlighted || isSelected
                                                                ? 'linear-gradient(90deg, rgba(56, 189, 248, 0.2) 0%, rgba(30, 41, 59, 0.5) 100%)'
                                                                : 'transparent',
                                                            border: isHighlighted
                                                                ? '1px solid rgba(56, 189, 248, 0.4)'
                                                                : '1px solid transparent',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                borderRadius: '8px',
                                                                background: 'rgba(56, 189, 248, 0.15)',
                                                                color: '#38bdf8',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontWeight: 800,
                                                                fontSize: '0.85rem'
                                                            }}>
                                                                {ficha.name[0]?.toUpperCase() || 'A'}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc' }}>
                                                                    {ficha.name}
                                                                </div>
                                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                                    Ficha activa • {ficha.count} {ficha.count === 1 ? 'evaluación' : 'evaluaciones'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            {ficha.positives > 0 && (
                                                                <span style={{ fontSize: '0.7rem', color: '#4ade80', background: 'rgba(16, 185, 129, 0.15)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                                                    +{ficha.positives}
                                                                </span>
                                                            )}
                                                            {ficha.negatives > 0 && (
                                                                <span style={{ fontSize: '0.7rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                                                    -{ficha.negatives}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '0.85rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem' }}>
                                            No hay ninguna ficha previa con "{targetAgentName}"
                                        </div>
                                    )}

                                    {/* Option to create new Ficha if text typed doesn't match an exact ficha */}
                                    {targetAgentName.trim().length > 0 && !isExistingFicha && (
                                        <div
                                            onClick={() => {
                                                setIsDropdownOpen(false);
                                            }}
                                            style={{
                                                marginTop: '4px',
                                                padding: '0.65rem 0.85rem',
                                                borderRadius: '10px',
                                                background: 'rgba(245, 158, 11, 0.12)',
                                                border: '1px dashed rgba(245, 158, 11, 0.45)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}
                                        >
                                            <span style={{ fontSize: '1rem' }}>✨</span>
                                            <div>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#fbbf24' }}>
                                                    Crear nueva ficha evaluativa para "{targetAgentName.trim()}"
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>
                                                    Se creará automáticamente en el sistema al enviar el informe.
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Informative Status Badge below input */}
                            {targetAgentName.trim().length > 0 && (
                                <div style={{ marginTop: '0.5rem' }}>
                                    {isExistingFicha ? (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            background: 'rgba(16, 185, 129, 0.12)',
                                            border: '1px solid rgba(16, 185, 129, 0.35)',
                                            borderRadius: '8px',
                                            padding: '0.45rem 0.85rem',
                                            fontSize: '0.78rem',
                                            color: '#86efac'
                                        }}>
                                            <span>🟢</span>
                                            <span>
                                                <strong>Ficha Evaluativa Existente:</strong> Este informe se acumulará al historial y balance de <strong>{matchedFicha.name}</strong> ({matchedFicha.count} evaluaciones acumuladas).
                                            </span>
                                        </div>
                                    ) : (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            background: 'rgba(245, 158, 11, 0.1)',
                                            border: '1px solid rgba(245, 158, 11, 0.35)',
                                            borderRadius: '8px',
                                            padding: '0.45rem 0.85rem',
                                            fontSize: '0.78rem',
                                            color: '#fde047'
                                        }}>
                                            <span>✨</span>
                                            <span>
                                                <strong>Nueva Ficha Evaluativa:</strong> Aún no existe ficha previa para <strong>"{targetAgentName.trim()}"</strong>. Su ficha se creará automáticamente al enviar el informe.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Step 4: Fecha del Feedback */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.4rem' }}>
                                4. Fecha del Suceso o Feedback
                            </label>
                            <input
                                required
                                type="date"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                                className="form-input"
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.85)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '12px',
                                    color: '#ffffff',
                                    padding: '0.7rem 1rem',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>

                        {/* Step 5: Motivo */}
                        <div style={{ marginBottom: '1.75rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.4rem' }}>
                                5. Motivo y Observaciones Detalladas
                            </label>
                            <textarea
                                required
                                rows={5}
                                placeholder="Describe detalladamente los hechos, actuación, intervención o conducta observada..."
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                                className="form-input"
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.85)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '12px',
                                    color: '#ffffff',
                                    padding: '0.85rem',
                                    fontSize: '0.9rem',
                                    lineHeight: 1.5,
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="login-button"
                            style={{
                                width: '100%',
                                padding: '0.85rem',
                                borderRadius: '14px',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                background: feedbackType === 'Negativo'
                                    ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
                                    : feedbackType === 'Mixto'
                                        ? 'linear-gradient(135deg, #0284c7, #0369a1)'
                                        : 'linear-gradient(135deg, #10b981, #059669)',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                            }}
                        >
                            {submitting ? 'Transmitiendo Feedback...' : `Enviar Feedback ${feedbackType}`}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
