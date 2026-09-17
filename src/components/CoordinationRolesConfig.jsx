import { useState, useEffect } from 'react';
import { getInternalRanks, createInternalRank, deleteInternalRank } from '../utils/internalRanks';
import { getSubdivisions, createSubdivision, updateSubdivision, deleteSubdivision, getSubdivisionAbbrev, getSubdivisionClass } from '../utils/subdivisions';
import { getLicenses, createLicense, updateLicense, deleteLicense } from '../utils/licenses';

const LICENSE_COLOR_PRESETS = [
    { label: 'Esmeralda', hex: '#10b981' },
    { label: 'Ámbar', hex: '#f59e0b' },
    { label: 'Cian', hex: '#06b6d4' },
    { label: 'Azul', hex: '#3b82f6' },
    { label: 'Púrpura', hex: '#a855f7' },
    { label: 'Rojo', hex: '#ef4444' },
    { label: 'Rosa', hex: '#ec4899' },
    { label: 'Táctico', hex: '#64748b' }
];

const LICENSE_ICON_PRESETS = ['🪪', '🚗', '🏍️', '🚁', '🐕', '🎯', '⚡', '🛡️', '📻', '💊', '⚖️', '⚓', '🔍', '🔫', '🤿', '🎖️'];

function CoordinationRolesConfig() {
    const [subSection, setSubSection] = useState('subdivisions'); // 'subdivisions' | 'internal_ranks' | 'licenses'

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

    // Licenses States
    const [licenses, setLicenses] = useState([]);
    const [licensesLoading, setLicensesLoading] = useState(true);
    const [newLicName, setNewLicName] = useState('');
    const [newLicCode, setNewLicCode] = useState('');
    const [newLicDesc, setNewLicDesc] = useState('');
    const [newLicColor, setNewLicColor] = useState('#10b981');
    const [newLicIcon, setNewLicIcon] = useState('🪪');
    const [licSubmitting, setLicSubmitting] = useState(false);
    const [licErrorMsg, setLicErrorMsg] = useState(null);
    const [licSuccessMsg, setLicSuccessMsg] = useState(null);

    // Edit License Modal State
    const [editingLic, setEditingLic] = useState(null);
    const [editLicName, setEditLicName] = useState('');
    const [editLicCode, setEditLicCode] = useState('');
    const [editLicDesc, setEditLicDesc] = useState('');
    const [editLicColor, setEditLicColor] = useState('#10b981');
    const [editLicIcon, setEditLicIcon] = useState('🪪');
    const [editLicSaving, setEditLicSaving] = useState(false);

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        loadSubdivisionsData();
        loadRanksData();
        loadLicensesData();
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

    const loadLicensesData = async () => {
        try {
            setLicensesLoading(true);
            const data = await getLicenses();
            setLicenses(data || []);
        } catch (err) {
            console.error('Error loading licenses:', err);
        } finally {
            setLicensesLoading(false);
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

    // --- Licenses Handlers ---
    const handleAddLicense = async (e) => {
        e.preventDefault();
        if (!newLicName.trim()) return;

        setLicSubmitting(true);
        setLicErrorMsg(null);
        setLicSuccessMsg(null);
        try {
            await createLicense({
                name: newLicName.trim(),
                code: newLicCode.trim(),
                description: newLicDesc.trim(),
                color: newLicColor,
                icon: newLicIcon
            });
            setNewLicName('');
            setNewLicCode('');
            setNewLicDesc('');
            setNewLicColor('#10b981');
            setNewLicIcon('🪪');
            setLicSuccessMsg('Licencia añadida correctamente al catálogo.');
            setTimeout(() => setLicSuccessMsg(null), 3500);
            await loadLicensesData();
        } catch (err) {
            setLicErrorMsg(err.message || 'Error al añadir la licencia.');
        } finally {
            setLicSubmitting(false);
        }
    };

    const handleOpenEditLic = (lic) => {
        setEditingLic(lic);
        setEditLicName(lic.name);
        setEditLicCode(lic.code || '');
        setEditLicDesc(lic.description || '');
        setEditLicColor(lic.color || '#10b981');
        setEditLicIcon(lic.icon || '🪪');
    };

    const handleSaveEditLic = async (e) => {
        e.preventDefault();
        if (!editingLic || !editLicName.trim()) return;

        setEditLicSaving(true);
        try {
            await updateLicense(editingLic.id, editingLic.name, {
                name: editLicName.trim(),
                code: editLicCode.trim(),
                description: editLicDesc.trim(),
                color: editLicColor,
                icon: editLicIcon
            });
            setEditingLic(null);
            setLicSuccessMsg('Licencia actualizada con éxito.');
            setTimeout(() => setLicSuccessMsg(null), 3500);
            await loadLicensesData();
        } catch (err) {
            alert(err.message || 'Error al actualizar la licencia.');
        } finally {
            setEditLicSaving(false);
        }
    };

    const handleDeleteLic = async (lic) => {
        if (!window.confirm(`¿Confirmas que deseas eliminar la "${lic.name}" (${lic.code || ''})? Se retirará también de los agentes que la tengan asignada.`)) return;

        try {
            await deleteLicense(lic.id, lic.name);
            setLicSuccessMsg(`Licencia "${lic.name}" eliminada.`);
            setTimeout(() => setLicSuccessMsg(null), 3500);
            await loadLicensesData();
        } catch (err) {
            alert(err.message || 'Error al eliminar la licencia.');
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
                marginBottom: '1.75rem',
                flexWrap: 'wrap'
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

                <button
                    type="button"
                    onClick={() => setSubSection('licenses')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.55rem 1.25rem',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        border: subSection === 'licenses' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                        background: subSection === 'licenses' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                        color: subSection === 'licenses' ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <span style={{ fontSize: '1rem' }}>🪪</span>
                    <span>Licencias ({licenses.length})</span>
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
            {/* SECTION 3: LICENSES */}
            {subSection === 'licenses' && (
                <div>
                    {/* Create License Card */}
                    <div className="mac-profile-panel" style={{
                        marginBottom: '2rem',
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                        borderRadius: '20px',
                        padding: '1.75rem',
                        backdropFilter: 'blur(20px)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '12px',
                                    background: 'rgba(16, 185, 129, 0.15)',
                                    border: '1px solid rgba(16, 185, 129, 0.35)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#34d399',
                                    fontSize: '1.1rem'
                                }}>
                                    🪪
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                        Crear Nueva Licencia / Habilitación
                                    </h3>
                                    <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                                        Define certificados y permisos especiales que podrán habilitarse a los agentes desde el apartado de Personal.
                                    </p>
                                </div>
                            </div>

                            {/* Live Badge Preview */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '6px 12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>Vista Previa:</span>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '3px 9px',
                                    borderRadius: '8px',
                                    background: `${newLicColor}22`,
                                    color: newLicColor,
                                    border: `1px solid ${newLicColor}66`,
                                    fontSize: '0.78rem',
                                    fontWeight: 700
                                }}>
                                    <span>{newLicIcon}</span>
                                    <span>{newLicCode ? newLicCode.toUpperCase() : 'LIC'}</span>
                                    <span style={{ color: '#e2e8f0', fontWeight: 500, marginLeft: '2px' }}>
                                        {newLicName ? `• ${newLicName}` : ''}
                                    </span>
                                </span>
                            </div>
                        </div>

                        {licErrorMsg && (
                            <div style={{
                                padding: '0.75rem 1rem',
                                marginBottom: '1.25rem',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                borderRadius: '12px',
                                color: '#fca5a5',
                                fontSize: '0.85rem'
                            }}>
                                ⚠️ {licErrorMsg}
                            </div>
                        )}

                        {licSuccessMsg && (
                            <div style={{
                                padding: '0.75rem 1rem',
                                marginBottom: '1.25rem',
                                background: 'rgba(16, 185, 129, 0.15)',
                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                borderRadius: '12px',
                                color: '#6ee7b7',
                                fontSize: '0.85rem'
                            }}>
                                ✓ {licSuccessMsg}
                            </div>
                        )}

                        <form onSubmit={handleAddLicense} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">Nombre de la Licencia *</label>
                                    <input
                                        type="text"
                                        className="mac-form-input"
                                        placeholder="Ej: Licencia de Foxtrot, Licencia de Mike..."
                                        value={newLicName}
                                        onChange={(e) => setNewLicName(e.target.value)}
                                        disabled={licSubmitting}
                                        required
                                    />
                                </div>

                                <div className="mac-form-group" style={{ margin: 0 }}>
                                    <label className="mac-form-label">Código / Abreviatura *</label>
                                    <input
                                        type="text"
                                        className="mac-form-input"
                                        placeholder="Ej: FX, MK, AIR, K9, TAC..."
                                        value={newLicCode}
                                        onChange={(e) => setNewLicCode(e.target.value.toUpperCase())}
                                        maxLength={8}
                                        disabled={licSubmitting}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="mac-form-group" style={{ margin: 0 }}>
                                <label className="mac-form-label">Descripción de la Habilitación (Opcional)</label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    placeholder="Ej: Habilitación para patrullaje, persecución e intervención táctica..."
                                    value={newLicDesc}
                                    onChange={(e) => setNewLicDesc(e.target.value)}
                                    disabled={licSubmitting}
                                />
                            </div>

                            {/* Icons and Colors Selection */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                <div>
                                    <label className="mac-form-label" style={{ marginBottom: '6px' }}>Icono / Emblema</label>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        {LICENSE_ICON_PRESETS.map(icon => (
                                            <button
                                                key={icon}
                                                type="button"
                                                onClick={() => setNewLicIcon(icon)}
                                                style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '8px',
                                                    background: newLicIcon === icon ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.05)',
                                                    border: newLicIcon === icon ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                                                    cursor: 'pointer',
                                                    fontSize: '1rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                {icon}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="mac-form-label" style={{ marginBottom: '6px' }}>Color del Distintivo</label>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                        {LICENSE_COLOR_PRESETS.map(preset => (
                                            <button
                                                key={preset.hex}
                                                type="button"
                                                onClick={() => setNewLicColor(preset.hex)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    padding: '4px 8px',
                                                    borderRadius: '8px',
                                                    background: newLicColor === preset.hex ? `${preset.hex}33` : 'rgba(255,255,255,0.04)',
                                                    border: newLicColor === preset.hex ? `1px solid ${preset.hex}` : '1px solid rgba(255,255,255,0.08)',
                                                    cursor: 'pointer',
                                                    color: '#f8fafc',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 600,
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: preset.hex }}></span>
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                                <button
                                    type="submit"
                                    className="mac-btn mac-btn-primary"
                                    disabled={licSubmitting || !newLicName.trim()}
                                    style={{
                                        padding: '0.75rem 1.6rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        height: '42px',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        border: 'none',
                                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                                    }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <line x1="12" y1="5" x2="12" y2="19" />
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    <span>{licSubmitting ? 'Guardando...' : 'Añadir Licencia'}</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Licenses Catalog List */}
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
                                Catálogo de Licencias del Departamento
                            </h3>
                            <span style={{
                                background: 'rgba(16, 185, 129, 0.2)',
                                color: '#6ee7b7',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                padding: '2px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 700
                            }}>
                                {licenses.length} Registradas
                            </span>
                        </div>

                        {licensesLoading ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                                Cargando catálogo de licencias...
                            </div>
                        ) : licenses.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                                No hay licencias registradas en el catálogo.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                                {licenses.map(lic => {
                                    const licColor = lic.color || '#10b981';
                                    const licIcon = lic.icon || '🪪';

                                    return (
                                        <div
                                            key={lic.id || lic.name}
                                            style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between',
                                                padding: '1.1rem 1.25rem',
                                                background: 'rgba(255, 255, 255, 0.03)',
                                                border: `1px solid ${licColor}33`,
                                                borderRadius: '14px',
                                                gap: '10px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0, flex: 1 }}>
                                                    <div style={{
                                                        width: '42px',
                                                        height: '42px',
                                                        borderRadius: '12px',
                                                        background: `${licColor}22`,
                                                        border: `1px solid ${licColor}66`,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '1.25rem',
                                                        flexShrink: 0
                                                    }}>
                                                        {licIcon}
                                                    </div>
                                                    <div style={{ minWidth: 0, flex: 1 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                            <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.98rem' }}>
                                                                {lic.name}
                                                            </span>
                                                            <span style={{
                                                                fontSize: '0.7rem',
                                                                fontWeight: 800,
                                                                padding: '1px 6px',
                                                                borderRadius: '6px',
                                                                background: `${licColor}33`,
                                                                color: licColor,
                                                                border: `1px solid ${licColor}77`
                                                            }}>
                                                                {lic.code || 'LIC'}
                                                            </span>
                                                        </div>
                                                        {lic.description && (
                                                            <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.35 }}>
                                                                {lic.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                                    <button
                                                        onClick={() => handleOpenEditLic(lic)}
                                                        className="mac-btn"
                                                        style={{
                                                            padding: '0.4rem 0.65rem',
                                                            background: 'rgba(255, 255, 255, 0.08)',
                                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                                            color: '#e2e8f0',
                                                            fontSize: '0.75rem',
                                                            borderRadius: '8px'
                                                        }}
                                                        title="Editar Licencia"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteLic(lic)}
                                                        className="mac-btn"
                                                        style={{
                                                            padding: '0.4rem 0.65rem',
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                                            color: '#f87171',
                                                            fontSize: '0.75rem',
                                                            borderRadius: '8px'
                                                        }}
                                                        title="Eliminar Licencia"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
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

            {/* EDIT LICENSE MODAL */}
            {editingLic && (
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
                        maxWidth: '480px',
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
                                <button onClick={() => setEditingLic(null)} className="apple-dot apple-dot-close" title="Cerrar" />
                                <button className="apple-dot apple-dot-minimize" />
                                <button className="apple-dot apple-dot-expand" />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>
                                ✏️ EDITAR LICENCIA
                            </span>
                            <div style={{ width: '48px' }}></div>
                        </div>

                        <form onSubmit={handleSaveEditLic} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div className="mac-form-group" style={{ margin: 0 }}>
                                <label className="mac-form-label">Nombre de la Licencia *</label>
                                <input
                                    type="text"
                                    required
                                    value={editLicName}
                                    onChange={(e) => setEditLicName(e.target.value)}
                                    className="mac-form-input"
                                    disabled={editLicSaving}
                                />
                            </div>

                            <div className="mac-form-group" style={{ margin: 0 }}>
                                <label className="mac-form-label">Código / Abreviatura *</label>
                                <input
                                    type="text"
                                    required
                                    value={editLicCode}
                                    onChange={(e) => setEditLicCode(e.target.value.toUpperCase())}
                                    className="mac-form-input"
                                    maxLength={8}
                                    disabled={editLicSaving}
                                />
                            </div>

                            <div className="mac-form-group" style={{ margin: 0 }}>
                                <label className="mac-form-label">Descripción</label>
                                <input
                                    type="text"
                                    value={editLicDesc}
                                    onChange={(e) => setEditLicDesc(e.target.value)}
                                    className="mac-form-input"
                                    disabled={editLicSaving}
                                />
                            </div>

                            <div>
                                <label className="mac-form-label" style={{ marginBottom: '6px' }}>Icono / Emblema</label>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {LICENSE_ICON_PRESETS.map(icon => (
                                        <button
                                            key={icon}
                                            type="button"
                                            onClick={() => setEditLicIcon(icon)}
                                            style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '8px',
                                                background: editLicIcon === icon ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.05)',
                                                border: editLicIcon === icon ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                                                cursor: 'pointer',
                                                fontSize: '1rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="mac-form-label" style={{ marginBottom: '6px' }}>Color del Distintivo</label>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {LICENSE_COLOR_PRESETS.map(preset => (
                                        <button
                                            key={preset.hex}
                                            type="button"
                                            onClick={() => setEditLicColor(preset.hex)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                padding: '4px 8px',
                                                borderRadius: '8px',
                                                background: editLicColor === preset.hex ? `${preset.hex}33` : 'rgba(255,255,255,0.04)',
                                                border: editLicColor === preset.hex ? `1px solid ${preset.hex}` : '1px solid rgba(255,255,255,0.08)',
                                                cursor: 'pointer',
                                                color: '#f8fafc',
                                                fontSize: '0.72rem',
                                                fontWeight: 600
                                            }}
                                        >
                                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: preset.hex }}></span>
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <button
                                    type="button"
                                    onClick={() => setEditingLic(null)}
                                    className="mac-btn mac-btn-secondary"
                                    disabled={editLicSaving}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="mac-btn mac-btn-primary"
                                    disabled={editLicSaving || !editLicName.trim()}
                                >
                                    {editLicSaving ? 'Guardando...' : 'Guardar Cambios'}
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
