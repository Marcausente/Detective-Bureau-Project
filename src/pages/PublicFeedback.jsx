import { useState, useEffect } from 'react';
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
    const [targetAgentId, setTargetAgentId] = useState('');
    const [targetAgentName, setTargetAgentName] = useState('');
    const [feedbackType, setFeedbackType] = useState('Positivo');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [motivo, setMotivo] = useState('');

    const [availableAgents, setAvailableAgents] = useState([]);
    const [loadingAgents, setLoadingAgents] = useState(true);
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

        return () => {
            document.body.style.overflowY = prevOverflowY;
            document.body.style.height = prevHeight;
        };
    }, []);

    const loadInitialData = async () => {
        try {
            setLoadingAgents(true);

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

            // Fetch agents list for targets dropdown
            const { data: agentList } = await supabase
                .from('users')
                .select('id, nombre, apellido, no_placa, rango, profile_image')
                .order('nombre', { ascending: true });

            if (agentList) setAvailableAgents(agentList);
        } catch (err) {
            console.warn('Error fetching agents:', err);
        } finally {
            setLoadingAgents(false);
        }
    };

    const handleTargetSelect = (e) => {
        const val = e.target.value;
        setTargetAgentId(val);
        const agent = availableAgents.find(a => a.id === val);
        if (agent) {
            setTargetAgentName(`${agent.no_placa ? `[#${agent.no_placa}] ` : ''}${agent.nombre} ${agent.apellido}`.trim());
        } else {
            setTargetAgentName('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!authorName.trim()) {
            setErrorMsg('Por favor, indica tu nombre y apellido.');
            return;
        }

        const finalTargetName = targetAgentName.trim() ||
            (availableAgents.find(a => a.id === targetAgentId)
                ? `${availableAgents.find(a => a.id === targetAgentId).nombre} ${availableAgents.find(a => a.id === targetAgentId).apellido}`
                : '');

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
                target_user_id: targetAgentId || null,
                fecha: fecha || new Date().toISOString().split('T')[0],
                motivo: motivo.trim(),
                status: 'Activo',
                created_at: new Date().toISOString()
            };

            // Try inserting to table
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
        setTargetAgentId('');
        setTargetAgentName('');
        setMotivo('');
        setFecha(new Date().toISOString().split('T')[0]);
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

                        {/* Step 3: Agente hacia quien va dirigido */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc', marginBottom: '0.4rem' }}>
                                3. Agente hacia quien va dirigido el Feedback
                            </label>

                            {availableAgents.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <select
                                        value={targetAgentId}
                                        onChange={handleTargetSelect}
                                        className="form-input custom-select"
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.85)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: '12px',
                                            color: '#ffffff',
                                            padding: '0.7rem 1rem',
                                            fontSize: '0.9rem'
                                        }}
                                    >
                                        <option value="">-- Seleccionar agente de la lista --</option>
                                        {availableAgents.map(ag => (
                                            <option key={ag.id} value={ag.id} style={{ background: '#0f172a' }}>
                                                {ag.no_placa ? `[#${ag.no_placa}] ` : ''}{ag.nombre} {ag.apellido} ({ag.rango || 'Agente'})
                                            </option>
                                        ))}
                                    </select>

                                    <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                        O si no aparece en el selector, escribe su nombre manualmente:
                                    </div>

                                    <input
                                        type="text"
                                        placeholder="Escribir nombre del agente manualmente..."
                                        value={targetAgentName}
                                        onChange={(e) => {
                                            setTargetAgentName(e.target.value);
                                            setTargetAgentId('');
                                        }}
                                        className="form-input"
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.65)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '10px',
                                            color: '#ffffff',
                                            padding: '0.55rem 0.9rem',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                </div>
                            ) : (
                                <input
                                    required
                                    type="text"
                                    placeholder="Nombre, apellido y placa del agente evaluado..."
                                    value={targetAgentName}
                                    onChange={(e) => setTargetAgentName(e.target.value)}
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
