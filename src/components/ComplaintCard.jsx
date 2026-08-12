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
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
                marginBottom: '1rem',
                background: isHighlighted 
                    ? 'rgba(30, 41, 59, 0.85)' 
                    : 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                padding: '1.1rem',
                wordWrap: 'break-word',
                overflowWrap: 'anywhere',
                border: isHighlighted 
                    ? '2px solid #60a5fa' 
                    : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                boxShadow: isHighlighted 
                    ? '0 0 25px rgba(96, 165, 250, 0.35)' 
                    : '0 4px 20px rgba(0, 0, 0, 0.25)',
                transition: 'all 0.25s ease',
                cursor: 'pointer',
                minWidth: 0,
                overflow: 'hidden',
                position: 'relative'
            }}
            className="hover:border-slate-600"
        >
            {/* Header: Badges, Title & Quick Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
                        {/* Complaint ID Badge */}
                        <span style={{
                            background: 'rgba(212, 175, 55, 0.12)',
                            color: '#fbbf24',
                            padding: '3px 8px',
                            borderRadius: '20px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            letterSpacing: '0.03em',
                            border: '1px solid rgba(212, 175, 55, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            #DEN-{data.record_id.substring(0, 6).toUpperCase()}
                        </span>

                        {/* Status Badge */}
                        {isClosed ? (
                            <span style={{
                                background: 'rgba(239, 68, 68, 0.12)',
                                color: '#f87171',
                                padding: '3px 8px',
                                borderRadius: '20px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}>
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f87171' }}></span>
                                {t('closedComplaintsCol') || 'Archivada'}
                            </span>
                        ) : data.case_id ? (
                            <span style={{
                                background: 'rgba(34, 197, 94, 0.12)',
                                color: '#4ade80',
                                padding: '3px 8px',
                                borderRadius: '20px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                border: '1px solid rgba(34, 197, 94, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}>
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ade80' }}></span>
                                {t('withCaseComplaintsCol') || 'Con Caso'}
                            </span>
                        ) : (
                            <span style={{
                                background: 'rgba(59, 130, 246, 0.12)',
                                color: '#60a5fa',
                                padding: '3px 8px',
                                borderRadius: '20px',
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}>
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#60a5fa' }}></span>
                                {t('openComplaintsCol') || 'Abierta'}
                            </span>
                        )}
                    </div>

                    <h4 style={{
                        margin: 0,
                        color: '#f8fafc',
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        lineHeight: 1.3,
                        letterSpacing: '-0.01em'
                    }}>
                        {data.titulo || 'Sin título'}
                    </h4>
                </div>

                {/* Edit & Delete Buttons */}
                <div style={{ display: 'flex', gap: '6px', marginLeft: '6px' }}>
                    {onEdit && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEdit(data); }}
                            style={{
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                color: '#60a5fa',
                                borderRadius: '8px',
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            title={t('editItemTitle') || 'Editar'}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                        </button>
                    )}
                    {data.can_delete && onDelete && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDelete(data.record_id); }}
                            style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                color: '#f87171',
                                borderRadius: '8px',
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            title={t('deleteBtn') || 'Eliminar'}
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Date & Metadata */}
            <div style={{
                fontSize: '0.75rem',
                color: '#94a3b8',
                marginTop: '0.35rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
            }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {new Date(data.created_at).toLocaleString()}
            </div>

            {/* COLLAPSED SUMMARY VIEW */}
            {!isExpanded && (
                <div style={{
                    fontSize: '0.76rem',
                    color: '#cbd5e1',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    marginTop: '0.65rem',
                    background: 'rgba(0, 0, 0, 0.25)',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    flexWrap: 'wrap'
                }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        <strong>{complainantsList.length}</strong> Denunciante(s)
                    </span>
                    <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <strong>{accusedList.length}</strong> Denunciado(s)
                    </span>
                    {data.case_id && (
                        <>
                            <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
                            <span style={{ color: '#4ade80', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                                Con Caso
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* EXPANDED DETAILED VIEW */}
            {isExpanded && (
                <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {/* Complainants (Denunciantes) */}
                    <div>
                        <div style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#fbbf24',
                            marginBottom: '6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            {t('complainantNumber').replace('#{number}', 's') || 'Denunciantes'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {complainantsList.map((c, idx) => (
                                <div key={idx} style={{
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    padding: '7px 10px',
                                    borderRadius: '8px',
                                    borderLeft: '3px solid #fbbf24',
                                    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                                    borderRight: '1px solid rgba(255, 255, 255, 0.04)',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                    fontSize: '0.82rem'
                                }}>
                                    <div style={{ color: '#f8fafc', fontWeight: 600 }}>{c.nombre_apellido}</div>
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                        <span>📞 {c.telefono || 'N/A'}</span>
                                        <span>🪪 ID: {c.id_documento || 'N/A'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Accused (Denunciados) */}
                    <div>
                        <div style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#f87171',
                            marginBottom: '6px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            {t('accusedNumber').replace('#{number}', 's') || 'Denunciados'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {accusedList.map((a, idx) => (
                                <div key={idx} style={{
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    padding: '7px 10px',
                                    borderRadius: '8px',
                                    borderLeft: '3px solid #f87171',
                                    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                                    borderRight: '1px solid rgba(255, 255, 255, 0.04)',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                                    fontSize: '0.82rem'
                                }}>
                                    <div style={{ color: '#f8fafc', fontWeight: 600 }}>{a.nombre_apellido}</div>
                                    {a.rasgos_fisicos && a.rasgos_fisicos !== 'N/A' && (
                                        <div style={{ fontSize: '0.72rem', color: '#cbd5e1', fontStyle: 'italic', marginTop: '1px' }}>
                                            {a.rasgos_fisicos}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                                        <span>📞 {a.telefono || 'N/A'}</span>
                                        <span>🪪 ID: {a.id_documento || 'N/A'}</span>
                                        {a.instapic && a.instapic !== 'N/A' && (
                                            <span style={{ color: '#f472b6', fontWeight: 600 }}>📸 @{a.instapic}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Body of Complaint (Motivo & Acontecimientos) */}
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        padding: '0.75rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <div>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#60a5fa', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                🎯 {t('complaintReason') || 'Motivo de la Denuncia'}
                            </div>
                            <div style={{ fontSize: '0.88rem', color: '#f1f5f9', fontWeight: 600 }}>
                                {data.motivo}
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px' }}>
                            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                📖 {t('complaintEvents') || 'Acontecimientos'}
                            </div>
                            <div style={{ fontSize: '0.84rem', whiteSpace: 'pre-line', color: '#cbd5e1', lineHeight: 1.45 }}>
                                {data.acontecimientos}
                            </div>
                        </div>

                        {(data.solicitud || data.notas) && (
                            <div style={{ marginTop: '4px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {data.solicitud && (
                                    <div>
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>
                                            🎯 {t('complaintRequest') || 'Solicitud'}
                                        </span>
                                        <span style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>{data.solicitud}</span>
                                    </div>
                                )}
                                {data.notas && (
                                    <div>
                                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', display: 'block', textTransform: 'uppercase' }}>
                                            📝 {t('complaintNotes') || 'Notas Adicionales'}
                                        </span>
                                        <span style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>{data.notas}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Photo Evidence Preview */}
                    {data.image_url && (
                        <div>
                            <div
                                onClick={(e) => { e.stopPropagation(); onExpand(data.image_url); }}
                                style={{
                                    display: 'inline-block',
                                    cursor: 'pointer',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
                                }}
                                title={t('clickViewImage') || 'Ver imagen adjunta'}
                            >
                                <img src={data.image_url} style={{ height: '70px', width: '110px', objectFit: 'cover', display: 'block' }} alt="Evidencia" />
                                <div style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'rgba(0, 0, 0, 0.25)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: 0,
                                    transition: 'opacity 0.2s'
                                }}
                                className="hover:opacity-100"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        <line x1="11" y1="8" x2="11" y2="14" />
                                        <line x1="8" y1="11" x2="14" y2="11" />
                                    </svg>
                                </div>
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
                            padding: '6px 10px',
                            background: data.case_id ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                            borderRadius: '8px',
                            border: data.case_id ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(255, 255, 255, 0.06)',
                            fontSize: '0.78rem'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflow: 'hidden', flex: 1 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={data.case_id ? '#4ade80' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                            </svg>
                            <span style={{
                                color: data.case_id ? '#4ade80' : '#94a3b8',
                                fontWeight: data.case_id ? 700 : 400,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}>
                                {data.case_id ? (data.case_title || t('withCaseComplaintsCol') || 'Con Caso Vinculado') : (t('noneOption') || 'Sin caso vinculado')}
                            </span>
                        </div>

                        {/* Case Link Selector (Only when complaint is not Closed) */}
                        {!isClosed && (
                            <select
                                value={data.case_id || ""}
                                onChange={handleCaseLinkChange}
                                style={{
                                    background: 'rgba(15, 23, 42, 0.9)',
                                    color: '#f1f5f9',
                                    border: '1px solid rgba(255, 255, 255, 0.14)',
                                    borderRadius: '6px',
                                    padding: '3px 8px',
                                    fontSize: '0.72rem',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    maxWidth: '140px'
                                }}
                            >
                                <option value="">{t('noneOption') || 'Ninguno'}</option>
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

            {/* Footer Author Profile & Action Buttons */}
            <div style={{
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                marginTop: '0.75rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                paddingTop: '0.65rem'
            }}>
                {/* Author Info */}
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <img
                        src={data.author_avatar || '/logowebp/anon.webp'}
                        alt={data.author_name || "Usuario"}
                        style={{ width: '22px', height: '22px', borderRadius: '50%', marginRight: '7px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <span style={{ color: '#cbd5e1', fontWeight: 500 }}>
                        {data.author_rank} {data.author_name}
                    </span>
                </div>

                {/* Close / Reopen Trigger */}
                {onStatusChange && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onStatusChange(data.record_id, isClosed ? 'Open' : 'Closed'); }}
                        style={{
                            background: isClosed ? 'rgba(59, 130, 246, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: isClosed ? '#60a5fa' : '#f87171',
                            border: isClosed ? '1px solid rgba(59, 130, 246, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '0.72rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        {isClosed ? (
                            <>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <polyline points="1 4 1 10 7 10" />
                                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                </svg>
                                {t('reopenComplaintBtn') || 'Reabrir'}
                            </>
                        ) : (
                            <>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                    <polyline points="21 8 21 21 3 21 3 8" />
                                    <rect x="1" y="3" width="22" height="5" />
                                    <line x1="10" y1="12" x2="14" y2="12" />
                                </svg>
                                {t('archiveComplaintBtn') || 'Archivar'}
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}

export default ComplaintCard;

