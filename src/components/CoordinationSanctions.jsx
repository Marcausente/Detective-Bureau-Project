import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

function CoordinationSanctions() {
    const { t } = useLanguage();
    const [sanctions, setSanctions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);

    // Form State for new sanction entry
    const [agentName, setAgentName] = useState('');
    const [badgeNo, setBadgeNo] = useState('');
    const [reason, setReason] = useState('');
    const [sanctionType, setSanctionType] = useState('Aviso Escrito');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        // Load initial state or mock data if table is pending
        loadSanctions();
    }, []);

    const loadSanctions = async () => {
        try {
            setLoading(true);
            // Attempt to fetch from database if coordination_sanctions table exists
            const { data, error } = await supabase
                .from('coordination_sanctions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                // If table is not created yet, default to empty list gracefully
                console.log('Coordination sanctions query note:', error.message);
                setSanctions([]);
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
        if (!agentName.trim() || !reason.trim()) {
            alert('Por favor completa los campos requeridos (Nombre del agente y Motivo).');
            return;
        }

        setSubmitting(true);
        try {
            const { data: userData } = await supabase.auth.getUser();
            const { error } = await supabase.from('coordination_sanctions').insert([
                {
                    agent_name: agentName.trim(),
                    badge_no: badgeNo.trim() || null,
                    reason: reason.trim(),
                    sanction_type: sanctionType,
                    created_by: userData?.user?.id || null
                }
            ]);

            if (error) throw error;

            setAgentName('');
            setBadgeNo('');
            setReason('');
            setSanctionType('Aviso Escrito');
            setShowModal(false);
            loadSanctions();
        } catch (err) {
            alert('Error al registrar sanción: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const filteredSanctions = sanctions.filter(s => 
        (s.agent_name && s.agent_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.badge_no && s.badge_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.reason && s.reason.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            {/* Header & Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1, minWidth: '260px' }}>
                    <input
                        type="text"
                        placeholder="🔍 Buscar por nombre de agente, placa o motivo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            background: 'rgba(15, 23, 42, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#fff',
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            fontSize: '0.95rem',
                            outline: 'none'
                        }}
                    />
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    style={{
                        background: 'linear-gradient(135deg, #dc2626, #991b1b)',
                        color: '#fff',
                        border: 'none',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '8px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
                    }}
                >
                    ⚖️ + Registrar Nueva Sanción
                </button>
            </div>

            {/* Content List / Table */}
            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    ⏳ Cargando registro de sanciones...
                </div>
            ) : filteredSanctions.length === 0 ? (
                <div className="dashboard-card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', background: 'rgba(15, 23, 42, 0.65)', borderRadius: '12px' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚖️</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '0.5rem' }}>
                        No hay sanciones registradas en este momento.
                    </div>
                    <div>Haz clic en "Registrar Nueva Sanción" arriba para añadir un registro de disciplina o sanción de Coordinación.</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.2rem' }}>
                    {filteredSanctions.map(sanc => (
                        <div
                            key={sanc.id}
                            className="dashboard-card"
                            style={{
                                background: 'rgba(15, 23, 42, 0.75)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '10px',
                                padding: '1.2rem',
                                position: 'relative'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <h4 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>
                                    {sanc.agent_name}
                                </h4>
                                <span style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 'bold',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    color: '#f87171',
                                    border: '1px solid rgba(239, 68, 68, 0.4)'
                                }}>
                                    {sanc.sanction_type}
                                </span>
                            </div>
                            {sanc.badge_no && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', marginBottom: '0.5rem' }}>
                                    Placa #{sanc.badge_no}
                                </div>
                            )}
                            <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginBottom: '0.8rem', background: 'rgba(0,0,0,0.3)', padding: '0.6rem', borderRadius: '6px' }}>
                                {sanc.reason}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right' }}>
                                Registrado: {new Date(sanc.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal for Creating Sanction */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div style={{
                        background: '#0f172a', border: '1px solid rgba(239, 68, 68, 0.4)',
                        borderRadius: '12px', padding: '2rem', width: '90%', maxWidth: '520px',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                    }}>
                        <h3 style={{ margin: '0 0 1.2rem 0', color: '#f87171', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            ⚖️ Registrar Nueva Sanción de Coordinación
                        </h3>
                        <form onSubmit={handleCreateSanction} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Agente Sancionado *</label>
                                <input
                                    type="text"
                                    placeholder="Nombre completo del agente"
                                    value={agentName}
                                    onChange={(e) => setAgentName(e.target.value)}
                                    required
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                                        color: '#fff', padding: '0.6rem', borderRadius: '6px', outline: 'none'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Nº de Placa (opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ej: 104"
                                    value={badgeNo}
                                    onChange={(e) => setBadgeNo(e.target.value)}
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                                        color: '#fff', padding: '0.6rem', borderRadius: '6px', outline: 'none'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Tipo de Sanción</label>
                                <select
                                    value={sanctionType}
                                    onChange={(e) => setSanctionType(e.target.value)}
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                                        color: '#fff', padding: '0.6rem', borderRadius: '6px', outline: 'none'
                                    }}
                                >
                                    <option value="Aviso Escrito" style={{ background: '#0f172a' }}>Aviso Escrito</option>
                                    <option value="Apertura de Expediente" style={{ background: '#0f172a' }}>Apertura de Expediente</option>
                                    <option value="Suspensión de Servicio" style={{ background: '#0f172a' }}>Suspensión de Servicio</option>
                                    <option value="Degradación de Rango" style={{ background: '#0f172a' }}>Degradación de Rango</option>
                                    <option value="Expulsión / Despido" style={{ background: '#0f172a' }}>Expulsión / Despido</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.3rem' }}>Motivo de la Sanción *</label>
                                <textarea
                                    placeholder="Detalla el motivo u observaciones de la sanción aplicada..."
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                    required
                                    style={{
                                        width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)',
                                        color: '#fff', padding: '0.6rem', borderRadius: '6px', outline: 'none', resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    style={{ background: '#64748b', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', cursor: 'pointer' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{ background: 'linear-gradient(135deg, #dc2626, #991b1b)', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
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
