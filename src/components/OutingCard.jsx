import '../index.css';

function OutingCard({ data, onExpand, onDelete }) {
    return (
        <div className="announcement-card" style={{ marginBottom: '1rem', background: 'rgba(20, 20, 20, 0.6)', padding: '1rem', borderLeft: '2px solid var(--accent-gold)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h4 style={{ margin: 0, color: 'var(--accent-gold)' }}>{data.title}</h4>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        📅 {new Date(data.occurred_at).toLocaleString()}
                        {data.author_name && <span style={{ marginLeft: '10px' }}>by {data.author_rank} {data.author_name}</span>}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {data.can_delete && (
                        <>
                            <button onClick={() => onEdit && onEdit(data)} style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 5px' }} title="Edit">✎</button>
                            <button onClick={() => onDelete(data.record_id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.2rem', padding: '0 5px' }} title="Delete">&times;</button>
                        </>
                    )}
                </div>
            </div>

            <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 'bold', color: '#ccc' }}>👥 Detecting Team</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {data.detectives && data.detectives.length > 0 ? (
                    data.detectives.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255, 255, 255, 0.08)', padding: '4px 10px 4px 4px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <img src={d.avatar || '/anon.png'} style={{ width: '24px', height: '24px', borderRadius: '50%', border: '1px solid var(--accent-gold)', marginRight: '8px', objectFit: 'cover' }} alt="" />
                            <span style={{ fontSize: '0.85rem', color: '#e0e0e0' }}>{d.rank} {d.name}</span>
                        </div>
                    ))
                ) : (
                    <span style={{ fontStyle: 'italic', color: '#666', fontSize: '0.8rem' }}>No detectives assigned</span>
                )}
            </div>

            {data.reason && (
                <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Reason:</strong>
                    <div style={{ fontSize: '0.9rem' }}>{data.reason}</div>
                </div>
            )}

            {data.info_obtained && (
                <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Intel Obtained:</strong>
                    <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-line' }}>{data.info_obtained}</div>
                </div>
            )}

            {data.gang_names && data.gang_names.length > 0 && (
                <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Linked Syndicates:</strong>
                    <div style={{ fontSize: '0.85rem', color: 'var(--accent-gold)' }}>
                        {data.gang_names.join(', ')}
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
