import { useState, useEffect, useMemo, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { filterBucketImages, getProfileImage } from '../utils/imageStorage';

/**
 * Strips HTML tags to produce a clean plain-text summary snippet.
 */
function stripHtmlTags(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Formats date into readable string and calculates relative time.
 */
function formatChronologicalDate(dateString) {
    if (!dateString) return { formatted: 'Fecha desconocida', relative: '' };
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return { formatted: 'Fecha inválida', relative: '' };

        const formatted = date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Relative time calculation
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        let relative = '';
        if (diffDays === 0) {
            if (diffHours < 1) relative = 'hace un momento';
            else relative = `hace ${diffHours}h`;
        } else if (diffDays === 1) {
            relative = 'ayer';
        } else if (diffDays < 30) {
            relative = `hace ${diffDays} días`;
        } else {
            const months = Math.floor(diffDays / 30);
            relative = `hace ${months} mes${months > 1 ? 'es' : ''}`;
        }

        return { formatted, relative };
    } catch {
        return { formatted: String(dateString), relative: '' };
    }
}

const AgentActivityHistory = forwardRef(function AgentActivityHistory(
    { userId, userName, activeCategory = 'all', onCategoryChange, onStatsUpdate },
    ref
) {
    const navigate = useNavigate();
    const { t } = useLanguage();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Raw datasets
    const [incidents, setIncidents] = useState([]);
    const [matrices, setMatrices] = useState([]);
    const [outings, setOutings] = useState([]);
    const [docs, setDocs] = useState([]);

    // Internal or Controlled Filter
    const [selectedTab, setSelectedTab] = useState(activeCategory || 'all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGangFilter, setSelectedGangFilter] = useState('');
    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' (newest first) | 'asc'
    const [displayLimit, setDisplayLimit] = useState(15);

    // Quick View Modal
    const [previewItem, setPreviewItem] = useState(null);
    const [expandedImage, setExpandedImage] = useState(null);

    // Sync external activeCategory if provided
    useEffect(() => {
        if (activeCategory) {
            setSelectedTab(activeCategory);
            setDisplayLimit(15);
        }
    }, [activeCategory]);

    const handleTabSwitch = (tab) => {
        setSelectedTab(tab);
        setDisplayLimit(15);
        if (onCategoryChange) {
            onCategoryChange(tab);
        }
    };

    // Load all activity for the specified target user
    useEffect(() => {
        if (!userId) return;
        fetchAgentActivity();
    }, [userId]);

    const fetchAgentActivity = async () => {
        try {
            setLoading(true);
            setError(null);

            // 1. Incidents (Informes)
            const incPromise = (async () => {
                try {
                    const { data, error: incErr } = await supabase
                        .from('incidents')
                        .select(`
                            id,
                            title,
                            location,
                            occurred_at,
                            created_at,
                            tablet_incident_number,
                            description,
                            images,
                            incident_gangs (
                                gang_id,
                                gangs (
                                    id,
                                    name,
                                    color
                                )
                            )
                        `)
                        .eq('author_id', userId)
                        .order('occurred_at', { ascending: false });

                    if (incErr) {
                        // Fallback without junction if schema relationship issues
                        console.warn('Incident join query failed, falling back to simple select:', incErr);
                        const { data: fallbackData } = await supabase
                            .from('incidents')
                            .select('id, title, location, occurred_at, created_at, tablet_incident_number, description, images')
                            .eq('author_id', userId)
                            .order('occurred_at', { ascending: false });
                        return fallbackData || [];
                    }
                    return data || [];
                } catch (err) {
                    console.error('Error fetching agent incidents:', err);
                    return [];
                }
            })();

            // 2. Matrices (Gang Unit Patrol Logs)
            const matPromise = (async () => {
                try {
                    const { data, error: matErr } = await supabase
                        .from('gang_patrol_logs')
                        .select(`
                            id,
                            gang_id,
                            patrol_time,
                            people_count,
                            photo,
                            notes,
                            created_at,
                            gangs (
                                id,
                                name,
                                color
                            )
                        `)
                        .eq('created_by', userId)
                        .order('patrol_time', { ascending: false });

                    if (matErr) {
                        console.warn('Patrol logs join failed, falling back:', matErr);
                        const { data: fallbackData } = await supabase
                            .from('gang_patrol_logs')
                            .select('id, gang_id, patrol_time, people_count, photo, notes, created_at')
                            .eq('created_by', userId)
                            .order('patrol_time', { ascending: false });
                        return fallbackData || [];
                    }
                    return data || [];
                } catch (err) {
                    console.error('Error fetching agent matrices:', err);
                    return [];
                }
            })();

            // 3. Outings (Vigilancias)
            const outPromise = (async () => {
                try {
                    const { data, error: outErr } = await supabase
                        .from('outings')
                        .select(`
                            id,
                            title,
                            occurred_at,
                            created_at,
                            reason,
                            info_obtained,
                            images,
                            documents,
                            outing_gangs (
                                gang_id,
                                gangs (
                                    id,
                                    name,
                                    color
                                )
                            )
                        `)
                        .eq('created_by', userId)
                        .order('occurred_at', { ascending: false });

                    if (outErr) {
                        console.warn('Outings join failed, falling back:', outErr);
                        const { data: fallbackData } = await supabase
                            .from('outings')
                            .select('id, title, occurred_at, created_at, reason, info_obtained, images, documents')
                            .eq('created_by', userId)
                            .order('occurred_at', { ascending: false });
                        return fallbackData || [];
                    }
                    return data || [];
                } catch (err) {
                    console.error('Error fetching agent outings:', err);
                    return [];
                }
            })();

            // 4. Documentation Posts (Office Reports)
            const docPromise = (async () => {
                try {
                    const { data } = await supabase
                        .from('documentation_posts')
                        .select('id, title, description, url, category, created_at')
                        .eq('author_id', userId)
                        .order('created_at', { ascending: false });
                    return data || [];
                } catch (err) {
                    console.error('Error fetching agent doc posts:', err);
                    return [];
                }
            })();

            const [incList, matList, outList, docList] = await Promise.all([
                incPromise,
                matPromise,
                outPromise,
                docPromise
            ]);

            setIncidents(incList);
            setMatrices(matList);
            setOutings(outList);
            setDocs(docList);

            if (onStatsUpdate) {
                onStatsUpdate({
                    incidents: incList.length,
                    matrix: matList.length,
                    outings: outList.length,
                    documents: docList.length
                });
            }
        } catch (err) {
            console.error('Error fetching user activity history:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Standardize and merge all contributions into one unified chronological dataset
    const unifiedActivities = useMemo(() => {
        const items = [];

        // 1. Map Incidents
        incidents.forEach(inc => {
            const dateStr = inc.occurred_at || inc.created_at;
            const gangsList = (inc.incident_gangs || [])
                .map(ig => ig.gangs)
                .filter(Boolean);

            items.push({
                id: inc.id,
                type: 'incident',
                typeLabel: t('tabIncidents') || 'Informe',
                typeIcon: '📄',
                themeColor: '#3b82f6',
                bgBadge: 'rgba(59, 130, 246, 0.15)',
                borderBadge: 'rgba(59, 130, 246, 0.35)',
                title: inc.title || 'Informe sin título',
                tabletNumber: inc.tablet_incident_number,
                location: inc.location,
                dateStr,
                dateObj: new Date(dateStr),
                gangs: gangsList,
                images: filterBucketImages(inc.images || []),
                notes: stripHtmlTags(inc.description),
                rawDescription: inc.description,
                navigatePath: `/incidents?incident_id=${inc.id}`,
                raw: inc
            });
        });

        // 2. Map Matrices (GU Patrol Logs)
        matrices.forEach(mat => {
            const dateStr = mat.patrol_time || mat.created_at;
            const gangObj = mat.gangs || null;
            const gangName = gangObj?.name || 'Banda';
            const gangsList = gangObj ? [gangObj] : [];

            items.push({
                id: mat.id,
                type: 'matrix',
                typeLabel: t('tabMatrices') || 'Matriz GU',
                typeIcon: '📈',
                themeColor: '#10b981',
                bgBadge: 'rgba(16, 185, 129, 0.15)',
                borderBadge: 'rgba(16, 185, 129, 0.35)',
                title: `Patrullaje / Matriz - ${gangName}`,
                gangName,
                gangs: gangsList,
                peopleCount: mat.people_count,
                dateStr,
                dateObj: new Date(dateStr),
                photo: mat.photo,
                images: mat.photo ? [mat.photo] : [],
                notes: mat.notes || 'Sin observaciones registradas',
                rawDescription: mat.notes,
                navigatePath: `/gangs`,
                raw: mat
            });
        });

        // 3. Map Outings (Vigilancias)
        outings.forEach(out => {
            const dateStr = out.occurred_at || out.created_at;
            const gangsList = (out.outing_gangs || [])
                .map(og => og.gangs)
                .filter(Boolean);

            items.push({
                id: out.id,
                type: 'outing',
                typeLabel: t('tabOutings') || 'Vigilancia',
                typeIcon: '🕵️‍♂️',
                themeColor: '#a855f7',
                bgBadge: 'rgba(168, 85, 247, 0.15)',
                borderBadge: 'rgba(168, 85, 247, 0.35)',
                title: out.title || out.reason || 'Vigilancia / Outing',
                reason: out.reason,
                dateStr,
                dateObj: new Date(dateStr),
                gangs: gangsList,
                images: filterBucketImages(out.images || []),
                notes: stripHtmlTags(out.info_obtained || out.reason),
                rawDescription: out.info_obtained,
                navigatePath: `/incidents?outing_id=${out.id}`,
                raw: out
            });
        });

        // 4. Map Documentation Posts
        docs.forEach(doc => {
            const dateStr = doc.created_at;
            items.push({
                id: doc.id,
                type: 'document',
                typeLabel: t('tabDocs') || 'Documentación',
                typeIcon: '📚',
                themeColor: '#f59e0b',
                bgBadge: 'rgba(245, 158, 11, 0.15)',
                borderBadge: 'rgba(245, 158, 11, 0.35)',
                title: doc.title || 'Documento sin título',
                category: doc.category,
                dateStr,
                dateObj: new Date(dateStr),
                gangs: [],
                images: [],
                notes: stripHtmlTags(doc.description),
                rawDescription: doc.description,
                navigatePath: `/documentation`,
                url: doc.url,
                raw: doc
            });
        });

        // Sort chronologically
        items.sort((a, b) => {
            const timeA = isNaN(a.dateObj.getTime()) ? 0 : a.dateObj.getTime();
            const timeB = isNaN(b.dateObj.getTime()) ? 0 : b.dateObj.getTime();
            return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });

        return items;
    }, [incidents, matrices, outings, docs, sortOrder, t]);

    // Unique gangs present across this user's contributions
    const availableGangs = useMemo(() => {
        const gangMap = new Map();
        unifiedActivities.forEach(item => {
            if (item.gangs && item.gangs.length > 0) {
                item.gangs.forEach(g => {
                    if (g && g.id && !gangMap.has(g.id)) {
                        gangMap.set(g.id, g);
                    }
                });
            }
        });
        return Array.from(gangMap.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [unifiedActivities]);

    // Filtered items based on Category Tab, Search Query, and Gang Filter
    const filteredActivities = useMemo(() => {
        return unifiedActivities.filter(item => {
            // Category Filter
            if (selectedTab !== 'all') {
                if (selectedTab === 'incidents' && item.type !== 'incident') return false;
                if (selectedTab === 'matrices' && item.type !== 'matrix') return false;
                if (selectedTab === 'outings' && item.type !== 'outing') return false;
                if (selectedTab === 'documents' && item.type !== 'document') return false;
            }

            // Gang Filter
            if (selectedGangFilter) {
                const hasGang = (item.gangs || []).some(g => g.id === selectedGangFilter);
                if (!hasGang) return false;
            }

            // Text Search Query
            if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase().trim();
                const matchTitle = item.title && item.title.toLowerCase().includes(q);
                const matchTablet = item.tabletNumber && item.tabletNumber.toLowerCase().includes(q);
                const matchLocation = item.location && item.location.toLowerCase().includes(q);
                const matchNotes = item.notes && item.notes.toLowerCase().includes(q);
                const matchGang = (item.gangs || []).some(g => g.name && g.name.toLowerCase().includes(q));

                if (!matchTitle && !matchTablet && !matchLocation && !matchNotes && !matchGang) {
                    return false;
                }
            }

            return true;
        });
    }, [unifiedActivities, selectedTab, selectedGangFilter, searchQuery]);

    const visibleItems = useMemo(() => {
        return filteredActivities.slice(0, displayLimit);
    }, [filteredActivities, displayLimit]);

    return (
        <div id="activity-history" ref={ref} className="detail-section agent-activity-history-container" style={{ marginTop: '2rem' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                borderBottom: '1px solid var(--glass-border)',
                paddingBottom: '1rem',
                marginBottom: '1.25rem'
            }}>
                <div>
                    <h3 style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        margin: 0,
                        fontSize: '1.2rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)'
                    }}>
                        <span>📋</span>
                        <span>{t('activityHistoryTitle') || 'Historial de Aportes y Actividad'}</span>
                        <span style={{
                            fontSize: '0.8rem',
                            padding: '3px 9px',
                            borderRadius: '12px',
                            background: 'rgba(var(--color-blue-rgb), 0.15)',
                            color: '#60a5fa',
                            border: '1px solid rgba(var(--color-blue-rgb), 0.3)',
                            fontWeight: 600
                        }}>
                            {filteredActivities.length} {t('totalRecords') || 'aportes'}
                        </span>
                    </h3>
                    <p style={{
                        margin: '4px 0 0 0',
                        fontSize: '0.82rem',
                        color: 'var(--text-secondary)'
                    }}>
                        {t('activityHistorySubtitle') || 'Informes, matrices y vigilancias registradas en orden cronológico'}
                    </p>
                </div>

                {/* Sort Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
                        className="mac-btn-secondary"
                        style={{
                            padding: '6px 12px',
                            fontSize: '0.82rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)',
                            cursor: 'pointer',
                            color: 'var(--text-primary)'
                        }}
                        title={sortOrder === 'desc' ? 'Cambiar a más antiguos primero' : 'Cambiar a más recientes primero'}
                    >
                        <span>{sortOrder === 'desc' ? '⬇️' : '⬆️'}</span>
                        <span>{sortOrder === 'desc' ? (t('sortByNewest') || 'Más recientes primero') : (t('sortByOldest') || 'Más antiguos primero')}</span>
                    </button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '1.25rem'
            }}>
                <button
                    type="button"
                    onClick={() => handleTabSwitch('all')}
                    style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: selectedTab === 'all' ? '1px solid #3b82f6' : '1px solid var(--glass-border)',
                        background: selectedTab === 'all' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        color: selectedTab === 'all' ? '#93c5fd' : 'var(--text-secondary)',
                        fontWeight: selectedTab === 'all' ? 700 : 500,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span>🌟</span>
                    <span>{t('tabAll') || 'Todos'}</span>
                    <span style={{
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        background: selectedTab === 'all' ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                        color: selectedTab === 'all' ? '#ffffff' : 'var(--text-secondary)'
                    }}>
                        {unifiedActivities.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => handleTabSwitch('incidents')}
                    style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: selectedTab === 'incidents' ? '1px solid #3b82f6' : '1px solid var(--glass-border)',
                        background: selectedTab === 'incidents' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        color: selectedTab === 'incidents' ? '#93c5fd' : 'var(--text-secondary)',
                        fontWeight: selectedTab === 'incidents' ? 700 : 500,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span>📄</span>
                    <span>{t('tabIncidents') || 'Informes'}</span>
                    <span style={{
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        background: selectedTab === 'incidents' ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
                        color: selectedTab === 'incidents' ? '#ffffff' : 'var(--text-secondary)'
                    }}>
                        {incidents.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => handleTabSwitch('matrices')}
                    style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: selectedTab === 'matrices' ? '1px solid #10b981' : '1px solid var(--glass-border)',
                        background: selectedTab === 'matrices' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        color: selectedTab === 'matrices' ? '#6ee7b7' : 'var(--text-secondary)',
                        fontWeight: selectedTab === 'matrices' ? 700 : 500,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span>📈</span>
                    <span>{t('tabMatrices') || 'Matrices GU'}</span>
                    <span style={{
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        background: selectedTab === 'matrices' ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                        color: selectedTab === 'matrices' ? '#ffffff' : 'var(--text-secondary)'
                    }}>
                        {matrices.length}
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => handleTabSwitch('outings')}
                    style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: selectedTab === 'outings' ? '1px solid #a855f7' : '1px solid var(--glass-border)',
                        background: selectedTab === 'outings' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                        color: selectedTab === 'outings' ? '#d8b4fe' : 'var(--text-secondary)',
                        fontWeight: selectedTab === 'outings' ? 700 : 500,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span>🕵️‍♂️</span>
                    <span>{t('tabOutings') || 'Vigilancias'}</span>
                    <span style={{
                        padding: '1px 6px',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        background: selectedTab === 'outings' ? '#a855f7' : 'rgba(255, 255, 255, 0.1)',
                        color: selectedTab === 'outings' ? '#ffffff' : 'var(--text-secondary)'
                    }}>
                        {outings.length}
                    </span>
                </button>

                {docs.length > 0 && (
                    <button
                        type="button"
                        onClick={() => handleTabSwitch('documents')}
                        style={{
                            padding: '7px 14px',
                            borderRadius: '8px',
                            border: selectedTab === 'documents' ? '1px solid #f59e0b' : '1px solid var(--glass-border)',
                            background: selectedTab === 'documents' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                            color: selectedTab === 'documents' ? '#fcd34d' : 'var(--text-secondary)',
                            fontWeight: selectedTab === 'documents' ? 700 : 500,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <span>📚</span>
                        <span>{t('tabDocs') || 'Documentación'}</span>
                        <span style={{
                            padding: '1px 6px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            background: selectedTab === 'documents' ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)',
                            color: selectedTab === 'documents' ? '#ffffff' : 'var(--text-secondary)'
                        }}>
                            {docs.length}
                        </span>
                    </button>
                )}
            </div>

            {/* Filter Controls Bar (Search + Gang Filter) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: availableGangs.length > 0 ? '1fr auto' : '1fr',
                gap: '12px',
                marginBottom: '1.25rem'
            }}>
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={t('searchActivityPlaceholder') || 'Buscar por título, banda, ubicación o notas...'}
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '10px 14px 10px 38px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            fontSize: '0.88rem'
                        }}
                    />
                    <span style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '0.9rem',
                        opacity: 0.6
                    }}>
                        🔍
                    </span>
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>

                {availableGangs.length > 0 && (
                    <select
                        value={selectedGangFilter}
                        onChange={(e) => setSelectedGangFilter(e.target.value)}
                        style={{
                            padding: '9px 14px',
                            background: 'rgba(20, 24, 30, 0.95)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                            fontSize: '0.88rem',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="">{t('allGangsFilter') || 'Todas las bandas'}</option>
                        {availableGangs.map(g => (
                            <option key={g.id} value={g.id}>
                                {g.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* Content List */}
            {loading ? (
                <div style={{
                    padding: '2.5rem',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '8px',
                    border: '1px dashed var(--glass-border)'
                }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⏳</div>
                    Cargando expediente cronológico de aportes...
                </div>
            ) : error ? (
                <div style={{
                    padding: '1.5rem',
                    color: '#f87171',
                    background: 'rgba(248, 113, 113, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(248, 113, 113, 0.3)'
                }}>
                    Error al cargar historial: {error}
                </div>
            ) : filteredActivities.length === 0 ? (
                <div style={{
                    padding: '3rem 1.5rem',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '10px',
                    border: '1px dashed var(--glass-border)'
                }}>
                    <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>📂</div>
                    <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {searchQuery || selectedGangFilter ? (t('noActivityFound') || 'No se encontraron registros') : (t('noActivityYet') || 'Sin registros en esta categoría')}
                    </div>
                    <div style={{ fontSize: '0.85rem' }}>
                        {searchQuery || selectedGangFilter
                            ? 'Prueba a cambiar los términos de búsqueda o limpiar el filtro de banda.'
                            : 'El agente aún no ha subido informes o matrices en esta categoría.'}
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '0.9rem' }}>
                    {visibleItems.map(item => {
                        const { formatted: dateFormatted, relative: dateRelative } = formatChronologicalDate(item.dateStr);

                        return (
                            <div
                                key={`${item.type}-${item.id}`}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.035)',
                                    border: '1px solid var(--glass-border)',
                                    borderLeft: `4px solid ${item.themeColor}`,
                                    borderRadius: '8px',
                                    padding: '1rem 1.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.6rem',
                                    transition: 'all 0.2s ease',
                                    position: 'relative'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = `0 4px 14px rgba(0,0,0,0.25)`;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.035)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                {/* Top Meta Row: Badge, Date, Relative time */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    flexWrap: 'wrap',
                                    gap: '8px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            padding: '3px 9px',
                                            borderRadius: '6px',
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            background: item.bgBadge,
                                            color: item.themeColor,
                                            border: `1px solid ${item.borderBadge}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}>
                                            <span>{item.typeIcon}</span>
                                            <span>{item.typeLabel}</span>
                                        </span>

                                        {item.tabletNumber && (
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.76rem',
                                                fontWeight: 600,
                                                background: 'rgba(255, 255, 255, 0.08)',
                                                color: '#e2e8f0',
                                                border: '1px solid rgba(255, 255, 255, 0.12)'
                                            }}>
                                                Tablet: #{item.tabletNumber}
                                            </span>
                                        )}

                                        {item.peopleCount !== undefined && (
                                            <span style={{
                                                padding: '2px 8px',
                                                borderRadius: '6px',
                                                fontSize: '0.76rem',
                                                fontWeight: 600,
                                                background: 'rgba(16, 185, 129, 0.15)',
                                                color: '#34d399',
                                                border: '1px solid rgba(16, 185, 129, 0.3)'
                                            }}>
                                                👥 {item.peopleCount} miembros
                                            </span>
                                        )}

                                        {/* Gang Badges */}
                                        {item.gangs && item.gangs.map(g => (
                                            <span
                                                key={g.id}
                                                style={{
                                                    padding: '2px 8px',
                                                    borderRadius: '6px',
                                                    fontSize: '0.76rem',
                                                    fontWeight: 600,
                                                    background: g.color ? `${g.color}25` : 'rgba(255, 255, 255, 0.1)',
                                                    color: g.color || '#e2e8f0',
                                                    border: `1px solid ${g.color ? `${g.color}50` : 'rgba(255, 255, 255, 0.2)'}`
                                                }}
                                            >
                                                🏷️ {g.name}
                                            </span>
                                        ))}
                                    </div>

                                    {/* Date & Time */}
                                    <div style={{
                                        fontSize: '0.8rem',
                                        color: 'var(--text-secondary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <span>📅 {dateFormatted}</span>
                                        {dateRelative && (
                                            <span style={{
                                                fontSize: '0.75rem',
                                                opacity: 0.8,
                                                fontStyle: 'italic'
                                            }}>
                                                ({dateRelative})
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Title & Location */}
                                <div>
                                    <div style={{
                                        fontWeight: 700,
                                        fontSize: '1rem',
                                        color: 'var(--text-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        {item.title}
                                    </div>
                                    {item.location && (
                                        <div style={{
                                            fontSize: '0.82rem',
                                            color: '#94a3b8',
                                            marginTop: '2px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}>
                                            <span>📍</span>
                                            <span>{item.location}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Content Preview / Notes */}
                                {item.notes && (
                                    <div style={{
                                        fontSize: '0.85rem',
                                        color: '#cbd5e1',
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid rgba(255, 255, 255, 0.04)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        lineHeight: 1.45
                                    }}>
                                        {item.notes}
                                    </div>
                                )}

                                {/* Media Preview / Photos & Actions */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '8px',
                                    marginTop: '0.2rem'
                                }}>
                                    {/* Photos Thumbnail / Counter */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {item.photo && (
                                            <div
                                                onClick={() => setExpandedImage(item.photo)}
                                                style={{
                                                    width: '42px',
                                                    height: '42px',
                                                    borderRadius: '6px',
                                                    overflow: 'hidden',
                                                    cursor: 'pointer',
                                                    border: '1px solid var(--glass-border)',
                                                    position: 'relative'
                                                }}
                                                title="Clic para ampliar foto de patrullaje"
                                            >
                                                <img
                                                    src={item.photo}
                                                    alt="Foto patrullaje"
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            </div>
                                        )}

                                        {item.images && item.images.length > 0 && !item.photo && (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                fontSize: '0.78rem',
                                                color: '#94a3b8'
                                            }}>
                                                <span>📷</span>
                                                <span>{item.images.length} {item.images.length === 1 ? 'imagen' : 'imágenes'} adjuntas</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewItem(item)}
                                            style={{
                                                padding: '5px 11px',
                                                borderRadius: '6px',
                                                background: 'rgba(255, 255, 255, 0.07)',
                                                border: '1px solid var(--glass-border)',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                transition: 'all 0.15s ease'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)'}
                                        >
                                            <span>👁️</span>
                                            <span>{t('viewDetail') || 'Vista Rápida'}</span>
                                        </button>

                                        {item.navigatePath && (
                                            <button
                                                type="button"
                                                onClick={() => navigate(item.navigatePath)}
                                                style={{
                                                    padding: '5px 11px',
                                                    borderRadius: '6px',
                                                    background: `${item.themeColor}22`,
                                                    border: `1px solid ${item.themeColor}55`,
                                                    color: item.themeColor,
                                                    fontSize: '0.8rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = `${item.themeColor}38`}
                                                onMouseLeave={(e) => e.currentTarget.style.background = `${item.themeColor}22`}
                                            >
                                                <span>↗️</span>
                                                <span>{t('goToModule') || 'Ir al apartado'}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Pagination / Load More Button */}
                    {filteredActivities.length > displayLimit && (
                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => setDisplayLimit(prev => prev + 15)}
                                style={{
                                    padding: '9px 24px',
                                    borderRadius: '8px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.88rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                            >
                                <span>{t('loadMoreActivity') || 'Cargar más registros'}</span> ({displayLimit} / {filteredActivities.length})
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Quick Preview Modal */}
            {previewItem && (
                <div
                    className="modal-backdrop"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        padding: '1rem'
                    }}
                    onClick={() => setPreviewItem(null)}
                >
                    <div
                        style={{
                            background: '#131822',
                            border: `1px solid ${previewItem.borderBadge || 'var(--glass-border)'}`,
                            borderRadius: '12px',
                            maxWidth: '700px',
                            width: '100%',
                            maxHeight: '88vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{
                            padding: '1.25rem',
                            borderBottom: '1px solid var(--glass-border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '12px',
                            background: 'rgba(255, 255, 255, 0.02)'
                        }}>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                    <span style={{
                                        padding: '3px 9px',
                                        borderRadius: '6px',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        background: previewItem.bgBadge,
                                        color: previewItem.themeColor,
                                        border: `1px solid ${previewItem.borderBadge}`
                                    }}>
                                        {previewItem.typeIcon} {previewItem.typeLabel}
                                    </span>
                                    {previewItem.tabletNumber && (
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.76rem',
                                            background: 'rgba(255, 255, 255, 0.08)',
                                            color: '#e2e8f0'
                                        }}>
                                            #{previewItem.tabletNumber}
                                        </span>
                                    )}
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                                    {previewItem.title}
                                </h3>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    📅 {formatChronologicalDate(previewItem.dateStr).formatted}
                                    {previewItem.location && ` • 📍 ${previewItem.location}`}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setPreviewItem(null)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1rem'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{
                            padding: '1.25rem',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1.25rem'
                        }}>
                            {/* Gangs & People info */}
                            {(previewItem.gangs?.length > 0 || previewItem.peopleCount !== undefined) && (
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {previewItem.peopleCount !== undefined && (
                                        <div style={{
                                            padding: '6px 12px',
                                            borderRadius: '8px',
                                            background: 'rgba(16, 185, 129, 0.15)',
                                            color: '#34d399',
                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                            fontSize: '0.85rem',
                                            fontWeight: 600
                                        }}>
                                            👥 Personas avistadas: {previewItem.peopleCount}
                                        </div>
                                    )}
                                    {previewItem.gangs?.map(g => (
                                        <div
                                            key={g.id}
                                            style={{
                                                padding: '6px 12px',
                                                borderRadius: '8px',
                                                background: g.color ? `${g.color}25` : 'rgba(255, 255, 255, 0.1)',
                                                color: g.color || '#e2e8f0',
                                                border: `1px solid ${g.color ? `${g.color}50` : 'rgba(255, 255, 255, 0.2)'}`,
                                                fontSize: '0.85rem',
                                                fontWeight: 600
                                            }}
                                        >
                                            🏷️ Banda: {g.name}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Patrol Photo Single */}
                            {previewItem.photo && (
                                <div>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Fotografía de Patrullaje:
                                    </h4>
                                    <div
                                        onClick={() => setExpandedImage(previewItem.photo)}
                                        style={{
                                            maxHeight: '320px',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            border: '1px solid var(--glass-border)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <img
                                            src={previewItem.photo}
                                            alt="Fotografía de patrullaje"
                                            style={{ width: '100%', maxHeight: '320px', objectFit: 'contain', background: '#0a0d14' }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Notes / Description */}
                            {previewItem.rawDescription && (
                                <div>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Descripción / Observaciones:
                                    </h4>
                                    <div
                                        style={{
                                            background: 'rgba(0, 0, 0, 0.25)',
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            border: '1px solid var(--glass-border)',
                                            fontSize: '0.9rem',
                                            color: '#e2e8f0',
                                            lineHeight: 1.6,
                                            maxHeight: '260px',
                                            overflowY: 'auto'
                                        }}
                                        dangerouslySetInnerHTML={{ __html: previewItem.rawDescription }}
                                    />
                                </div>
                            )}

                            {/* Images Gallery */}
                            {previewItem.images && previewItem.images.length > 0 && !previewItem.photo && (
                                <div>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                        Evidencias Gráficas ({previewItem.images.length}):
                                    </h4>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                                        gap: '10px'
                                    }}>
                                        {previewItem.images.map((img, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => setExpandedImage(img)}
                                                style={{
                                                    height: '100px',
                                                    borderRadius: '6px',
                                                    overflow: 'hidden',
                                                    border: '1px solid var(--glass-border)',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <img
                                                    src={img}
                                                    alt={`Adjunto ${idx + 1}`}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div style={{
                            padding: '1rem 1.25rem',
                            borderTop: '1px solid var(--glass-border)',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '10px',
                            background: 'rgba(255, 255, 255, 0.02)'
                        }}>
                            <button
                                type="button"
                                onClick={() => setPreviewItem(null)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid var(--glass-border)',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                Cerrar
                            </button>

                            {previewItem.navigatePath && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPreviewItem(null);
                                        navigate(previewItem.navigatePath);
                                    }}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        background: previewItem.themeColor,
                                        border: 'none',
                                        color: '#ffffff',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        fontSize: '0.85rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    <span>Ir a la sección oficial</span>
                                    <span>↗️</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Photo Lightbox Modal */}
            {expandedImage && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.92)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000,
                        padding: '1.5rem',
                        cursor: 'zoom-out'
                    }}
                    onClick={() => setExpandedImage(null)}
                >
                    <img
                        src={expandedImage}
                        alt="Vista ampliada"
                        style={{
                            maxWidth: '92vw',
                            maxHeight: '92vh',
                            objectFit: 'contain',
                            borderRadius: '8px',
                            boxShadow: '0 0 40px rgba(0, 0, 0, 0.8)'
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => setExpandedImage(null)}
                        style={{
                            position: 'absolute',
                            top: '20px',
                            right: '25px',
                            background: 'rgba(255, 255, 255, 0.15)',
                            border: 'none',
                            borderRadius: '50%',
                            width: '40px',
                            height: '40px',
                            color: '#ffffff',
                            fontSize: '1.2rem',
                            cursor: 'pointer'
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}
        </div>
    );
});

export default AgentActivityHistory;
