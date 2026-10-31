import { useState } from 'react';

export default function PlantillaArchiveModal({
    isOpen,
    onClose,
    agent,
    currentUser,
    onConfirmArchive
}) {
    const [reason, setReason] = useState('');
    const [isBanned, setIsBanned] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen || !agent) return null;

    const agentName = `${agent.nombre || ''} ${agent.apellido || ''}`.trim() || agent.username || 'Agente';
    const agentPlaca = agent.no_placa ? `#${agent.no_placa}` : 'S/P';
    const agentRank = agent.rank_name || agent.rango || 'Sin Rango';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            setSaving(true);
            const currentUserName = currentUser?.nombre 
                ? `${currentUser.nombre} ${currentUser.apellido || ''}`.trim() 
                : (currentUser?.username || 'Comandancia');

            await onConfirmArchive({
                agent,
                reason: reason.trim(),
                isBanned,
                archivedBy: currentUserName
            });
            onClose();
        } catch (err) {
            console.error('Error al archivar agente:', err);
            setError(err.message || 'Error al archivar agente');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(2, 6, 23, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: '1rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '520px',
                background: '#0f172a',
                border: isBanned ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '18px',
                boxShadow: isBanned ? '0 20px 50px rgba(239, 68, 68, 0.25)' : '0 20px 50px rgba(0, 0, 0, 0.65)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'all 0.25s ease'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.15rem 1.4rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    background: isBanned 
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(15, 23, 42, 0.9))'
                        : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(15, 23, 42, 0.9))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: isBanned ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                            border: isBanned ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(245, 158, 11, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem'
                        }}>
                            {isBanned ? '⛔' : '🗄️'}
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#f8fafc' }}>
                                Archivar Miembro (Baja de Facción)
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
                                Se retirará de la plantilla activa y se guardará en antiguos miembros
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#cbd5e1',
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.85rem'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Error Banner */}
                    {error && (
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '8px',
                            padding: '0.6rem 0.8rem',
                            color: '#fca5a5',
                            fontSize: '0.78rem',
                            display: 'flex',
                            gap: '6px',
                            alignItems: 'center'
                        }}>
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Agent Preview Card */}
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.65)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '0.85rem 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                    }}>
                        <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            flexShrink: 0
                        }}>
                            {agent.avatar_url ? (
                                <img src={agent.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ fontSize: '1.2rem' }}>👮</span>
                            )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{
                                    fontSize: '0.62rem',
                                    fontWeight: 900,
                                    color: '#60a5fa',
                                    background: 'rgba(59, 130, 246, 0.15)',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(59, 130, 246, 0.3)'
                                }}>
                                    {agentPlaca}
                                </span>
                                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {agentName}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                <span>🎖️ {agentRank}</span>
                                {agent.username && <span>• @{agent.username}</span>}
                                {agent.email && <span>• {agent.email}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Motivo / Nota de salida */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '0.74rem',
                            fontWeight: 800,
                            color: '#cbd5e1',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            marginBottom: '6px'
                        }}>
                            Motivo de salida / Nota de baja
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Ej: Dimisión voluntaria por motivos personales, baja médica, inactividad prolongada..."
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(15, 23, 42, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '8px',
                                padding: '0.6rem 0.8rem',
                                color: '#f8fafc',
                                fontSize: '0.82rem',
                                resize: 'vertical',
                                minHeight: '75px',
                                outline: 'none'
                            }}
                        />
                        <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '3px' }}>
                            Esta nota se guardará en su expediente de antiguos miembros y podrás editarla en cualquier momento.
                        </div>
                    </div>

                    {/* Casilla de Vetado (Blacklist) */}
                    <div style={{
                        background: isBanned ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                        border: isBanned ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        padding: '0.85rem 1rem',
                        transition: 'all 0.2s ease'
                    }}>
                        <label style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '10px',
                            cursor: 'pointer',
                            userSelect: 'none'
                        }}>
                            <input
                                type="checkbox"
                                checked={isBanned}
                                onChange={e => setIsBanned(e.target.checked)}
                                style={{
                                    marginTop: '2px',
                                    width: '16px',
                                    height: '16px',
                                    accentColor: '#ef4444',
                                    cursor: 'pointer'
                                }}
                            />
                            <div>
                                <div style={{
                                    fontSize: '0.82rem',
                                    fontWeight: 900,
                                    color: isBanned ? '#fca5a5' : '#f8fafc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <span>⛔</span>
                                    <span>Vetar a este usuario de la facción (Blacklist de reingreso)</span>
                                </div>
                                <div style={{ fontSize: '0.70rem', color: isBanned ? '#f87171' : '#94a3b8', marginTop: '2px' }}>
                                    Si se marca, el usuario aparecerá resaltado completamente en rojo en el registro histórico y alertará de su veto permanente o temporal.
                                </div>
                            </div>
                        </label>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#cbd5e1',
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.80rem',
                                cursor: 'pointer'
                            }}
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            style={{
                                background: isBanned 
                                    ? 'linear-gradient(135deg, #dc2626, #b91c1c)' 
                                    : 'linear-gradient(135deg, #f59e0b, #d97706)',
                                border: 'none',
                                color: '#ffffff',
                                padding: '0.5rem 1.15rem',
                                borderRadius: '8px',
                                fontWeight: 800,
                                fontSize: '0.80rem',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: isBanned 
                                    ? '0 4px 14px rgba(220, 38, 38, 0.4)' 
                                    : '0 4px 14px rgba(245, 158, 11, 0.35)'
                            }}
                        >
                            <span>{saving ? '⏳' : (isBanned ? '⛔' : '🗄️')}</span>
                            <span>{saving ? 'Archivando...' : 'Confirmar y Archivar'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
