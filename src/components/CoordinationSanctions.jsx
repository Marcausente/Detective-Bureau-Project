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
                <div style={{ flex: 1, minWidth: '280px' }}>
                    <input
                        type="text"
                        className="coordination-input"
                        placeholder="🔍 Buscar por nombre de agente, placa, tipo de sanción o motivo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    style={{
                        background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                        color: '#fff',
                        border: 'none',
                        padding: '0.75rem 1.6rem',
                        borderRadius: '10px',
                        fontWeight: '700',
                        fontSize: '0.95rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(220, 38, 38, 0.35)',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    ⚖️ Registrar Sanción
                </button>
            </div>

            {/* Content Display Grid */}
            {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    ⏳ Cargando registro de sanciones de Coordinación...
                </div>
            ) : filteredSanctions.length === 0 ? (
                <div className="coordination-card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚖️</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                        No hay sanciones registradas en este momento.
                    </div>
                    <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
                        Haz clic en "Registrar Sanción" para registrar una sanción a un agente de la Detective Bureau.
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.5rem' }}>
                    {filteredSanctions.map(sanc => {
                        const style = getSanctionBadgeStyle(sanc.sanction_type);
                        return (
                            <div key={sanc.id} className="coordination-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', marginBottom: 0 }}>
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            {sanc.agent_avatar ? (
                                                <img src={sanc.agent_avatar} alt="" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--accent-gold)' }} />
                                            ) : (
                                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', border: '1px solid var(--glass-border)' }}>
                                                    👮
                                                </div>
                                            )}
                                            <div>
                                                <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.1rem', fontWeight: '700' }}>
                                                    {sanc.agent_name}
                                                </h4>
                                                {sanc.badge_no && (
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', fontWeight: '600' }}>
                                                        Placa #{sanc.badge_no}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleDeleteSanction(sanc.id)}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1rem', padding: '2px' }}
                                            title="Eliminar Sanción"
                                        >
                                            🗑️
                                        </button>
                                    </div>

                                    <div style={{ marginBottom: '1rem' }}>
                                        <span style={{
                                            display: 'inline-block',
                                            fontSize: '0.82rem',
                                            fontWeight: '800',
                                            padding: '4px 12px',
                                            borderRadius: '20px',
                                            background: style.bg,
                                            color: style.text,
                                            border: `1px solid ${style.border}`,
                                            letterSpacing: '0.5px'
                                        }}>
                                            {sanc.sanction_type}
                                        </span>
                                    </div>

                                    <div style={{
                                        fontSize: '0.92rem',
                                        color: 'var(--text-primary)',
                                        background: 'rgba(0, 0, 0, 0.25)',
                                        padding: '0.8rem 1rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--glass-border)',
                                        lineHeight: '1.5',
                                        marginBottom: '1rem',
                                        whiteSpace: 'pre-wrap',
                                        opacity: 0.95
                                    }}>
                                        {sanc.reason}
                                    </div>
                                </div>

                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: '0.6rem' }}>
                                    <span>Por: {sanc.creator_name || 'Coordinación'}</span>
                                    <span>{new Date(sanc.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal for Creating Sanction */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div className="coordination-card" style={{
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        padding: '2rem',
                        width: '90%',
                        maxWidth: '540px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                        marginBottom: 0
                    }}>
                        <h3 style={{ margin: '0 0 1.25rem 0', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.3rem' }}>
                            ⚖️ Registrar Nueva Sanción de Coordinación
                        </h3>
                        <form onSubmit={handleCreateSanction} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: '600' }}>
                                    Agente de la Detective Bureau *
                                </label>
                                <select
                                    className="coordination-select"
                                    value={selectedUserId}
                                    onChange={(e) => setSelectedUserId(e.target.value)}
                                    required
                                >
                                    <option value="" style={{ color: 'var(--text-secondary)' }}>
                                        -- Selecciona un Agente --
                                    </option>
                                    {agents.map(ag => (
                                        <option key={ag.id} value={ag.id}>
                                            {ag.rango ? ag.rango + ' ' : ''}{ag.nombre} {ag.apellido} {ag.no_placa ? `(Placa #${ag.no_placa})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: '600' }}>
                                    Tipo de Sanción *
                                </label>
                                <select
                                    className="coordination-select"
                                    value={sanctionType}
                                    onChange={(e) => setSanctionType(e.target.value)}
                                    required
                                >
                                    <option value="Aviso">Aviso</option>
                                    <option value="Sanción Leve">Sanción Leve</option>
                                    <option value="Sanción Media">Sanción Media</option>
                                    <option value="Sanción Grave">Sanción Grave</option>
                                    <option value="Expulsión">Expulsión</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: '600' }}>
                                    Motivo u Observaciones *
                                </label>
                                <textarea
                                    className="coordination-input"
                                    placeholder="Escribe el motivo detallado de la sanción..."
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={4}
                                    required
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    style={{
                                        background: 'rgba(255,255,255,0.1)',
                                        color: 'var(--text-secondary)',
                                        border: 'none',
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        fontWeight: '600'
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                                        color: '#fff',
                                        border: 'none',
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '8px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)'
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
