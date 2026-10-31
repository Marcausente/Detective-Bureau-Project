import { useState, useEffect, useMemo } from 'react';
import {
    fetchArchivedAgents,
    updateArchivedAgent,
    deleteArchivedAgent,
    restoreArchivedAgent
} from '../../services/plantillaService';

export default function PlantillaArchivedMembersModal({
    isOpen,
    onClose,
    currentUser,
    onAgentRestored
}) {
    const [archivedList, setArchivedList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTab, setFilterTab] = useState('all'); // 'all' | 'banned' | 'regular'

    // Editing note state
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [editingNoteText, setEditingNoteText] = useState('');
    const [savingNote, setSavingNote] = useState(false);

    // Notice & Error banner
    const [notice, setNotice] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            loadArchivedData();
        }
    }, [isOpen]);

    const loadArchivedData = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchArchivedAgents();
            setArchivedList(data || []);
        } catch (err) {
            console.error('Error loading archived agents:', err);
            setError('Error al cargar la lista de antiguos miembros');
        } finally {
            setLoading(false);
        }
    };

    // Toggle Veto (is_banned) status
    const handleToggleVeto = async (member) => {
        const newStatus = !member.is_banned;
        try {
            // Optimistic update
            setArchivedList(prev => prev.map(m => m.id === member.id ? { ...m, is_banned: newStatus } : m));
            await updateArchivedAgent(member.id, { is_banned: newStatus });
            setNotice(newStatus ? `⛔ ${member.nombre} ${member.apellido} ha sido marcado como VETADO.` : `ℹ️ Veto retirado para ${member.nombre} ${member.apellido}.`);
            setTimeout(() => setNotice(null), 3500);
        } catch (err) {
            console.error('Error toggling veto:', err);
            setError('Error al actualizar el estado de veto');
            loadArchivedData();
        }
    };

    // Start editing note
    const handleStartEditNote = (member) => {
        setEditingNoteId(member.id);
        setEditingNoteText(member.reason || '');
    };

    // Save edited note
    const handleSaveNote = async (memberId) => {
        try {
            setSavingNote(true);
            const cleanText = editingNoteText.trim();
            setArchivedList(prev => prev.map(m => m.id === memberId ? { ...m, reason: cleanText } : m));
            await updateArchivedAgent(memberId, { reason: cleanText });
            setEditingNoteId(null);
            setNotice('✅ Nota actualizada correctamente.');
            setTimeout(() => setNotice(null), 3000);
        } catch (err) {
            console.error('Error saving note:', err);
            setError('Error al guardar la nota');
        } finally {
            setSavingNote(false);
        }
    };

    // Restore member back to active plantilla
    const handleRestore = async (member) => {
        const confirmMsg = `¿Deseas restaurar a ${member.nombre} ${member.apellido} (#${member.no_placa || 'S/P'}) a la plantilla activa?`;
        if (!window.confirm(confirmMsg)) return;

        try {
            setLoading(true);
            const restored = await restoreArchivedAgent(member);
            setArchivedList(prev => prev.filter(m => m.id !== member.id));
            if (onAgentRestored) {
                onAgentRestored(restored);
            }
            setNotice(`✅ ${member.nombre} ${member.apellido} restaurado con éxito en la plantilla activa.`);
            setTimeout(() => setNotice(null), 4000);
        } catch (err) {
            console.error('Error restoring member:', err);
            setError('Error al restaurar agente a la plantilla');
        } finally {
            setLoading(false);
        }
    };

    // Permanently delete archived record
    const handleDeletePermanent = async (member) => {
        const confirmMsg = `¿Eliminar definitivamente el registro de ${member.nombre} ${member.apellido}? Esta acción no se puede deshacer.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            setArchivedList(prev => prev.filter(m => m.id !== member.id));
            await deleteArchivedAgent(member.id);
            setNotice(`🗑️ Registro de ${member.nombre} eliminado.`);
            setTimeout(() => setNotice(null), 3000);
        } catch (err) {
            console.error('Error deleting archived record:', err);
            setError('Error al eliminar el registro');
            loadArchivedData();
        }
    };

    // Filtered members list
    const filteredMembers = useMemo(() => {
        return archivedList.filter(m => {
            // Tab filter
            if (filterTab === 'banned' && !m.is_banned) return false;
            if (filterTab === 'regular' && m.is_banned) return false;

            // Search filter
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase().trim();
                const fullName = `${m.nombre || ''} ${m.apellido || ''}`.toLowerCase();
                const user = (m.username || '').toLowerCase();
                const mail = (m.email || '').toLowerCase();
                const placa = (m.no_placa || '').toLowerCase();
                const rank = (m.rank_name || '').toLowerCase();
                const note = (m.reason || '').toLowerCase();

                if (!fullName.includes(term) &&
                    !user.includes(term) &&
                    !mail.includes(term) &&
                    !placa.includes(term) &&
                    !rank.includes(term) &&
                    !note.includes(term)) {
                    return false;
                }
            }

            return true;
        });
    }, [archivedList, filterTab, searchTerm]);

    const bannedCount = useMemo(() => archivedList.filter(m => m.is_banned).length, [archivedList]);
    const regularCount = useMemo(() => archivedList.filter(m => !m.is_banned).length, [archivedList]);

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99990,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(2, 6, 23, 0.88)',
            backdropFilter: 'blur(8px)',
            padding: '1.25rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '1150px',
                height: '90vh',
                maxHeight: '90vh',
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '20px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.25rem 1.6rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(239, 68, 68, 0.25))',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.3rem'
                        }}>
                            🗄️
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                                    Antiguos Miembros (Archivo de Bajas)
                                </h2>
                                <span style={{
                                    fontSize: '0.68rem',
                                    fontWeight: 800,
                                    color: '#cbd5e1',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    padding: '2px 8px',
                                    borderRadius: '9999px',
                                    border: '1px solid rgba(255, 255, 255, 0.12)'
                                }}>
                                    {archivedList.length} registros
                                </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                                Registro histórico de miembros que han abandonado la facción, motivos y control de vetos
                            </p>
                        </div>
                    </div>

                    {/* Stats pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            padding: '0.3rem 0.75rem',
                            display: 'flex',
                            gap: '12px',
                            alignItems: 'center'
                        }}>
                            <div>
                                <span style={{ fontSize: '0.60rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Regulares</span>
                                <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#38bdf8' }}>{regularCount}</span>
                            </div>
                            <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)' }} />
                            <div>
                                <span style={{ fontSize: '0.60rem', color: '#fca5a5', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Vetados</span>
                                <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#ef4444' }}>{bannedCount}</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#cbd5e1',
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyCenter: 'center',
                                fontSize: '0.95rem'
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Sub-toolbar: Search & Filters */}
                <div style={{
                    padding: '0.75rem 1.6rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(15, 23, 42, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                }}>
                    {/* Search */}
                    <div style={{ position: 'relative', width: '280px' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.78rem', color: '#94a3b8' }}>
                            🔍
                        </span>
                        <input
                            type="text"
                            placeholder="Buscar por nombre, placa, usuario, motivo..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(15, 23, 42, 0.85)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '8px',
                                padding: '0.38rem 0.75rem 0.38rem 2rem',
                                color: '#f8fafc',
                                fontSize: '0.78rem',
                                outline: 'none'
                            }}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                style={{
                                    position: 'absolute',
                                    right: '8px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem'
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filter Tabs */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            type="button"
                            onClick={() => setFilterTab('all')}
                            style={{
                                background: filterTab === 'all' ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                border: filterTab === 'all' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                                color: filterTab === 'all' ? '#93c5fd' : '#cbd5e1',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            Todos ({archivedList.length})
                        </button>

                        <button
                            type="button"
                            onClick={() => setFilterTab('banned')}
                            style={{
                                background: filterTab === 'banned' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                border: filterTab === 'banned' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                                color: filterTab === 'banned' ? '#fca5a5' : '#cbd5e1',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <span>⛔</span>
                            <span>Solo Vetados ({bannedCount})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setFilterTab('regular')}
                            style={{
                                background: filterTab === 'regular' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                border: filterTab === 'regular' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                                color: filterTab === 'regular' ? '#86efac' : '#cbd5e1',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            Bajas Regulares ({regularCount})
                        </button>
                    </div>
                </div>

                {/* Notice & Error alerts */}
                {notice && (
                    <div style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        borderBottom: '1px solid rgba(16, 185, 129, 0.3)',
                        padding: '0.5rem 1.6rem',
                        color: '#86efac',
                        fontSize: '0.78rem',
                        fontWeight: 700
                    }}>
                        {notice}
                    </div>
                )}
                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
                        padding: '0.5rem 1.6rem',
                        color: '#fca5a5',
                        fontSize: '0.78rem',
                        fontWeight: 700
                    }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* Table Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.6rem' }}>
                    {loading && archivedList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⏳</div>
                            <div>Cargando archivo de antiguos miembros...</div>
                        </div>
                    ) : filteredMembers.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: '3.5rem 1rem',
                            color: '#64748b',
                            background: 'rgba(15, 23, 42, 0.4)',
                            borderRadius: '14px',
                            border: '1px dashed rgba(255, 255, 255, 0.1)'
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🗄️</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#cbd5e1' }}>
                                No se encontraron registros de antiguos miembros
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                                {searchTerm ? 'Prueba con otro término de búsqueda' : 'Cuando archives a un agente desde la plantilla principal aparecerá aquí.'}
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                            {filteredMembers.map(member => {
                                const isBanned = Boolean(member.is_banned);
                                const isEditingThis = editingNoteId === member.id;
                                const formattedDate = member.archived_at 
                                    ? new Date(member.archived_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
                                    : 'Sin fecha';

                                return (
                                    <div
                                        key={member.id}
                                        style={{
                                            background: isBanned 
                                                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(15, 23, 42, 0.95))' 
                                                : 'rgba(30, 41, 59, 0.45)',
                                            border: isBanned 
                                                ? '1.5px solid rgba(239, 68, 68, 0.6)' 
                                                : '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '12px',
                                            padding: '0.85rem 1.1rem',
                                            boxShadow: isBanned ? '0 0 14px rgba(239, 68, 68, 0.2)' : 'none',
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '12px',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {/* Left: Avatar & Agent Basic Info */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '260px', flex: '1 1 280px' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                background: isBanned ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                                                border: isBanned ? '1.5px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden',
                                                flexShrink: 0
                                            }}>
                                                {member.avatar_url ? (
                                                    <img src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                ) : (
                                                    <span style={{ fontSize: '1.1rem' }}>{isBanned ? '⛔' : '👮'}</span>
                                                )}
                                            </div>

                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                    <span style={{
                                                        fontSize: '0.62rem',
                                                        fontWeight: 900,
                                                        color: isBanned ? '#fca5a5' : '#60a5fa',
                                                        background: isBanned ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.15)',
                                                        padding: '1px 5px',
                                                        borderRadius: '4px',
                                                        border: isBanned ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(59, 130, 246, 0.3)'
                                                    }}>
                                                        {member.no_placa ? `#${member.no_placa}` : 'S/P'}
                                                    </span>

                                                    <span style={{
                                                        fontSize: '0.90rem',
                                                        fontWeight: 900,
                                                        color: isBanned ? '#fca5a5' : '#f8fafc'
                                                    }}>
                                                        {member.nombre} {member.apellido}
                                                    </span>

                                                    {isBanned && (
                                                        <span style={{
                                                            fontSize: '0.60rem',
                                                            fontWeight: 900,
                                                            color: '#ffffff',
                                                            background: '#dc2626',
                                                            padding: '1px 6px',
                                                            borderRadius: '9999px',
                                                            letterSpacing: '0.04em',
                                                            boxShadow: '0 0 8px rgba(220, 38, 38, 0.5)'
                                                        }}>
                                                            ⛔ VETADO DE LA FACCIÓN
                                                        </span>
                                                    )}
                                                </div>

                                                <div style={{
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    fontSize: '0.72rem',
                                                    color: isBanned ? '#fca5a5' : '#94a3b8',
                                                    marginTop: '3px'
                                                }}>
                                                    <span>🎖️ {member.rank_name || 'Sin rango'}</span>
                                                    {member.username && <span>• 👤 @{member.username}</span>}
                                                    {member.email && <span>• ✉️ {member.email}</span>}
                                                    <span>• 📅 Baja: {formattedDate}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Middle: Motivo / Nota (Editable) */}
                                        <div style={{ flex: '2 1 320px', minWidth: '240px' }}>
                                            {isEditingThis ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <textarea
                                                        rows={2}
                                                        value={editingNoteText}
                                                        onChange={e => setEditingNoteText(e.target.value)}
                                                        placeholder="Escribe la nota o motivo de baja..."
                                                        style={{
                                                            width: '100%',
                                                            background: 'rgba(15, 23, 42, 0.9)',
                                                            border: '1px solid rgba(59, 130, 246, 0.5)',
                                                            borderRadius: '6px',
                                                            padding: '0.4rem 0.6rem',
                                                            color: '#f8fafc',
                                                            fontSize: '0.76rem',
                                                            resize: 'vertical',
                                                            outline: 'none'
                                                        }}
                                                    />
                                                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingNoteId(null)}
                                                            disabled={savingNote}
                                                            style={{
                                                                background: 'rgba(255, 255, 255, 0.08)',
                                                                border: 'none',
                                                                color: '#cbd5e1',
                                                                borderRadius: '4px',
                                                                padding: '2px 8px',
                                                                fontSize: '0.70rem',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSaveNote(member.id)}
                                                            disabled={savingNote}
                                                            style={{
                                                                background: '#10b981',
                                                                border: 'none',
                                                                color: '#ffffff',
                                                                borderRadius: '4px',
                                                                padding: '2px 8px',
                                                                fontSize: '0.70rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {savingNote ? 'Guardando...' : 'Guardar'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{
                                                    background: isBanned ? 'rgba(239, 68, 68, 0.15)' : 'rgba(15, 23, 42, 0.5)',
                                                    border: isBanned ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                                                    borderRadius: '8px',
                                                    padding: '0.45rem 0.75rem',
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    justifyContent: 'space-between',
                                                    gap: '8px'
                                                }}>
                                                    <div>
                                                        <div style={{ fontSize: '0.62rem', fontWeight: 800, color: isBanned ? '#fca5a5' : '#94a3b8', textTransform: 'uppercase' }}>
                                                            Motivo de salida / Nota:
                                                        </div>
                                                        <div style={{
                                                            fontSize: '0.76rem',
                                                            color: member.reason ? (isBanned ? '#fee2e2' : '#e2e8f0') : '#64748b',
                                                            fontStyle: member.reason ? 'normal' : 'italic',
                                                            marginTop: '2px',
                                                            lineHeight: 1.3
                                                        }}>
                                                            {member.reason || 'Sin motivo especificado'}
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartEditNote(member)}
                                                        style={{
                                                            background: 'rgba(255, 255, 255, 0.08)',
                                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                                            color: '#cbd5e1',
                                                            borderRadius: '4px',
                                                            padding: '2px 6px',
                                                            fontSize: '0.66rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer',
                                                            flexShrink: 0
                                                        }}
                                                        title="Editar nota/motivo"
                                                    >
                                                        ✏️ Editar
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right: Casilla Vetado Toggle & Actions */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                                            {/* Casilla / Checkbox de Vetado */}
                                            <label style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                background: isBanned ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                                border: isBanned ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                                                padding: '0.35rem 0.65rem',
                                                borderRadius: '6px'
                                            }} title="Marcar o desmarcar veto de la facción (se pondrá todo en rojo)">
                                                <input
                                                    type="checkbox"
                                                    checked={isBanned}
                                                    onChange={() => handleToggleVeto(member)}
                                                    style={{
                                                        accentColor: '#ef4444',
                                                        width: '15px',
                                                        height: '15px',
                                                        cursor: 'pointer'
                                                    }}
                                                />
                                                <span style={{
                                                    fontSize: '0.72rem',
                                                    fontWeight: 800,
                                                    color: isBanned ? '#fca5a5' : '#cbd5e1'
                                                }}>
                                                    {isBanned ? '⛔ Vetado' : 'Vetar'}
                                                </span>
                                            </label>

                                            {/* Restaurar a la plantilla */}
                                            <button
                                                type="button"
                                                onClick={() => handleRestore(member)}
                                                style={{
                                                    background: 'rgba(16, 185, 129, 0.15)',
                                                    border: '1px solid rgba(16, 185, 129, 0.35)',
                                                    color: '#86efac',
                                                    padding: '0.35rem 0.65rem',
                                                    borderRadius: '6px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                                title="Mover de vuelta a la plantilla activa"
                                            >
                                                <span>🔄</span>
                                                <span>Restaurar</span>
                                            </button>

                                            {/* Eliminar permanentemente */}
                                            <button
                                                type="button"
                                                onClick={() => handleDeletePermanent(member)}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                                    color: '#fca5a5',
                                                    padding: '0.35rem 0.55rem',
                                                    borderRadius: '6px',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                                title="Eliminar registro definitivamente"
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
        </div>
    );
}

