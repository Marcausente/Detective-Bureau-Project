import { useState, useEffect } from 'react';
import { getInternalRanks, createInternalRank, deleteInternalRank } from '../utils/internalRanks';
import { getSubdivisions, createSubdivision, updateSubdivision, deleteSubdivision, getSubdivisionAbbrev, getSubdivisionClass } from '../utils/subdivisions';

function CoordinationRolesConfig() {
    const [subSection, setSubSection] = useState('subdivisions'); // 'subdivisions' | 'internal_ranks'

    // Subdivision States
    const [subdivisions, setSubdivisions] = useState([]);
    const [subLoading, setSubLoading] = useState(true);
    const [subName, setSubName] = useState('');
    const [subAbbrev, setSubAbbrev] = useState('');
    const [subSubmitting, setSubSubmitting] = useState(false);
    const [subErrorMsg, setSubErrorMsg] = useState(null);
    const [subSuccessMsg, setSubSuccessMsg] = useState(null);

    // Edit Subdivision Modal State
    const [editingSub, setEditingSub] = useState(null);
    const [editName, setEditName] = useState('');
    const [editAbbrev, setEditAbbrev] = useState('');
    const [editSaving, setEditSaving] = useState(false);

    // Internal Ranks States
    const [ranks, setRanks] = useState([]);
    const [ranksLoading, setRanksLoading] = useState(true);
    const [newRankName, setNewRankName] = useState('');
    const [rankSubmitting, setRankSubmitting] = useState(false);
    const [rankErrorMsg, setRankErrorMsg] = useState(null);
    const [rankSuccessMsg, setRankSuccessMsg] = useState(null);

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        loadSubdivisionsData();
        loadRanksData();
    };

    const loadSubdivisionsData = async () => {
        try {
            setSubLoading(true);
            const data = await getSubdivisions();
            setSubdivisions(data || []);
        } catch (err) {
            console.error('Error loading subdivisions:', err);
        } finally {
            setSubLoading(false);
        }
    };

    const loadRanksData = async () => {
        try {
            setRanksLoading(true);
            const data = await getInternalRanks();
            setRanks(data || []);
        } catch (err) {
            console.error('Error loading internal ranks:', err);
        } finally {
            setRanksLoading(false);
        }
    };

    // --- Subdivisions Handlers ---
    const handleAddSubdivision = async (e) => {
        e.preventDefault();
        if (!subName.trim()) return;

        setSubSubmitting(true);
        setSubErrorMsg(null);
        setSubSuccessMsg(null);
        try {
            await createSubdivision(subName.trim(), subAbbrev.trim());
            setSubName('');
            setSubAbbrev('');
            setSubSuccessMsg('Subdivisión añadida correctamente.');
            setTimeout(() => setSubSuccessMsg(null), 3500);
            await loadSubdivisionsData();
        } catch (err) {
            setSubErrorMsg(err.message || 'Error al añadir la subdivisión.');
        } finally {
            setSubSubmitting(false);
        }
    };

    const handleOpenEditSub = (sub) => {
        setEditingSub(sub);
        setEditName(sub.name);
        setEditAbbrev(sub.abbrev || getSubdivisionAbbrev(sub.name, subdivisions));
    };

    const handleSaveEditSub = async (e) => {
        e.preventDefault();
        if (!editingSub || !editName.trim()) return;

        setEditSaving(true);
        try {
            await updateSubdivision(editingSub.id, editingSub.name, editName.trim(), editAbbrev.trim());
            setEditingSub(null);
            setSubSuccessMsg('Subdivisión actualizada con éxito.');
            setTimeout(() => setSubSuccessMsg(null), 3500);
            await loadSubdivisionsData();
        } catch (err) {
            alert(err.message || 'Error al actualizar la subdivisión.');
        } finally {
            setEditSaving(false);
        }
    };

    const handleDeleteSub = async (sub) => {
        if (!window.confirm(`¿Confirmas que deseas eliminar la subdivisión "${sub.name}" (${sub.abbrev || ''})?`)) return;

        try {
            await deleteSubdivision(sub.id, sub.name);
            setSubSuccessMsg(`Subdivisión "${sub.name}" eliminada.`);
            setTimeout(() => setSubSuccessMsg(null), 3500);
            await loadSubdivisionsData();
        } catch (err) {
            alert(err.message || 'Error al eliminar la subdivisión.');
        }
    };

    // --- Internal Ranks Handlers ---
    const handleAddRank = async (e) => {
        e.preventDefault();
        if (!newRankName.trim()) return;

        setRankSubmitting(true);
        setRankErrorMsg(null);
        setRankSuccessMsg(null);
        try {
            await createInternalRank(newRankName.trim());
            setNewRankName('');
            setRankSuccessMsg('Rango interno añadido correctamente.');
            setTimeout(() => setRankSuccessMsg(null), 3500);
            await loadRanksData();
        } catch (err) {
            setRankErrorMsg(err.message || 'Error al añadir el rango interno.');
        } finally {
            setRankSubmitting(false);
        }
    };

    const handleDeleteRank = async (rank) => {
        if (rank.is_default || rank.name.toLowerCase().trim() === 'auxiliar de investigación') {
            alert("El rango 'Auxiliar de Investigación' es el predeterminado del sistema y no puede eliminarse.");
            return;
        }

        if (!window.confirm(`¿Seguro que deseas eliminar el rango interno "${rank.name}"?`)) return;

        try {
            await deleteInternalRank(rank.id, rank.name);
            setRankSuccessMsg(`Rango "${rank.name}" eliminado.`);
            setTimeout(() => setRankSuccessMsg(null), 3500);
            await loadRanksData();
        } catch (err) {
            alert(err.message || 'Error al eliminar el rango.');
        }
    };

    return (
        <div style={{ width: '100%' }}>
            {/* Sub-navigation Switcher inside Roles Config */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                background: 'rgba(15, 23, 42, 0.65)',
                padding: '0.35rem',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                width: 'fit-content',
                marginBottom: '1.75rem'
            }}>
                <button
                    type="button"
                    onClick={() => setSubSection('subdivisions')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.55rem 1.25rem',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        border: subSection === 'subdivisions' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                        background: subSection === 'subdivisions' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                        color: subSection === 'subdivisions' ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={subSection === 'subdivisions' ? '#60a5fa' : '#94a3b8'} strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <span>Subdivisiones ({subdivisions.length})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setSubSection('internal_ranks')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.55rem 1.25rem',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        border: subSection === 'internal_ranks' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid transparent',
                        background: subSection === 'internal_ranks' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                        color: subSection === 'internal_ranks' ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={subSection === 'internal_ranks' ? '#fbbf24' : '#94a3b8'} strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    <span>Rangos Internos ({ranks.length})</span>
                </button>
            </div>

            {/* SECTION 1: SUBDIVISIONS */}
            {subSection === 'subdivisions' && (
                <div>
                    {/* Create Subdivision Card */}
                    <div className="mac-profile-panel" style={{
                        marginBottom: '2rem',
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
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                </svg>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    Crear Nueva Subdivisión
                                </h3>
                                <p style={{ margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>
                                    Crea, edita o elimina cualquier subdivisión para asignarla a los agentes desde la sección Personal.
                                </p>
                            </div>
                        </div>

                        {subErrorMsg && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.75rem 1rem', borderRadius: '10px', color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>⚠️</span> {subErrorMsg}
                            </div>
                        )}

                        {subSuccessMsg && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.75rem 1rem', borderRadius: '10px', color: '#34d399', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>✅</span> {subSuccessMsg}
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
                                    placeholder="Ej: Gang Unit, K-9 Unit, SEB, IA..."
                                    value={subName}
                                    onChange={(e) => setSubName(e.target.value)}
                                    disabled={subSubmitting}
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
                                    placeholder="Ej: GU, K9, SEB, IA..."
                                    value={subAbbrev}
                                    onChange={(e) => setSubAbbrev(e.target.value.toUpperCase())}
                                    disabled={subSubmitting}
                                    maxLength={8}
                                />
                            </div>

                            <button
                                type="submit"
                                className="mac-btn mac-btn-primary"
                                disabled={subSubmitting || !subName.trim()}
                                style={{
                                    padding: '0.75rem 1.4rem',
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
                                <span>{subSubmitting ? 'Guardando...' : 'Añadir Subdivisión'}</span>
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
                            <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                Catálogo de Subdivisiones Activas
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
                                {subdivisions.length} Registradas
                            </span>
                        </div>

                        {subLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                                Cargando subdivisiones...
                            </div>
                        ) : subdivisions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                                No hay subdivisiones registradas.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
                                {subdivisions.map(sub => {
                                    const abbrevDisplay = sub.abbrev || getSubdivisionAbbrev(sub.name, subdivisions);

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
                                                gap: '10px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0, flex: 1 }}>
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '10px',
                                                    background: 'rgba(59, 130, 246, 0.15)',
                                                    border: '1px solid rgba(59, 130, 246, 0.35)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#60a5fa',
                                                    fontWeight: 800,
                                                    fontSize: '0.85rem',
                                                    fontFamily: 'monospace',
                                                    flexShrink: 0
                                                }}>
                                                    {abbrevDisplay}
                                                </div>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {sub.name}
                                                    </div>
                                                    <div style={{ color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace', marginTop: '2px' }}>
                                                        Sigla: ({abbrevDisplay})
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEditSub(sub)}
                                                    className="mac-btn mac-btn-secondary"
                                                    style={{ padding: '0.4rem 0.65rem', fontSize: '0.75rem', borderRadius: '8px' }}
                                                    title="Modificar Nombre y Siglas"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteSub(sub)}
                                                    className="mac-btn"
                                                    style={{
                                                        padding: '0.4rem 0.65rem',
                                                        background: 'rgba(239, 68, 68, 0.15)',
                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        color: '#f87171',
                                                        fontSize: '0.75rem',
                                                        borderRadius: '8px'
                                                    }}
                                                    title="Eliminar Subdivisión"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SECTION 2: INTERNAL RANKS */}
            {subSection === 'internal_ranks' && (
                <div>
                    {/* Create Internal Rank Panel */}
                    <div className="mac-profile-panel" style={{
                        marginBottom: '2rem',
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
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                                </svg>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    Crear Nuevo Rango Interno
                                </h3>
                                <p style={{ margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>
                                    Define los rangos y jerarquías internas que se asignan al personal en su expediente.
                                </p>
                            </div>
                        </div>

                        {rankErrorMsg && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.75rem 1rem', borderRadius: '10px', color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>⚠️</span> {rankErrorMsg}
                            </div>
                        )}

                        {rankSuccessMsg && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.75rem 1rem', borderRadius: '10px', color: '#34d399', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>✅</span> {rankSuccessMsg}
                            </div>
                        )}

                        <form onSubmit={handleAddRank} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                            <div className="mac-form-group" style={{ flex: 1, margin: 0 }}>
                                <label className="mac-form-label" style={{ fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    Nombre del Rango Interno *
                                </label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    placeholder="Ej: Investigador Senior, Especialista en Balística..."
                                    value={newRankName}
                                    onChange={(e) => setNewRankName(e.target.value)}
                                    disabled={rankSubmitting}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="mac-btn mac-btn-primary"
                                disabled={rankSubmitting || !newRankName.trim()}
                                style={{
                                    padding: '0.75rem 1.4rem',
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
                                <span>{rankSubmitting ? 'Guardando...' : 'Añadir Rango'}</span>
                            </button>
                        </form>
                    </div>

                    {/* Internal Ranks List */}
                    <div className="mac-profile-panel" style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                        borderRadius: '20px',
                        padding: '1.75rem',
                        backdropFilter: 'blur(20px)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                Catálogo de Rangos Internos
                            </h3>
                            <span style={{
                                background: 'rgba(245, 158, 11, 0.2)',
                                color: '#fde047',
                                border: '1px solid rgba(245, 158, 11, 0.4)',
                                padding: '2px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 700
                            }}>
                                {ranks.length} Disponibles
                            </span>
                        </div>

                        {ranksLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                                Cargando rangos...
                            </div>
                        ) : ranks.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                                No hay rangos internos registrados.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                                {ranks.map(rank => {
                                    const isDefault = rank.is_default || rank.name.toLowerCase().trim() === 'auxiliar de investigación';

                                    return (
                                        <div
                                            key={rank.id || rank.name}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '1rem 1.25rem',
                                                background: 'rgba(255, 255, 255, 0.03)',
                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '14px',
                                                gap: '10px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0, flex: 1 }}>
                                                <div style={{
                                                    width: '38px',
                                                    height: '38px',
                                                    borderRadius: '10px',
                                                    background: 'rgba(245, 158, 11, 0.15)',
                                                    border: '1px solid rgba(245, 158, 11, 0.35)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: '#fbbf24',
                                                    fontWeight: 800,
                                                    flexShrink: 0
                                                }}>
                                                    ❖
                                                </div>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {rank.name}
                                                    </div>
                                                    <span style={{ fontSize: '0.72rem', color: isDefault ? '#94a3b8' : '#34d399', fontWeight: 600 }}>
                                                        {isDefault ? 'Predeterminado' : 'Personalizado'}
                                                    </span>
                                                </div>
                                            </div>

                                            {!isDefault && (
                                                <button
                                                    onClick={() => handleDeleteRank(rank)}
                                                    className="mac-btn"
                                                    style={{
                                                        padding: '0.4rem 0.65rem',
                                                        background: 'rgba(239, 68, 68, 0.15)',
                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        color: '#f87171',
                                                        fontSize: '0.75rem',
                                                        borderRadius: '8px',
                                                        flexShrink: 0
                                                    }}
                                                    title="Eliminar Rango"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* EDIT SUBDIVISION MODAL */}
            {editingSub && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 2500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(8px)',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div className="apple-window-mac modal-animate" style={{
                        width: '100%',
                        maxWidth: '440px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
                        background: '#0f172a',
                        borderRadius: '16px'
                    }}>
                        <div className="apple-mac-titlebar" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: 'rgba(15, 23, 42, 0.95)',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                        }}>
                            <div className="apple-mac-dots" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button onClick={() => setEditingSub(null)} className="apple-dot apple-dot-close" title="Cerrar" />
                                <button className="apple-dot apple-dot-minimize" />
                                <button className="apple-dot apple-dot-expand" />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>
                                ✏️ EDITAR SUBDIVISIÓN
                            </span>
                            <div style={{ width: '48px' }}></div>
                        </div>

                        <form onSubmit={handleSaveEditSub} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div className="mac-form-group" style={{ margin: 0 }}>
                                <label className="mac-form-label">Nombre de la Subdivisión *</label>
                                <input
                                    type="text"
                                    required
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="mac-form-input"
                                    disabled={editSaving}
                                />
                            </div>

                            <div className="mac-form-group" style={{ margin: 0 }}>
                                <label className="mac-form-label">Siglas / Abreviatura</label>
                                <input
                                    type="text"
                                    value={editAbbrev}
                                    onChange={(e) => setEditAbbrev(e.target.value.toUpperCase())}
                                    className="mac-form-input"
                                    maxLength={8}
                                    disabled={editSaving}
                                />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <button
                                    type="button"
                                    onClick={() => setEditingSub(null)}
                                    className="mac-btn mac-btn-secondary"
                                    disabled={editSaving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="mac-btn mac-btn-primary"
                                    disabled={editSaving || !editName.trim()}
                                >
                                    {editSaving ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CoordinationRolesConfig;
