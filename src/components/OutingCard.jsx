import { getProfileImage } from '../utils/imageStorage';
import '../index.css';

const getTagStyles = (tag) => {
    switch (tag) {
        case 'ORDINARIA':
            return {
                backgroundColor: 'rgba(74, 222, 128, 0.15)',
                color: '#4ade80',
                border: '1px solid rgba(74, 222, 128, 0.3)'
            };
        case 'FOXTROT':
            return {
                backgroundColor: 'rgba(var(--color-blue-rgb), 0.15)',
                color: 'var(--color-blue-light)',
                border: '1px solid rgba(var(--color-blue-rgb), 0.3)'
            };
        case 'MIKE':
            return {
                backgroundColor: 'rgba(217, 119, 6, 0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(217, 119, 6, 0.3)'
            };
        case 'FUERA DE SERVICIO':
            return {
                backgroundColor: 'rgba(156, 163, 175, 0.15)',
                color: '#9ca3af',
                border: '1px solid rgba(156, 163, 175, 0.3)'
            };
        default:
            return null;
    }
};

function OutingCard({ data, onExpand, onDelete, onEdit, isHighlighted }) {
    const tagStyles = getTagStyles(data.tag);
    return (
        <div className="announcement-card" style={{
            marginBottom: '1rem',
            background: isHighlighted ? 'rgba(212, 175, 55, 0.12)' : 'rgba(20, 20, 20, 0.6)',
            padding: '1rem',
            borderLeft: isHighlighted ? '4px solid #d4af37' : '2px solid var(--accent-gold)',
            wordWrap: 'break-word',
            overflowWrap: 'anywhere',
            boxShadow: isHighlighted ? '0 0 20px rgba(212, 175, 55, 0.35)' : 'none',
            borderRadius: isHighlighted ? '8px' : undefined,
            transition: 'all 0.3s'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                        <h4 style={{ margin: 0, color: 'var(--accent-gold)' }}>{data.title}</h4>
                        {data.tag && tagStyles && (
                            <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                ...tagStyles
                            }}>
                                {data.tag}
                            </span>
                        )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        {new Date(data.occurred_at).toLocaleString()}
                        {data.author_name && <span style={{ marginLeft: '6px', color: '#94a3b8' }}>• por {data.author_rank} {data.author_name}</span>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {data.can_delete && (
                        <>
                            <button
                                onClick={() => onEdit && onEdit(data)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.06)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    color: 'var(--accent-gold)',
                                    borderRadius: '6px',
                                    width: '26px',
                                    height: '26px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justify: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                title="Editar"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                            </button>
                            <button
                                onClick={() => onDelete(data.record_id)}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                    color: '#f87171',
                                    borderRadius: '6px',
                                    width: '26px',
                                    height: '26px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justify: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                title="Eliminar"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Equipo de Detectives
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {data.detectives && data.detectives.length > 0 ? (
                    data.detectives.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.08)', padding: '4px 10px 4px 4px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <img src={getProfileImage(d.avatar, '/logowebp/anon.webp')} style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid var(--accent-gold)', marginRight: '8px', objectFit: 'cover' }} alt="" />
                            <span style={{ fontSize: '0.85rem', color: '#e0e0e0' }}>{d.rank} {d.name}</span>
                        </div>
                    ))
                ) : (
                    <span style={{ fontStyle: 'italic', color: '#666', fontSize: '0.8rem' }}>Sin detectives asignados</span>
                )}
            </div>

            {data.reason && (
                <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Motivo:</strong>
                    <div style={{ fontSize: '0.9rem' }}>{data.reason}</div>
                </div>
            )}

            {data.info_obtained && (
                <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Información Obtenida:</strong>
                    <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-line' }}>{data.info_obtained}</div>
                </div>
            )}

            {data.gang_names && data.gang_names.length > 0 && (
                <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>Bandas Vinculadas:</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                            <line x1="4" y1="22" x2="4" y2="15" />
                        </svg>
                        {data.gang_names.join(', ')}
                    </div>
                </div>
            )}

            {data.interrogations && data.interrogations.length > 0 && (
                <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.3rem' }}>Interrogatorios Vinculados:</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {data.interrogations.map(int => (
                            <span key={int.id} style={{
                                fontSize: '0.72rem',
                                background: 'rgba(59, 130, 246, 0.15)',
                                color: '#93c5fd',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                                {int.title}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {data.images && data.images.length > 0 && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {data.images.map((src, i) => (
                        <div key={i} onClick={() => onExpand(src)} style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                            <img src={src} style={{ height: '60px', width: '60px', objectFit: 'cover' }} alt="" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default OutingCard;

