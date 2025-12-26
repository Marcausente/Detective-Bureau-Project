import '../index.css';

function OutingCard({ data, onExpand, onDelete }) {
    return (
        <div className="announcement-card" style={{ marginBottom: '1rem', background: 'rgba(20, 20, 20, 0.6)', padding: '1rem', borderLeft: '2px solid var(--accent-gold)' }}>
            <div style={{ display: 'flex', justifySelf: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ margin: 0, color: 'var(--accent-gold)' }}>{data.title}</h4>
                {data.can_delete && (
                    <button onClick={() => onDelete(data.record_id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.2rem', marginLeft: 'auto' }}>&times;</button>
                )}
            </div>

            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                📅 {new Date(data.occurred_at).toLocaleString()}
            </div>

            <div style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>👥 Detecting Team</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {data.detectives && data.detectives.map((d, i) => (
                    <div key={i} title={`${d.rank} ${d.name}`} style={{ position: 'relative' }}>
                        <img src={d.avatar || '/anon.png'} style={{ width: '30px', height: '30px', borderRadius: '50%', border: '1px solid var(--accent-gold)' }} alt="" />
                    </div>
                ))}
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
