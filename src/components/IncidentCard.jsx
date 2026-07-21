import { useState, useEffect } from 'react';
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
                    {data.tablet_incident_number && <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)' }}>Tablet #: {data.tablet_incident_number}</div>}
                    {data.gang_names && data.gang_names.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '3px' }}>
                            🏴 {data.gang_names.join(', ')}
                        </div>
                    )}
                    {data.interrogations && data.interrogations.length > 0 && (
                        <div style={{ marginTop: '0.3rem', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {data.interrogations.map(int => (
                                <span key={int.id} style={{
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    color: '#38bdf8',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '0.7rem',
                                    border: '1px solid rgba(56, 189, 248, 0.3)'
                                }}>
                                    🗣️ {int.title}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                    {onEdit && data.can_delete && <button onClick={() => onEdit(data)} style={{ background: 'none', border: 'none', color: 'var(--color-blue-light)', cursor: 'pointer', fontSize: '1.2rem' }}>✏️</button>}
                    {data.can_delete && (
                        <button onClick={() => onDelete(data.record_id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
                    )}
                </div>
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0' }}>
                📅 {new Date(data.occurred_at).toLocaleString()} <br />
                {data.location && <span>📍 {data.location}</span>}
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
                <img src={data.author_avatar || '/anon.png'} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%', marginRight: '5px' }} />
                By {data.author_rank} {data.author_name}
            </div>
        </div>
    );
}

export default IncidentCard;
