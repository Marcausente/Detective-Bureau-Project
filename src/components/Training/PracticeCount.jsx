import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { dtpService } from '../../services/dtpService';
import '../../pages/Training/Training.css';

// Roles que pueden apuntar/quitar prácticas en conteo
const ALLOWED_ROLES = ['coordinador', 'comisionado', 'administrador', 'superadmin'];

// Generador de iniciales e identificadores visuales sin consumo de egress
const getAgentInitials = (nombre = '', apellido = '') => {
    const first = (nombre || '').trim()[0] || '';
    const last = (apellido || '').trim()[0] || '';
    return (first + last).toUpperCase() || 'DB';
};

const getAvatarGradient = (str = '') => {
    const gradients = [
        'linear-gradient(135deg, #2b6cb0 0%, #1a365d 100%)',
        'linear-gradient(135deg, #4c51bf 0%, #2c5282 100%)',
        'linear-gradient(135deg, #2c7a7b 0%, #1a202c 100%)',
        'linear-gradient(135deg, #6b46c1 0%, #2b6cb0 100%)',
        'linear-gradient(135deg, #319795 0%, #2b6cb0 100%)'
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
};

function PracticeCount() {
    const [agents, setAgents] = useState([]);
    const [practiceCounts, setPracticeCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const [currentUser, setCurrentUser] = useState(null);
    const [currentUserProfile, setCurrentUserProfile] = useState(null);
    const [canLog, setCanLog] = useState(false);

    // Agente seleccionado para ver su historial e imagen bajo demanda
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [selectedAgentImage, setSelectedAgentImage] = useState(null);
    const [agentLog, setAgentLog] = useState([]);
    const [loadingLog, setLoadingLog] = useState(false);

    // Input de nueva práctica
    const [newPracticeName, setNewPracticeName] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Buscador
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setCurrentUser(session.user);
                const { data: profile } = await supabase
                    .from('users')
                    .select('id, nombre, apellido, rango, rol, no_placa, divisions')
                    .eq('id', session.user.id)
                    .single();
                if (profile) {
                    setCurrentUserProfile(profile);
                    const rolLower = (profile.rol || '').toLowerCase();
                    const isDTP = profile.divisions && profile.divisions.includes('DTP');
                    setCanLog(ALLOWED_ROLES.includes(rolLower) || isDTP);
                }
            }
            await loadAgentsAndCounts();
        };
        init();
    }, []);

    const loadAgentsAndCounts = async () => {
        setLoading(true);
        setError(null);
        try {
            const [{ data: usersData, error: usersError }, countsData] = await Promise.all([
                supabase
                    .from('users')
                    .select('id, nombre, apellido, rango, rol, no_placa, divisions')
                    .order('rango', { ascending: true }),
                dtpService.getPracticeCountsAll()
            ]);

            if (usersError) throw usersError;

            // Filtrar agentes del Detective Bureau
            const bureauAgents = (usersData || []).filter(u =>
                u.divisions && u.divisions.includes('Detective Bureau')
            );

            // Ordenar por conteo descendente, luego por apellido
            bureauAgents.sort((a, b) => {
                const countDiff = (countsData[b.id] || 0) - (countsData[a.id] || 0);
                if (countDiff !== 0) return countDiff;
                return (a.apellido || '').localeCompare(b.apellido || '');
            });

            setAgents(bureauAgents);
            setPracticeCounts(countsData);
        } catch (err) {
            console.error('Error loading agents:', err);
            setError('Error al cargar los agentes.');
        } finally {
            setLoading(false);
        }
    };

    const openAgentDetail = async (agent) => {
        setSelectedAgent(agent);
        setSelectedAgentImage(null);
        setNewPracticeName('');
        setLoadingLog(true);
        try {
            const [log, userImgResult] = await Promise.all([
                dtpService.getPracticeLog(agent.id),
                supabase.from('users').select('profile_image').eq('id', agent.id).single()
            ]);
            setAgentLog(log);
            if (userImgResult?.data?.profile_image) {
                setSelectedAgentImage(userImgResult.data.profile_image);
            }
        } catch (err) {
            console.error('Error loading log:', err);
            setError('Error al cargar el historial del agente.');
        } finally {
            setLoadingLog(false);
        }
    };

    const handleAddPractice = async (e) => {
        e.preventDefault();
        if (!newPracticeName.trim() || !currentUser || !selectedAgent) return;

        setSubmitting(true);
        setError(null);
        try {
            const newEntry = await dtpService.addPracticeLog(
                selectedAgent.id,
                newPracticeName.trim(),
                currentUser.id
            );

            // Actualizar el log del agente
            setAgentLog(prev => [newEntry, ...prev]);

            // Actualizar el contador en la lista
            setPracticeCounts(prev => ({
                ...prev,
                [selectedAgent.id]: (prev[selectedAgent.id] || 0) + 1
            }));

            setNewPracticeName('');
            setSuccessMessage('Práctica apuntada correctamente.');
            setTimeout(() => setSuccessMessage(null), 2500);
        } catch (err) {
            console.error('Error adding practice:', err);
            setError('Error al apuntar la práctica.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteEntry = async (entryId) => {
        if (!window.confirm('¿Eliminar esta entrada del historial?')) return;
        try {
            await dtpService.deletePracticeLog(entryId);
            setAgentLog(prev => prev.filter(e => e.id !== entryId));
            // Decrementar el contador
            setPracticeCounts(prev => ({
                ...prev,
                [selectedAgent.id]: Math.max(0, (prev[selectedAgent.id] || 1) - 1)
            }));
            setSuccessMessage('Entrada eliminada.');
            setTimeout(() => setSuccessMessage(null), 2000);
        } catch (err) {
            console.error('Error deleting entry:', err);
            setError('Error al eliminar la entrada.');
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const filteredAgents = agents.filter(agent => {
        const q = searchQuery.toLowerCase();
        return (
            (agent.nombre || '').toLowerCase().includes(q) ||
            (agent.apellido || '').toLowerCase().includes(q) ||
            (agent.rango || '').toLowerCase().includes(q) ||
            (agent.no_placa || '').toLowerCase().includes(q)
        );
    });

    // ---- RENDER ----
    return (
        <div style={{ animation: 'macFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            {error && (
                <div style={{ color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.85rem 1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', marginBottom: '1.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                    {error}
                </div>
            )}
            {successMessage && (
                <div style={{ color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '0.85rem 1rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '12px', marginBottom: '1.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                    {successMessage}
                </div>
            )}

            {/* Layout de dos columnas: lista de agentes + detalle */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>

                {/* === COLUMNA IZQUIERDA: Lista de Agentes === */}
                <div style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '340px' }}>
                    {/* Buscador */}
                    <div className="dtp-search-pill" style={{ width: '100%', boxSizing: 'border-box' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar agente por nombre..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
                        )}
                    </div>

                    {/* Contador total */}
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '12px',
                        padding: '0.75rem 1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{ color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 600 }}>Agentes en Detective Bureau</span>
                        <span style={{ color: '#93c5fd', fontWeight: 800, fontSize: '1.1rem' }}>{agents.length}</span>
                    </div>

                    {/* Lista de agentes */}
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', color: '#94a3b8', fontSize: '0.88rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '16px', height: '16px', border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                                Cargando agentes...
                            </div>
                        </div>
                    ) : (
                        <div className="custom-scrollbar" style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            maxHeight: 'calc(100vh - 280px)',
                            overflowY: 'auto',
                            paddingRight: '4px'
                        }}>
                            {filteredAgents.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.85rem' }}>
                                    No se encontraron agentes
                                </div>
                            ) : filteredAgents.map(agent => {
                                const count = practiceCounts[agent.id] || 0;
                                const isSelected = selectedAgent?.id === agent.id;
                                return (
                                    <div
                                        key={agent.id}
                                        onClick={() => openAgentDetail(agent)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.8rem',
                                            padding: '0.75rem 0.9rem',
                                            background: isSelected
                                                ? 'rgba(59, 130, 246, 0.22)'
                                                : 'rgba(15, 23, 42, 0.65)',
                                            border: isSelected
                                                ? '1px solid rgba(59, 130, 246, 0.45)'
                                                : '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            backdropFilter: 'blur(16px)'
                                        }}
                                    >
                                        {/* Avatar con iniciales */}
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            flexShrink: 0,
                                            background: getAvatarGradient(agent.apellido || agent.nombre),
                                            border: '1.5px solid rgba(255, 255, 255, 0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#ffffff',
                                            fontWeight: 700,
                                            fontSize: '0.8rem',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
                                        }}>
                                            {getAgentInitials(agent.nombre, agent.apellido)}
                                        </div>

                                        {/* Info del agente */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                color: isSelected ? '#ffffff' : '#f8fafc',
                                                fontWeight: 700,
                                                fontSize: '0.88rem',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {agent.nombre} {agent.apellido}
                                            </div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                                                {agent.rango} {agent.no_placa && <span style={{ color: '#fbbf24', fontFamily: 'monospace' }}>#{agent.no_placa}</span>}
                                            </div>
                                        </div>

                                        {/* Badge de prácticas */}
                                        <div style={{
                                            flexShrink: 0,
                                            minWidth: '28px',
                                            height: '28px',
                                            borderRadius: '8px',
                                            background: count > 0
                                                ? 'rgba(34, 197, 94, 0.18)'
                                                : 'rgba(255,255,255,0.06)',
                                            border: count > 0
                                                ? '1px solid rgba(34, 197, 94, 0.35)'
                                                : '1px solid rgba(255,255,255,0.1)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '0 6px'
                                        }}>
                                            <span style={{
                                                color: count > 0 ? '#4ade80' : '#64748b',
                                                fontWeight: 800,
                                                fontSize: '0.82rem'
                                            }}>
                                                {count}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* === COLUMNA DERECHA: Detalle del Agente === */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {!selectedAgent ? (
                        <div className="dtp-glass-card" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5" style={{ marginBottom: '1rem' }}>
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            <p style={{ color: '#cbd5e1', fontSize: '1rem', fontWeight: 600, margin: 0 }}>
                                Selecciona un agente de la lista para ver su historial de prácticas.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                            {/* Header del agente */}
                            <div className="dtp-glass-card" style={{ padding: '1.25rem 1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                    <div style={{
                                        width: '56px',
                                        height: '56px',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        border: '2px solid rgba(59, 130, 246, 0.5)',
                                        flexShrink: 0,
                                        background: getAvatarGradient(selectedAgent.apellido || selectedAgent.nombre),
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#ffffff',
                                        fontWeight: 800,
                                        fontSize: '1.15rem',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                    }}>
                                        {selectedAgentImage ? (
                                            <img
                                                src={selectedAgentImage}
                                                alt={selectedAgent.apellido}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        ) : (
                                            getAgentInitials(selectedAgent.nombre, selectedAgent.apellido)
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ margin: '0 0 0.25rem 0', color: '#f8fafc', fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                            {selectedAgent.nombre} {selectedAgent.apellido}
                                        </h3>
                                        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>{selectedAgent.rango}</span>
                                            {selectedAgent.no_placa && (
                                                <span style={{
                                                    background: 'rgba(255,255,255,0.08)',
                                                    color: '#fbbf24',
                                                    padding: '0.15rem 0.55rem',
                                                    borderRadius: '6px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 700,
                                                    fontFamily: 'monospace'
                                                }}>
                                                    #{selectedAgent.no_placa}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Total prácticas */}
                                    <div style={{
                                        textAlign: 'center',
                                        background: 'rgba(34, 197, 94, 0.12)',
                                        border: '1px solid rgba(34, 197, 94, 0.3)',
                                        borderRadius: '12px',
                                        padding: '0.65rem 1.25rem',
                                        flexShrink: 0
                                    }}>
                                        <div style={{ color: '#4ade80', fontSize: '1.75rem', fontWeight: 900, lineHeight: 1 }}>
                                            {practiceCounts[selectedAgent.id] || 0}
                                        </div>
                                        <div style={{ color: '#4ade80', fontSize: '0.68rem', marginTop: '0.2rem', fontWeight: 800, letterSpacing: '0.04em' }}>
                                            PRÁCTICAS
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Formulario para apuntar práctica */}
                            {canLog && (
                                <div style={{
                                    background: 'rgba(15, 23, 42, 0.65)',
                                    backdropFilter: 'blur(16px)',
                                    border: '1px solid rgba(59, 130, 246, 0.25)',
                                    borderRadius: '14px',
                                    padding: '1.15rem'
                                }}>
                                    <h4 style={{ margin: '0 0 0.85rem 0', color: '#93c5fd', fontSize: '0.92rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                        Apuntar nueva práctica realizada
                                    </h4>
                                    <form onSubmit={handleAddPractice} style={{ display: 'flex', gap: '0.75rem' }}>
                                        <input
                                            type="text"
                                            placeholder="Ej: Operativo Anti-Pandillas Nivel 1..."
                                            value={newPracticeName}
                                            onChange={e => setNewPracticeName(e.target.value)}
                                            disabled={submitting}
                                            maxLength={200}
                                            style={{ flex: 1, background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '10px', color: '#ffffff', fontSize: '0.85rem', padding: '0.55rem 0.85rem' }}
                                        />
                                        <button
                                            type="submit"
                                            className="dtp-btn-primary"
                                            disabled={submitting || !newPracticeName.trim()}
                                            style={{ whiteSpace: 'nowrap', flexShrink: 0, padding: '0.55rem 1.1rem' }}
                                        >
                                            {submitting ? 'Guardando...' : 'Apuntar'}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* Historial de prácticas */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                                    <h4 style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                        </svg>
                                        Historial de Prácticas
                                    </h4>
                                    <span style={{
                                        background: 'rgba(99, 102, 241, 0.18)',
                                        color: '#a5b4fc',
                                        border: '1px solid rgba(99, 102, 241, 0.3)',
                                        borderRadius: '12px',
                                        padding: '0.15rem 0.65rem',
                                        fontSize: '0.78rem',
                                        fontWeight: 800
                                    }}>
                                        {agentLog.length} entradas
                                    </span>
                                </div>

                                {loadingLog ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', color: '#94a3b8', fontSize: '0.88rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ width: '16px', height: '16px', border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                                            Cargando historial...
                                        </div>
                                    </div>
                                ) : agentLog.length === 0 ? (
                                    <div className="dtp-glass-card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                        <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0 }}>
                                            No hay prácticas registradas en el historial de este agente.
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {agentLog.map((entry, idx) => (
                                            <div
                                                key={entry.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.85rem',
                                                    background: 'rgba(15, 23, 42, 0.65)',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                    borderRadius: '12px',
                                                    padding: '0.75rem 1rem',
                                                    backdropFilter: 'blur(16px)',
                                                    transition: 'border-color 0.2s ease'
                                                }}
                                            >
                                                {/* Número de entrada */}
                                                <div style={{
                                                    flexShrink: 0,
                                                    width: '28px',
                                                    height: '28px',
                                                    borderRadius: '8px',
                                                    background: 'rgba(99, 102, 241, 0.15)',
                                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#a5b4fc',
                                                    fontWeight: 800,
                                                    fontSize: '0.78rem'
                                                }}>
                                                    {agentLog.length - idx}
                                                </div>

                                                {/* Contenido */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        color: '#f8fafc',
                                                        fontWeight: 700,
                                                        fontSize: '0.88rem',
                                                        marginBottom: '0.2rem',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {entry.practice_name}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                        {/* Quién apuntó */}
                                                        <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                                            <strong style={{ color: '#93c5fd' }}>
                                                                {entry.logged_by_user
                                                                    ? `${entry.logged_by_user.rango} ${entry.logged_by_user.apellido}`
                                                                    : 'Desconocido'}
                                                            </strong>
                                                        </span>
                                                        {/* Fecha */}
                                                        <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                            {formatDate(entry.logged_at)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Botón eliminar */}
                                                {canLog && (
                                                    <button
                                                        onClick={() => handleDeleteEntry(entry.id)}
                                                        title="Eliminar entrada"
                                                        style={{
                                                            flexShrink: 0,
                                                            background: 'none',
                                                            border: 'none',
                                                            color: '#64748b',
                                                            cursor: 'pointer',
                                                            padding: '0.35rem',
                                                            borderRadius: '6px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'color 0.2s ease, background 0.2s ease'
                                                        }}
                                                        onMouseEnter={e => {
                                                            e.currentTarget.style.color = '#f87171';
                                                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                                        }}
                                                        onMouseLeave={e => {
                                                            e.currentTarget.style.color = '#64748b';
                                                            e.currentTarget.style.background = 'none';
                                                        }}
                                                    >
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default PracticeCount;
