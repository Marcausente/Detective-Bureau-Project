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

    // Robust JSON list parsing to handle stringified, double-stringified or raw JSON array structures
    const parseJsonField = (field) => {
        if (!field) return [];
        if (Array.isArray(field)) return field;
        try {
            const parsed = typeof field === 'string' ? JSON.parse(field) : field;
            if (typeof parsed === 'string') {
                const doubleParsed = JSON.parse(parsed);
                return Array.isArray(doubleParsed) ? doubleParsed : [];
            }
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error("Error parsing JSON field in ComplaintCard:", e);
            return [];
        }
    };

    const complainantsList = parseJsonField(data.complainants);
    const accusedList = parseJsonField(data.accused);

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
        <div 
            className="announcement-card" 
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
                marginBottom: '1rem',
                background: isHighlighted ? 'rgba(96, 165, 250, 0.12)' : 'rgba(30, 41, 59, 0.4)',
                padding: '1rem',
                wordWrap: 'break-word',
                overflowWrap: 'anywhere',
                border: isHighlighted ? '2px solid var(--color-blue-light)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                boxShadow: isHighlighted ? '0 0 20px rgba(96, 165, 250, 0.3)' : '0 2px 4px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.25s ease',
                cursor: 'pointer',
                minWidth: 0,
                overflow: 'hidden'
            }}
        >
            {/* Header: Title and Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                            background: 'rgba(212, 175, 55, 0.15)',
                            color: 'var(--accent-gold)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            border: '1px solid rgba(212, 175, 55, 0.3)'
                        }}>
                            DENUNCIA #{data.record_id.substring(0, 6).toUpperCase()}
                        </span>
                        {isClosed ? (
                            <span style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                border: '1px solid rgba(239, 68, 68, 0.3)'
                            }}>
                                {t('closedComplaintsCol')}
                            </span>
                        ) : data.case_id ? (
                            <span style={{
                                background: 'rgba(74, 222, 128, 0.15)',
                                color: '#4ade80',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                border: '1px solid rgba(74, 222, 128, 0.3)'
                            }}>
                                {t('withCaseComplaintsCol')}
                            </span>
                        ) : (
                            <span style={{
                                background: 'rgba(96, 165, 250, 0.15)',
                                color: 'var(--color-blue-light)',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                border: '1px solid rgba(96, 165, 250, 0.3)'
                            }}>
                                {t('openComplaintsCol')}
                            </span>
                        )}
                    </div>
                    
                    <h4 style={{ margin: '0.4rem 0 0.2rem 0', color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: 'bold' }}>
                        {data.titulo || 'Sin título'}
                    </h4>
                </div>

                {/* Edit & Delete Buttons */}
                <div style={{ display: 'flex', gap: '8px', marginLeft: '10px' }}>
                    {onEdit && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onEdit(data); }} 
                            style={{ background: 'none', border: 'none', color: 'var(--color-blue-light)', cursor: 'pointer', fontSize: '1rem', padding: '2px' }}
                            title={t('editItemTitle')}
                        >
                            ✏️
                        </button>
                    )}
                    {data.can_delete && onDelete && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDelete(data.record_id); }} 
                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1.1rem', padding: '2px', lineHeight: 1 }}
                            title={t('deleteBtn')}
                        >
                            &times;
                        </button>
                    )}
                </div>
            </div>

            {/* Date & Metadata */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                📅 {new Date(data.created_at).toLocaleString()}
            </div>

            {/* COLLAPSED SUMMARY VIEW */}
            {!isExpanded && (
                <div style={{ 
                    fontSize: '0.75rem', 
                    color: 'var(--text-secondary)', 
                    display: 'flex', 
                    gap: '8px', 
                    alignItems: 'center', 
                    marginTop: '0.5rem',
                    background: 'rgba(0,0,0,0.1)',
                    padding: '4px 8px',
                    borderRadius: '4px'
                }}>
                    <span>👤 {complainantsList.length} Denunciante(s)</span>
                    <span>•</span>
                    <span>👥 {accusedList.length} Denunciado(s)</span>
                    {data.case_id && (
                        <>
                            <span>•</span>
                            <span style={{ color: '#4ade80' }}>📁 Con Caso</span>
                        </>
                    )}
                </div>
            )}

            {/* EXPANDED DETAILED VIEW */}
            {isExpanded && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Complainants (Denunciantes) */}
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--accent-gold)', marginBottom: '3px', textTransform: 'uppercase' }}>
                            👤 {t('complainantNumber').replace('#{number}', 's')}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {complainantsList.map((c, idx) => (
                                <div key={idx} style={{
                                    background: 'rgba(0,0,0,0.15)',
                                    padding: '5px 8px',
                                    borderRadius: '5px',
                                    borderLeft: '3px solid var(--accent-gold)',
                                    fontSize: '0.8rem'
                                }}>
                                    <div><strong>{c.nombre_apellido}</strong></div>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                                        <span>📞 {c.telefono}</span>
                                        <span>🪪 ID: {c.id_documento}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Accused (Denunciados) */}
                    <div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#f87171', marginBottom: '3px', textTransform: 'uppercase' }}>
                            👤 {t('accusedNumber').replace('#{number}', 's')}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {accusedList.map((a, idx) => (
                                <div key={idx} style={{
                                    background: 'rgba(0,0,0,0.15)',
                                    padding: '5px 8px',
                                    borderRadius: '5px',
                                    borderLeft: '3px solid #f87171',
                                    fontSize: '0.8rem'
                                }}>
                                    <div><strong>{a.nombre_apellido}</strong></div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                                        <em>{a.rasgos_fisicos}</em>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
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

                    {/* Body of Complaint (Motivo & Acontecimientos) */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        padding: '0.6rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--accent-gold)', marginBottom: '2px', textTransform: 'uppercase' }}>
                                🎯 {t('complaintReason')}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                                {data.motivo}
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '6px' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '3px', textTransform: 'uppercase' }}>
                                📖 {t('complaintEvents')}
                            </div>
                            <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-line', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                {data.acontecimientos}
                            </div>
                        </div>
                        
                        {(data.solicitud || data.notas) && (
                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {data.solicitud && (
                                    <div>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block' }}>
                                            🎯 {t('complaintRequest')}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{data.solicitud}</span>
                                    </div>
                                )}
                                {data.notas && (
                                    <div>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'block' }}>
                                            📝 {t('complaintNotes')}
                                        </span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>{data.notas}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Photo Preview */}
                    {data.image_url && (
                        <div>
                            <div onClick={(e) => { e.stopPropagation(); onExpand(data.image_url); }} style={{ display: 'inline-block', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }} title={t('clickViewImage')}>
                                <img src={data.image_url} style={{ height: '60px', width: '100px', objectFit: 'cover' }} alt="Complaint Evidence" />
                            </div>
                        </div>
                    )}

                    {/* Linked Case Banner */}
                    <div 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 6px',
                            background: data.case_id ? 'rgba(74, 222, 128, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '5px',
                            border: data.case_id ? '1px solid rgba(74, 222, 128, 0.15)' : '1px solid rgba(255, 255, 255, 0.04)',
                            fontSize: '0.75rem'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, overflow: 'hidden', flex: 1 }}>
                            <span>📁</span>
                            <span style={{ 
                                color: data.case_id ? '#4ade80' : 'var(--text-secondary)', 
                                fontWeight: data.case_id ? 'bold' : 'normal',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontSize: '0.75rem'
                            }}>
                                {data.case_id ? (data.case_title || t('withCaseComplaintsCol')) : t('noneOption')}
                            </span>
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
                                    padding: '2px 4px',
                                    fontSize: '0.7rem',
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
                </div>
            )}

            {/* Footer Author Profile & Bottom Action Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.6rem' }}>
                {/* Author Info */}
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <img 
                        src={data.author_avatar || '/anon.png'} 
                        alt={data.author_name || "User"} 
                        style={{ width: '20px', height: '20px', borderRadius: '50%', marginRight: '5px', objectFit: 'cover' }} 
                    />
                    <span>
                        {data.author_rank} {data.author_name}
                    </span>
                </div>

                {/* Close / Reopen Trigger */}
                {onStatusChange && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onStatusChange(data.record_id, isClosed ? 'Open' : 'Closed'); }}
                        style={{
                            background: isClosed ? 'rgba(96, 165, 250, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: isClosed ? 'var(--color-blue-light)' : '#f87171',
                            border: isClosed ? '1px solid rgba(96, 165, 250, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
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
