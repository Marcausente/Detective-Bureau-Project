import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

function CoordinationSanctions() {
    const { t } = useLanguage();
    const [sanctions, setSanctions] = useState([]);
    const [agents, setAgents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);

    // Form State for new sanction entry
    const [selectedUserId, setSelectedUserId] = useState('');
    const [sanctionType, setSanctionType] = useState('Aviso');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadSanctions();
        loadAgents();
    }, []);

    const loadAgents = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, nombre, apellido, rango, no_placa, divisions, profile_image')
                .order('rango');

            if (error) throw error;

            // Filter agents in Detective Bureau or display all active agents
            const dbAgents = (data || []).filter(u => {
                if (!u.divisions || u.divisions.length === 0) return true;
                return u.divisions.includes('Detective Bureau');
            });

            setAgents(dbAgents.length > 0 ? dbAgents : (data || []));
        } catch (err) {
            console.error('Error loading agents:', err);
        }
    };

    const loadSanctions = async () => {
        try {
            setLoading(true);
            // 1. Try fetching via RPC
            const { data, error } = await supabase.rpc('get_coordination_sanctions');

            if (error) {
                // Fallback to table query if RPC is not deployed yet
                const { data: tableData } = await supabase
                    .from('coordination_sanctions')
                    .select('*')
                    .order('created_at', { ascending: false });

                setSanctions(tableData || []);
            } else {
                setSanctions(data || []);
            }
        } catch (err) {
            console.error('Error loading sanctions:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSanction = async (e) => {
        e.preventDefault();
        if (!selectedUserId) {
            alert('Por favor selecciona un agente de la Detective Bureau.');
            return;
        }
        if (!reason.trim()) {
            alert('Por favor especifica el motivo u observaciones de la sanción.');
            return;
        }

        setSubmitting(true);
        try {
            // Attempt creation via RPC
            const { error: rpcError } = await supabase.rpc('create_coordination_sanction', {
                p_user_id: selectedUserId,
                p_sanction_type: sanctionType,
                p_reason: reason.trim()
            });

            if (rpcError) {
                // Fallback direct insert if RPC not run yet
                const agent = agents.find(a => a.id === selectedUserId);
                const { data: authData } = await supabase.auth.getUser();

                const { error: insertError } = await supabase.from('coordination_sanctions').insert([
                    {
                        user_id: selectedUserId,
                        agent_name: agent ? `${agent.rango ? agent.rango + ' ' : ''}${agent.nombre} ${agent.apellido}` : 'Agente',
                        badge_no: agent ? agent.no_placa : null,
                        sanction_type: sanctionType,
                        reason: reason.trim(),
                        created_by: authData?.user?.id || null
                    }
                ]);
                if (insertError) throw insertError;
            }

            setSelectedUserId('');
            setReason('');
            setSanctionType('Aviso');
            setShowModal(false);
            loadSanctions();
        } catch (err) {
            alert('Error al registrar la sanción: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteSanction = async (sanctionId) => {
        if (!window.confirm('¿Seguro que deseas eliminar esta sanción del registro de Coordinación?')) return;
        try {
            const { error } = await supabase.rpc('delete_coordination_sanction', { p_sanction_id: sanctionId });
            if (error) {
                // Fallback direct delete
                const { error: delErr } = await supabase.from('coordination_sanctions').delete().eq('id', sanctionId);
                if (delErr) throw delErr;
            }
            loadSanctions();
        } catch (err) {
            alert('Error al eliminar la sanción: ' + err.message);
        }
    };

    const getSanctionBadgeStyle = (type) => {
        switch (type) {
            case 'Aviso':
                return { bg: 'rgba(251, 191, 36, 0.15)', border: 'rgba(251, 191, 36, 0.4)', text: '#fbbf24' };
            case 'Sanción Leve':
                return { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.4)', text: '#f97316' };
            case 'Sanción Media':
                return { bg: 'rgba(234, 88, 12, 0.2)', border: 'rgba(234, 88, 12, 0.4)', text: '#fb923c' };
            case 'Sanción Grave':
                return { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.4)', text: '#f87171' };
            case 'Expulsión':
                return { bg: 'rgba(185, 28, 28, 0.3)', border: 'rgba(220, 38, 38, 0.6)', text: '#ef4444' };
            default:
                return { bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)', text: '#cbd5e1' };
        }
    };

    const filteredSanctions = sanctions.filter(s => 
        (s.agent_name && s.agent_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.badge_no && s.badge_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.reason && s.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.sanction_type && s.sanction_type.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div style={{ width: '100%' }}>
            {/* Controls Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
                    <input
                        type="text"
                        className="mac-form-input"
                        placeholder="Buscar por nombre de agente, placa, tipo de sanción o motivo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '2.5rem' }}
                    />
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                        <circle cx="11" cy="11" r="8"/>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="mac-btn mac-btn-primary"
                    style={{
                        background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                        border: '1px solid rgba(248, 113, 113, 0.4)',
                        boxShadow: '0 4px 15px rgba(239, 68, 68, 0.35)',
                        padding: '0.65rem 1.4rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        <path d="M12 8v4"/>
                        <path d="M12 16h.01"/>
                    </svg>
                    <span>Registrar Sanción</span>
                </button>
            </div>

            {/* Content Display Grid */}
            {loading ? (
                <div className="mac-doc-card" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(16px)' }}>
                    <div className="mac-status-dot" style={{ backgroundColor: '#ef4444', margin: '0 auto 1rem auto', width: '12px', height: '12px' }}></div>
                    <div>Cargando registro de sanciones de Coordinación...</div>
                </div>
            ) : filteredSanctions.length === 0 ? (
                <div className="mac-doc-card" style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(16px)', borderRadius: '20px' }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '20px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.25rem auto'
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                            <path d="M12 8v4"/>
                            <path d="M12 16h.01"/>
                        </svg>
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffffff', margin: '0 0 0.5rem 0' }}>
                        No hay sanciones registradas.
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: 0, maxWidth: '460px', marginLeft: 'auto', marginRight: 'auto' }}>
                        Haz clic en "Registrar Sanción" para añadir una nueva entrada al expediente disciplinario.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
                    {filteredSanctions.map(sanc => {
                        const style = getSanctionBadgeStyle(sanc.sanction_type);
                        return (
                            <div key={sanc.id} className="mac-doc-card" style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                marginBottom: 0,
                                background: 'rgba(15, 23, 42, 0.65)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '20px',
                                padding: '1.5rem',
                                backdropFilter: 'blur(20px)'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                            {sanc.agent_avatar ? (
                                                <img src={sanc.agent_avatar} alt="" style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgba(245, 158, 11, 0.5)' }} />
                                            ) : (
                                                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)', color: '#fbbf24' }}>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                                        <circle cx="12" cy="7" r="4"/>
                                                    </svg>
                                                </div>
                                            )}
                                            <div>
                                                <h4 style={{ margin: 0, color: '#ffffff', fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                                    {sanc.agent_name}
                                                </h4>
                                                {sanc.badge_no && (
                                                    <div style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 700, marginTop: '0.1rem' }}>
                                                        Placa #{sanc.badge_no}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleDeleteSanction(sanc.id)}
                                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px', transition: 'color 0.2s ease' }}
                                            title="Eliminar Sanción"
                                            className="mac-btn-icon-hover"
                                        >
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"/>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                            </svg>
                                        </button>
                                    </div>

                                    <div style={{ marginBottom: '1rem' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            fontSize: '0.78rem',
                                            fontWeight: 800,
                                            padding: '0.3rem 0.85rem',
                                            borderRadius: '20px',
                                            background: style.bg,
                                            color: style.text,
                                            border: `1px solid ${style.border}`,
                                            letterSpacing: '0.04em',
                                            textTransform: 'uppercase'
                                        }}>
                                            {sanc.sanction_type}
                                        </span>
                                    </div>

                                    <div style={{
                                        fontSize: '0.9rem',
                                        color: '#cbd5e1',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        padding: '0.85rem 1rem',
                                        borderRadius: '12px',
                                        border: '1px solid rgba(255, 255, 255, 0.06)',
                                        lineHeight: '1.5',
                                        marginBottom: '1.25rem',
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {sanc.reason}
                                    </div>
                                </div>

                                <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem', fontWeight: 500 }}>
                                    <span>Por: <strong style={{ color: '#94a3b8' }}>{sanc.creator_name || 'Coordinación'}</strong></span>
                                    <span>{new Date(sanc.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Apple macOS Modal for Creating Sanction */}
            {showModal && (
                <div className="mac-modal-backdrop">
                    <div className="mac-modal-container" style={{ maxWidth: '540px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                            <span className="mac-status-dot" style={{ backgroundColor: '#ef4444' }}></span>
                            <h3 className="mac-modal-title" style={{ margin: 0, color: '#f87171' }}>
                                Registrar Nueva Sanción
                            </h3>
                        </div>

                        <form onSubmit={handleCreateSanction} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <div className="mac-form-group" style={{ marginBottom: 0 }}>
                                <label className="mac-form-label">
                                    Agente de la Detective Bureau *
                                </label>
                                <select
                                    className="mac-form-input"
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    required
                                    style={{ cursor: 'pointer' }}
                                >
                                    <option value="" style={{ color: '#94a3b8', background: '#0f172a' }}>
                                        -- Seleccionar Agente --
                                    </option>
                                    {agents.map(ag => (
                                        <option key={ag.id} value={ag.id} style={{ background: '#0f172a' }}>
                                            {ag.rango ? ag.rango + ' ' : ''}{ag.nombre} {ag.apellido} {ag.no_placa ? `(Placa #${ag.no_placa})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mac-form-group" style={{ marginBottom: 0 }}>
                                <label className="mac-form-label">
                                    Tipo de Sanción *
                                </label>
                                <select
                                    className="mac-form-input"
                                    value={sanctionType}
                                    onChange={(e) => setSanctionType(e.target.value)}
                                    required
                                    style={{ cursor: 'pointer' }}
                                >
                                    <option value="Aviso" style={{ background: '#0f172a' }}>Aviso</option>
                                    <option value="Sanción Leve" style={{ background: '#0f172a' }}>Sanción Leve</option>
                                    <option value="Sanción Media" style={{ background: '#0f172a' }}>Sanción Media</option>
                                    <option value="Sanción Grave" style={{ background: '#0f172a' }}>Sanción Grave</option>
                                    <option value="Expulsión" style={{ background: '#0f172a' }}>Expulsión</option>
                                </select>
                            </div>

                            <div className="mac-form-group" style={{ marginBottom: 0 }}>
                                <label className="mac-form-label">
                                    Motivo u Observaciones *
                                </label>
                                <textarea
                                    className="mac-form-input"
                                    placeholder="Detalla el motivo de la sanción disciplinaria..."
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={4}
                                    required
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            <div className="mac-modal-actions" style={{ marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="mac-btn mac-btn-secondary"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="mac-btn mac-btn-primary"
                                    style={{
                                        background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                                        border: '1px solid rgba(248, 113, 113, 0.4)',
                                        boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)'
                                    }}
                                >
                                    {submitting ? 'Guardando...' : 'Guardar Sanción'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CoordinationSanctions;
