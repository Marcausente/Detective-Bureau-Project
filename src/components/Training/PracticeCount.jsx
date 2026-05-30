import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { dtpService } from '../../services/dtpService';
import '../../pages/Training/Training.css';

// Roles que pueden apuntar prácticas
const ALLOWED_ROLES = ['detective', 'coordinador', 'comisionado', 'administrador', 'superadmin'];

function PracticeCount() {
    const [agents, setAgents] = useState([]);
    const [practiceCounts, setPracticeCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    const [currentUser, setCurrentUser] = useState(null);
    const [currentUserProfile, setCurrentUserProfile] = useState(null);
    const [canLog, setCanLog] = useState(false);

    // Agente seleccionado para ver su historial
    const [selectedAgent, setSelectedAgent] = useState(null);
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
                    .select('id, nombre, apellido, rango, rol, no_placa')
                    .eq('id', session.user.id)
                    .single();
                if (profile) {
                    setCurrentUserProfile(profile);
                    const rolLower = (profile.rol || '').toLowerCase();
                    setCanLog(ALLOWED_ROLES.includes(rolLower));
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
                    .select('id, nombre, apellido, rango, rol, no_placa, profile_image, divisions')
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
        setNewPracticeName('');
        setLoadingLog(true);
        try {
            const log = await dtpService.getPracticeLog(agent.id);
            setAgentLog(log);
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
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {error && <div className="error-message" style={{ marginBottom: '1rem', borderRadius: '8px' }}>{error}</div>}
            {successMessage && <div className="success-message" style={{ marginBottom: '1rem', borderRadius: '8px' }}>{successMessage}</div>}

            {/* Layout de dos columnas: lista de agentes + detalle */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

                {/* === COLUMNA IZQUIERDA: Lista de Agentes === */}
                <div style={{ flex: '0 0 340px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Buscador */}
                    <div style={{ position: 'relative' }}>
                        <svg
                            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#718096' }}
                            width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            className="dtp-input"
                            placeholder="Buscar agente..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{ paddingLeft: '2.5rem' }}
                        />
                    </div>

                    {/* Contador total */}
                    <div style={{
                        background: 'rgba(66, 153, 225, 0.08)',
                        border: '1px solid rgba(66, 153, 225, 0.2)',
                        borderRadius: '10px',
                        padding: '0.8rem 1rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{ color: '#a0aec0', fontSize: '0.9rem' }}>Agentes en el bureau</span>
                        <span style={{ color: '#63b3ed', fontWeight: 700, fontSize: '1.1rem' }}>{agents.length}</span>
                    </div>

                    {/* Lista de agentes */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#a0aec0' }}>
                            Cargando agentes...
                        </div>
                    ) : (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            maxHeight: 'calc(100vh - 320px)',
                            overflowY: 'auto',
                            paddingRight: '4px'
                        }}>
                            {filteredAgents.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: '#718096' }}>
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
                                            padding: '0.9rem 1rem',
                                            background: isSelected
                                                ? 'rgba(66, 153, 225, 0.15)'
                                                : 'rgba(26, 29, 36, 0.7)',
                                            border: isSelected
                                                ? '1px solid rgba(66, 153, 225, 0.4)'
                                                : '1px solid rgba(255, 255, 255, 0.06)',
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            backdropFilter: 'blur(8px)'
                                        }}
                                        onMouseEnter={e => {
                                            if (!isSelected) {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                                            }
                                        }}
                                        onMouseLeave={e => {
                                            if (!isSelected) {
                                                e.currentTarget.style.background = 'rgba(26, 29, 36, 0.7)';
                                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                                            }
                                        }}
                                    >
                                        {/* Avatar */}
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '50%',
                                            overflow: 'hidden',
                                            flexShrink: 0,
                                            border: '2px solid rgba(255,255,255,0.1)'
                                        }}>
                                            <img
                                                src={agent.profile_image || '/anon.png'}
                                                alt={agent.apellido}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        </div>

                                        {/* Info del agente */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                color: '#e2e8f0',
                                                fontWeight: 600,
                                                fontSize: '0.95rem',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}>
                                                {agent.nombre} {agent.apellido}
                                            </div>
                                            <div style={{ color: '#718096', fontSize: '0.8rem' }}>
                                                {agent.rango}
                                            </div>
                                        </div>

                                        {/* Badge de prácticas */}
                                        <div style={{
                                            flexShrink: 0,
                                            minWidth: '32px',
                                            height: '32px',
                                            borderRadius: '8px',
                                            background: count > 0
                                                ? 'rgba(72, 187, 120, 0.15)'
                                                : 'rgba(255,255,255,0.05)',
                                            border: count > 0
                                                ? '1px solid rgba(72, 187, 120, 0.3)'
                                                : '1px solid rgba(255,255,255,0.08)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '0 6px'
                                        }}>
                                            <span style={{
                                                color: count > 0 ? '#9ae6b4' : '#4a5568',
                                                fontWeight: 700,
                                                fontSize: '0.9rem'
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
                            <div style={{ fontSize: '3.5rem', marginBottom: '1rem', opacity: 0.4 }}>👮</div>
                            <p style={{ color: '#718096', fontSize: '1.1rem' }}>
                                Selecciona un agente de la lista para ver su historial de prácticas.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                            {/* Header del agente */}
                            <div className="dtp-glass-card" style={{ padding: '1.5rem 2rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <div style={{
                                        width: '64px',
                                        height: '64px',
                                        borderRadius: '50%',
                                        overflow: 'hidden',
                                        border: '3px solid rgba(66, 153, 225, 0.4)',
                                        flexShrink: 0
                                    }}>
                                        <img
                                            src={selectedAgent.profile_image || '/anon.png'}
                                            alt={selectedAgent.apellido}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ margin: '0 0 0.3rem 0', color: '#e2e8f0', fontSize: '1.5rem', fontWeight: 700 }}>
                                            {selectedAgent.nombre} {selectedAgent.apellido}
                                        </h3>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span style={{ color: '#a0aec0', fontSize: '0.95rem' }}>{selectedAgent.rango}</span>
                                            {selectedAgent.no_placa && (
                                                <span style={{
                                                    background: 'rgba(255,255,255,0.08)',
                                                    color: '#cbd5e0',
                                                    padding: '0.15rem 0.6rem',
                                                    borderRadius: '4px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600
                                                }}>
                                                    #{selectedAgent.no_placa}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {/* Total prácticas */}
                                    <div style={{
                                        textAlign: 'center',
                                        background: 'rgba(72, 187, 120, 0.1)',
                                        border: '1px solid rgba(72, 187, 120, 0.25)',
                                        borderRadius: '12px',
                                        padding: '0.8rem 1.5rem',
                                        flexShrink: 0
                                    }}>
                                        <div style={{ color: '#9ae6b4', fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>
                                            {practiceCounts[selectedAgent.id] || 0}
                                        </div>
                                        <div style={{ color: '#68d391', fontSize: '0.75rem', marginTop: '0.3rem', fontWeight: 500 }}>
                                            PRÁCTICAS
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Formulario para apuntar práctica */}
                            {canLog && (
                                <div style={{
                                    background: 'rgba(66, 153, 225, 0.07)',
                                    border: '1px solid rgba(66, 153, 225, 0.2)',
                                    borderRadius: '12px',
                                    padding: '1.5rem'
                                }}>
                                    <h4 style={{ margin: '0 0 1rem 0', color: '#90cdf4', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                        </svg>
                                        Apuntar nueva práctica
                                    </h4>
                                    <form onSubmit={handleAddPractice} style={{ display: 'flex', gap: '0.8rem' }}>
                                        <input
                                            type="text"
                                            className="dtp-input"
                                            placeholder="Ej: Operativo Anti-Pandillas Nivel 1, Interrogatorio avanzado..."
                                            value={newPracticeName}
                                            onChange={e => setNewPracticeName(e.target.value)}
                                            style={{ flex: 1 }}
                                            disabled={submitting}
                                            maxLength={200}
                                        />
                                        <button
                                            type="submit"
                                            className="dtp-btn-primary"
                                            disabled={submitting || !newPracticeName.trim()}
                                            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                                        >
                                            {submitting ? (
                                                <span>Guardando...</span>
                                            ) : (
                                                <>
                                                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginRight: '6px' }}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    Apuntar
                                                </>
                                            )}
                                        </button>
                                    </form>
                                    <p style={{ margin: '0.6rem 0 0 0', color: '#4a6fa5', fontSize: '0.82rem' }}>
                                        Se registrará como apuntado por: <strong style={{ color: '#63b3ed' }}>{currentUserProfile ? `${currentUserProfile.rango} ${currentUserProfile.apellido}` : '...'}</strong>
                                    </p>
                                </div>
                            )}

                            {/* Historial de prácticas */}
                            <div>
                                <h4 style={{ color: '#e2e8f0', fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <svg width="20" height="20" fill="none" stroke="#9f7aea" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    Historial de Prácticas
                                    <span style={{
                                        background: 'rgba(159, 122, 234, 0.15)',
                                        color: '#d6bcfa',
                                        border: '1px solid rgba(159, 122, 234, 0.3)',
                                        borderRadius: '20px',
                                        padding: '0.1rem 0.7rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 600
                                    }}>
                                        {agentLog.length}
                                    </span>
                                </h4>

                                {loadingLog ? (
                                    <div style={{ textAlign: 'center', padding: '3rem', color: '#a0aec0' }}>
                                        Cargando historial...
                                    </div>
                                ) : agentLog.length === 0 ? (
                                    <div className="dtp-glass-card" style={{ textAlign: 'center', padding: '3rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
                                        <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem', opacity: 0.4 }}>📋</div>
                                        <p style={{ color: '#718096', fontSize: '0.95rem' }}>
                                            No hay prácticas registradas para este agente.
                                        </p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        {agentLog.map((entry, idx) => (
                                            <div
                                                key={entry.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '1rem',
                                                    background: 'rgba(26, 29, 36, 0.7)',
                                                    border: '1px solid rgba(255, 255, 255, 0.06)',
                                                    borderRadius: '10px',
                                                    padding: '1rem 1.2rem',
                                                    backdropFilter: 'blur(8px)',
                                                    animation: 'fadeIn 0.3s ease-out',
                                                    transition: 'border-color 0.2s ease'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
                                                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'}
                                            >
                                                {/* Número de entrada */}
                                                <div style={{
                                                    flexShrink: 0,
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    background: 'rgba(159, 122, 234, 0.15)',
                                                    border: '1px solid rgba(159, 122, 234, 0.25)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#d6bcfa',
                                                    fontWeight: 700,
                                                    fontSize: '0.85rem'
                                                }}>
                                                    {agentLog.length - idx}
                                                </div>

                                                {/* Contenido */}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        color: '#e2e8f0',
                                                        fontWeight: 600,
                                                        fontSize: '0.95rem',
                                                        marginBottom: '0.3rem',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {entry.practice_name}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                        {/* Quién apuntó */}
                                                        <span style={{ color: '#718096', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                            <svg width="13" height="13" fill="none" stroke="#63b3ed" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                            <span style={{ color: '#63b3ed' }}>
                                                                {entry.logged_by_user
                                                                    ? `${entry.logged_by_user.rango} ${entry.logged_by_user.apellido}`
                                                                    : 'Desconocido'}
                                                            </span>
                                                        </span>
                                                        {/* Fecha */}
                                                        <span style={{ color: '#4a5568', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                            <svg width="13" height="13" fill="none" stroke="#4a5568" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                            </svg>
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
                                                            color: '#4a5568',
                                                            cursor: 'pointer',
                                                            padding: '0.4rem',
                                                            borderRadius: '6px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'color 0.2s ease, background 0.2s ease'
                                                        }}
                                                        onMouseEnter={e => {
                                                            e.currentTarget.style.color = '#fc8181';
                                                            e.currentTarget.style.background = 'rgba(229, 62, 62, 0.1)';
                                                        }}
                                                        onMouseLeave={e => {
                                                            e.currentTarget.style.color = '#4a5568';
                                                            e.currentTarget.style.background = 'none';
                                                        }}
                                                    >
                                                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
