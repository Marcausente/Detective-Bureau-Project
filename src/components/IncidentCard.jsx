import { useState, useEffect } from 'react';
import { getProfileImage } from '../utils/imageStorage';
import '../index.css';

function IncidentCard({ data, onExpand, onDelete, onEdit, isHighlighted }) {
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (isHighlighted) {
            setIsExpanded(true);
        }
    }, [isHighlighted]);

    return (
        <div className="announcement-card" style={{
            marginBottom: '1rem',
            background: isHighlighted ? 'rgba(var(--color-blue-rgb), 0.12)' : 'rgba(var(--secondary-rgb), 0.4)',
            padding: '1rem',
            wordWrap: 'break-word',
            overflowWrap: 'anywhere',
            border: isHighlighted ? '2px solid var(--color-blue-light)' : '2px solid transparent',
            borderRadius: '8px',
            boxShadow: isHighlighted ? '0 0 20px rgba(var(--color-blue-rgb), 0.3)' : 'none',
            transition: 'all 0.3s'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>{data.title}</h4>
                    {data.tablet_incident_number && <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', marginTop: '2px' }}>Tablet #: {data.tablet_incident_number}</div>}
                    {data.gang_names && data.gang_names.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                                <line x1="4" y1="22" x2="4" y2="15" />
                            </svg>
                            {data.gang_names.join(', ')}
                        </div>
                    )}
                    {data.interrogations && data.interrogations.length > 0 && (
                        <div style={{ marginTop: '0.4rem', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {data.interrogations.map(int => (
                                <span key={int.id} style={{
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    color: '#38bdf8',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '0.7rem',
                                    border: '1px solid rgba(56, 189, 248, 0.3)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    {int.title}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                    {onEdit && data.can_delete && (
                        <button
                            onClick={() => onEdit(data)}
                            style={{
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                color: 'var(--color-blue-light)',
                                borderRadius: '6px',
                                width: '26px',
                                height: '26px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
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
                    )}
                    {data.can_delete && (
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
                                justifyContent: 'center',
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
                    )}
                </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.6rem 0', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {new Date(data.occurred_at).toLocaleString()}
                </div>
                {data.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                        </svg>
                        {data.location}
                    </div>
                )}
            </div>

            {data.description && (
                <div
                    onClick={() => setIsExpanded(!isExpanded)}
                    title={isExpanded ? "Click to collapse" : "Click to expand"}
                    style={{
                        fontSize: '0.9rem',
                        whiteSpace: 'pre-line',
                        marginBottom: '0.5rem',
                        cursor: 'pointer',
                        ...(isExpanded ? {} : {
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                        })
                    }}
                >
                    {data.description}
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

            <div style={{ marginTop: '0.8rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <img src={getProfileImage(data.author_avatar, '/logowebp/anon.webp')} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%', marginRight: '5px' }} />
                By {data.author_rank} {data.author_name}
            </div>
        </div>
    );
}

export default IncidentCard;

