import { useState, useEffect } from 'react';
import { getSubdivisions, createSubdivision, deleteSubdivision, getSubdivisionAbbrev, getSubdivisionClass } from '../utils/subdivisions';

function CoordinationSubdivisions() {
    const [subdivisions, setSubdivisions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [abbrev, setAbbrev] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [successMsg, setSuccessMsg] = useState(null);

    useEffect(() => {
        loadSubdivisions();
    }, []);

    const loadSubdivisions = async () => {
        try {
            setLoading(true);
            const data = await getSubdivisions();
            setSubdivisions(data || []);
        } catch (err) {
            console.error('Error loading subdivisions:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddSubdivision = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setSubmitting(true);
        setErrorMsg(null);
        setSuccessMsg(null);
        try {
            await createSubdivision(name.trim(), abbrev.trim());
            setName('');
            setAbbrev('');
            setSuccessMsg('Subdivisión añadida correctamente.');
            setTimeout(() => setSuccessMsg(null), 4000);
            await loadSubdivisions();
        } catch (err) {
            setErrorMsg(err.message || 'Error al añadir la subdivisión.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (sub) => {
        if (sub.is_default) {
            alert(`La subdivisión '${sub.name}' es predeterminada y no puede eliminarse.`);
            return;
        }

        if (!window.confirm(`¿Confirmas que deseas eliminar la subdivisión "${sub.name}" (${sub.abbrev})?`)) return;

        try {
            await deleteSubdivision(sub.id, sub.name);
            await loadSubdivisions();
        } catch (err) {
            alert(err.message || 'Error al eliminar la subdivisión.');
        }
    };

    return (
        <div style={{ width: '100%' }}>
            {/* Create Subdivision Panel */}
            <div className="mac-profile-panel" style={{
                marginBottom: '2.5rem',
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
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
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#60a5fa'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                    </div>
                    <div>
                        <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                            Crear Nueva Subdivisión Operativa
                        </h3>
                        <p style={{ margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                            Define nuevas subdivisiones y unidades especializadas para asignarlas a los agentes en sus expedientes.
                        </p>
                    </div>
                </div>

                {errorMsg && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        color: '#f87171',
                        fontSize: '0.85rem',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span>⚠️</span> {errorMsg}
                    </div>
                )}

                {successMsg && (
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        color: '#34d399',
                        fontSize: '0.85rem',
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span>✅</span> {successMsg}
                    </div>
                )}

                <form onSubmit={handleAddSubdivision} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
                    <div className="mac-form-group" style={{ margin: 0 }}>
                        <label className="mac-form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                            Nombre de la Subdivisión *
                        </label>
                        <input
                            type="text"
                            className="mac-form-input"
                            placeholder="Ej: K-9 Unit, Air Support Division, SEB..."
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={submitting}
                            required
                        />
                    </div>

                    <div className="mac-form-group" style={{ margin: 0 }}>
                        <label className="mac-form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                            Siglas / Abreviatura
                        </label>
                        <input
                            type="text"
                            className="mac-form-input"
                            placeholder="Ej: K9, ASD, SEB..."
                            value={abbrev}
                            onChange={(e) => setAbbrev(e.target.value.toUpperCase())}
                            disabled={submitting}
                            maxLength={8}
                        />
                    </div>

                    <button
                        type="submit"
                        className="mac-btn mac-btn-primary"
                        disabled={submitting || !name.trim()}
                        style={{
                            padding: '0.75rem 1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            height: '42px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        <span>{submitting ? 'Añadiendo...' : 'Añadir Subdivisión'}</span>
                    </button>
                </form>
            </div>

            {/* Subdivisions List Panel */}
            <div className="mac-profile-panel" style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                borderRadius: '20px',
                padding: '1.75rem',
                backdropFilter: 'blur(20px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                            Subdivisiones del Departamento
                        </h3>
                        <span style={{
                            background: 'rgba(59, 130, 246, 0.2)',
                            color: '#93c5fd',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 700
                        }}>
                            {subdivisions.length} Activas
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                        Cargando subdivisiones...
                    </div>
                ) : subdivisions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                        No hay subdivisiones registradas.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                        {subdivisions.map(sub => {
                            const isDefault = !!sub.is_default;
                            const abbrevDisplay = sub.abbrev || getSubdivisionAbbrev(sub.name, subdivisions);
                            const cssClass = getSubdivisionClass(sub.name);

                            return (
                                <div
                                    key={sub.id || sub.name}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '1rem 1.25rem',
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '14px',
                                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                        <div style={{
                                            width: '38px',
                                            height: '38px',
                                            borderRadius: '10px',
                                            background: isDefault ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                            border: isDefault ? '1px solid rgba(59, 130, 246, 0.35)' : '1px solid rgba(168, 85, 247, 0.35)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: isDefault ? '#60a5fa' : '#c084fc',
                                            fontWeight: 800,
                                            fontSize: '0.85rem',
                                            fontFamily: 'monospace'
                                        }}>
                                            {abbrevDisplay}
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem' }}>
                                                    {sub.name}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.68rem',
                                                    fontWeight: 700,
                                                    padding: '2px 6px',
                                                    borderRadius: '6px',
                                                    background: isDefault ? 'rgba(59, 130, 246, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                                                    color: isDefault ? '#93c5fd' : '#6ee7b7',
                                                    border: isDefault ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)'
                                                }}>
                                                    {isDefault ? 'Predeterminada' : 'Personalizada'}
                                                </span>
                                            </div>
                                            <span style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                                Sigla: ({abbrevDisplay})
                                            </span>
                                        </div>
                                    </div>

                                    {!isDefault ? (
                                        <button
                                            onClick={() => handleDelete(sub)}
                                            className="mac-btn"
                                            style={{
                                                padding: '0.4rem 0.75rem',
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                color: '#f87171',
                                                fontSize: '0.75rem',
                                                borderRadius: '8px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                            title="Eliminar Subdivisión"
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            </svg>
                                            <span>Eliminar</span>
                                        </button>
                                    ) : (
                                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic' }}>
                                            Fija
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default CoordinationSubdivisions;
