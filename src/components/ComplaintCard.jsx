import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import '../index.css';

function ComplaintCard({
    data,
    onExpand,
    onDelete,
    onEdit,
    onStatusChange,
    onLinkCase,
    openCases = [],
    isHighlighted
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { t } = useLanguage();

    // Determine current column category for status changes
    const isClosed = data.status === 'Closed';

    // Handle Quick Linking dropdown change
    const handleCaseLinkChange = async (e) => {
        const selectedCaseId = e.target.value;
        if (onLinkCase) {
            onLinkCase(data.record_id, selectedCaseId === "" ? null : selectedCaseId);
        }
    };

    return (
        <div className="announcement-card" style={{
            marginBottom: '1.5rem',
            background: isHighlighted ? 'rgba(96, 165, 250, 0.12)' : 'rgba(30, 41, 59, 0.4)',
            padding: '1.25rem',
            wordWrap: 'break-word',
            overflowWrap: 'anywhere',
            border: isHighlighted ? '2px solid #60a5fa' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            boxShadow: isHighlighted ? '0 0 20px rgba(96, 165, 250, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s ease-in-out'
        }}>
            {/* Header: Title and Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                            background: 'rgba(212, 175, 55, 0.15)',
                            color: 'var(--accent-gold)',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            border: '1px solid rgba(212, 175, 55, 0.3)'
                        }}>
                            DENUNCIA #{data.record_id.substring(0, 6).toUpperCase()}
                        </span>
                        {isClosed ? (
                            <span style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                border: '1px solid rgba(239, 68, 68, 0.3)'
                            }}>
                                {t('closedComplaintsCol')}
                            </span>
                        ) : data.case_id ? (
                            <span style={{
                                background: 'rgba(74, 222, 128, 0.15)',
                                color: '#4ade80',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                border: '1px solid rgba(74, 222, 128, 0.3)'
                            }}>
                                {t('withCaseComplaintsCol')}
                            </span>
                        ) : (
                            <span style={{
                                background: 'rgba(96, 165, 250, 0.15)',
                                color: '#60a5fa',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                border: '1px solid rgba(96, 165, 250, 0.3)'
                            }}>
                                {t('openComplaintsCol')}
                            </span>
                        )}
                    </div>
                    
                    <h4 style={{ margin: '0.5rem 0 0.25rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                        {data.motivo}
                    </h4>
                </div>

                {/* Edit & Delete Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginLeft: '10px' }}>
                    {onEdit && (
                        <button 
                            onClick={() => onEdit(data)} 
                            style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '1.1rem', padding: '2px' }}
                            title={t('editItemTitle')}
                        >
                            ✏️
                        </button>
                    )}
                    {data.can_delete && onDelete && (
                        <button 
                            onClick={() => onDelete(data.record_id)} 
                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.2rem', padding: '2px', lineHeight: 1 }}
                            title={t('deleteBtn')}
                        >
                            &times;
                        </button>
                    )}
                </div>
            </div>

            {/* Date & Metadata */}
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                📅 {new Date(data.created_at).toLocaleString()}
            </div>

            {/* Complainants (Denunciantes) */}
            <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--accent-gold)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    👤 {t('complainantNumber').replace('#{number}', 's')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {data.complainants && data.complainants.map((c, idx) => (
                        <div key={idx} style={{
                            background: 'rgba(0,0,0,0.15)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            borderLeft: '3px solid var(--accent-gold)',
                            fontSize: '0.85rem'
                        }}>
                            <div><strong>{c.nombre_apellido}</strong></div>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                <span>📞 {c.telefono}</span>
                                <span>🪪 ID: {c.id_documento}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Accused (Denunciados) */}
            <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#f87171', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    👤 {t('accusedNumber').replace('#{number}', 's')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {data.accused && data.accused.map((a, idx) => (
                        <div key={idx} style={{
                            background: 'rgba(0,0,0,0.15)',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            borderLeft: '3px solid #f87171',
                            fontSize: '0.85rem'
                        }}>
                            <div><strong>{a.nombre_apellido}</strong></div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                🕵️‍♂️ <em>{a.rasgos_fisicos}</em>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                <span>📞 {a.telefono}</span>
                                <span>🪪 ID: {a.id_documento}</span>
                                {a.instapic && a.instapic !== 'N/A' && (
                                    <span style={{ color: '#ec4899' }}>📸 @{a.instapic}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Body of Complaint (Acontecimientos) */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                marginBottom: '0.75rem'
            }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase' }}>
                    📖 {t('complaintEvents')}
                </div>
                <div
                    onClick={() => setIsExpanded(!isExpanded)}
                    title={isExpanded ? "Click to collapse" : "Click to expand"}
                    style={{
                        fontSize: '0.9rem',
                        whiteSpace: 'pre-line',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        lineHeight: 1.4,
                        ...(isExpanded ? {} : {
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                        })
                    }}
                >
                    {data.acontecimientos}
                </div>
                {!isExpanded && data.acontecimientos.split('\n').length > 3 && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', marginTop: '4px', cursor: 'pointer' }} onClick={() => setIsExpanded(true)}>
                        {t('clickToExpand')}
                    </div>
                )}

                {/* Optional fields shown on expansion */}
                {isExpanded && (
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {data.solicitud && (
                            <div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block' }}>
                                    🎯 {t('complaintRequest')}
                                </span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{data.solicitud}</span>
                            </div>
                        )}
                        {data.notas && (
                            <div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block' }}>
                                    📝 {t('complaintNotes')}
                                </span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{data.notas}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Photo Preview */}
            {data.image_url && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                    <div onClick={() => onExpand(data.image_url)} style={{ cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', overflow: 'hidden' }} title={t('clickViewImage')}>
                        <img src={data.image_url} style={{ height: '70px', width: '120px', objectFit: 'cover' }} alt="Complaint Evidence" />
                    </div>
                </div>
            )}

            {/* Linked Case Banner */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                background: data.case_id ? 'rgba(74, 222, 128, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                borderRadius: '6px',
                border: data.case_id ? '1px solid rgba(74, 222, 128, 0.2)' : '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '0.8rem',
                marginBottom: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span>📁</span>
                    {data.case_id ? (
                        <span style={{ color: '#4ade80', fontWeight: 'bold' }}>
                            {data.case_title || t('withCaseComplaintsCol')}
                        </span>
                    ) : (
                        <span style={{ color: 'var(--text-secondary)' }}>
                            {t('noneOption')}
                        </span>
                    )}
                </div>

                {/* Case Link Selector (Only when complaint is not Closed) */}
                {!isClosed && (
                    <select
                        value={data.case_id || ""}
                        onChange={handleCaseLinkChange}
                        style={{
                            background: 'var(--bg-dark)',
                            color: 'var(--text-primary)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            outline: 'none',
                            maxWidth: '120px'
                        }}
                    >
                        <option value="">{t('noneOption')}</option>
                        {openCases.map((c) => (
                            <option key={c.id} value={c.id}>
                                #{String(c.case_number).padStart(3, '0')} - {c.title}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Footer Author Profile & Bottom Action Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                {/* Author Info */}
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <img 
                        src={data.author_avatar || '/anon.png'} 
                        alt={data.author_name || "User"} 
                        style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '6px', objectFit: 'cover' }} 
                    />
                    <span>
                        {data.author_rank} {data.author_name}
                    </span>
                </div>

                {/* Close / Reopen Trigger */}
                {onStatusChange && (
                    <button
                        onClick={() => onStatusChange(data.record_id, isClosed ? 'Open' : 'Closed')}
                        style={{
                            background: isClosed ? 'rgba(96, 165, 250, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: isClosed ? '#60a5fa' : '#f87171',
                            border: isClosed ? '1px solid rgba(96, 165, 250, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            transition: 'all 0.2s'
                        }}
                    >
                        {isClosed ? t('reopenComplaintBtn') : t('archiveComplaintBtn')}
                    </button>
                )}
            </div>
        </div>
    );
}

export default ComplaintCard;
