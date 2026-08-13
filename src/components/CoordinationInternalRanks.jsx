import { useState, useEffect } from 'react';
import { getInternalRanks, createInternalRank, deleteInternalRank } from '../utils/internalRanks';

function CoordinationInternalRanks() {
    const [ranks, setRanks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newRankName, setNewRankName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    useEffect(() => {
        loadRanks();
    }, []);

    const loadRanks = async () => {
        try {
            setLoading(true);
            const data = await getInternalRanks();
            setRanks(data || []);
        } catch (err) {
            console.error('Error loading internal ranks:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddRank = async (e) => {
        e.preventDefault();
        if (!newRankName.trim()) return;

        setSubmitting(true);
        setErrorMsg(null);
        try {
            await createInternalRank(newRankName.trim());
            setNewRankName('');
            loadRanks();
        } catch (err) {
            setErrorMsg(err.message || 'Error al añadir el rango interno.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (rank) => {
        if (rank.is_default || rank.name.toLowerCase().trim() === 'auxiliar de investigación') {
            alert("El rango 'Auxiliar de Investigación' es el predeterminado y no puede eliminarse.");
            return;
        }

        if (!window.confirm(`¿Seguro que deseas eliminar el rango interno "${rank.name}"?`)) return;

        try {
            await deleteInternalRank(rank.id, rank.name);
            loadRanks();
        } catch (err) {
            alert(err.message || 'Error al eliminar el rango.');
        }
    };

    return (
        <div style={{ width: '100%' }}>
            {/* Create Internal Rank Panel */}
            <div className="mac-profile-panel" style={{
                marginBottom: '2.5rem',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                borderRadius: '20px',
                padding: '1.75rem',
                backdropFilter: 'blur(20px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '12px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fbbf24'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                    </div>
                    <div>
                        <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                            Crear Nuevo Rango Interno de la División
                        </h3>
                        <p style={{ margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                            Define rangos internos adicionales para asignarlos al personal desde la sección de Personal.
                        </p>
                    </div>
                </div>

                {errorMsg && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        padding: '0.65rem 1rem',
                        borderRadius: '10px',
                        fontSize: '0.88rem',
                        marginBottom: '1rem'
                    }}>
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleAddRank} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="mac-form-group" style={{ marginBottom: 0, flex: 1, minWidth: '260px' }}>
                        <label className="mac-form-label">
                            Nombre del Rango Interno *
                        </label>
                        <input
                            type="text"
                            className="mac-form-input"
                            placeholder="Ej: Investigador Operativo, Analista de Inteligencia, Supervisor..."
                            value={newRankName}
                            onChange={(e) => setNewRankName(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="mac-btn mac-btn-primary"
                        disabled={submitting}
                        style={{
                            background: 'linear-gradient(135deg, #d97706, #b45309)',
                            border: '1px solid rgba(251, 191, 36, 0.4)',
                            boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
                            padding: '0.65rem 1.6rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            height: '42px'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        <span>{submitting ? 'Añadiendo...' : 'Añadir Rango'}</span>
                    </button>
                </form>
            </div>

            {/* List of Internal Ranks */}
            {loading ? (
                <div className="mac-doc-card" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(16px)' }}>
                    <div className="mac-status-dot" style={{ backgroundColor: '#f59e0b', margin: '0 auto 1rem auto', width: '12px', height: '12px' }}></div>
                    <div>Cargando rangos internos...</div>
                </div>
            ) : (
                <div className="mac-doc-card" style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '20px',
                    padding: '1.75rem',
                    backdropFilter: 'blur(20px)'
                }}>
                    <h4 style={{ margin: '0 0 1.25rem 0', color: '#ffffff', fontSize: '1.1rem', fontWeight: 800 }}>
                        Rangos Internos Configurados ({ranks.length})
                    </h4>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                        {ranks.map(rank => {
                            const isDefault = rank.is_default || rank.name.toLowerCase().trim() === 'auxiliar de investigación';
                            return (
                                <div key={rank.id || rank.name} style={{
                                    display: 'flex',
                                    justify: 'space-between',
                                    alignItems: 'center',
                                    background: isDefault ? 'rgba(245, 158, 11, 0.1)' : 'rgba(0, 0, 0, 0.3)',
                                    border: isDefault ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                                    padding: '0.85rem 1.1rem',
                                    borderRadius: '14px',
                                    transition: 'all 0.2s ease'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill={isDefault ? "#fbbf24" : "none"} stroke="#fbbf24" strokeWidth="2">
                                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                        </svg>
                                        <span style={{ color: '#ffffff', fontSize: '0.92rem', fontWeight: 700 }}>
                                            {rank.name}
                                        </span>
                                    </div>

                                    {isDefault ? (
                                        <span style={{
                                            fontSize: '0.7rem',
                                            fontWeight: 800,
                                            color: '#fbbf24',
                                            background: 'rgba(245, 158, 11, 0.2)',
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.04em'
                                        }}>
                                            Predeterminado
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => handleDelete(rank)}
                                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px' }}
                                            title="Eliminar Rango Interno"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"/>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

export default CoordinationInternalRanks;
