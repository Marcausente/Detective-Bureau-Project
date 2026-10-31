import { useMemo } from 'react';

export default function PlantillaAnalytics({ agents = [], ranks = [], divisions = [], iaStatusMap, onClose }) {
    // Analytics calculations
    const stats = useMemo(() => {
        const isRealAgent = (a) => {
            if (!a || a.is_divider || a.is_placeholder) return false;
            return Boolean((a.nombre || '').trim() || (a.apellido || '').trim() || (a.username || '').trim());
        };

        const assignedAgents = agents.filter(isRealAgent);
        const placeholders = agents.filter(a => !a.is_divider && (a.is_placeholder || (!a.nombre?.trim() && !a.apellido?.trim())));

        const totalAssigned = assignedAgents.length;
        const totalPlaceholders = placeholders.length;

        let activos = 0;
        let pocoActivos = 0;
        let inactivos = 0;
        let conFaltasActivas = 0;

        assignedAgents.forEach(a => {
            const status = (a.activity_status || 'Activo').toLowerCase();
            if (status.includes('inactiv') || status.includes('no activ')) {
                inactivos++;
            } else if (status.includes('poco') || status.includes('vacacion')) {
                pocoActivos++;
            } else {
                activos++;
            }

            if (iaStatusMap?.getAgentStatus) {
                const ia = iaStatusMap.getAgentStatus(a);
                if (ia?.hasActive) conFaltasActivas++;
            }
        });

        // Count per rank (in hierarchical order)
        const rankCounts = ranks.map(rank => {
            const count = assignedAgents.filter(a =>
                (a.rank_name || '').trim().toLowerCase() === rank.name.trim().toLowerCase() ||
                (a.rank_id && a.rank_id === rank.id)
            ).length;
            const reservedCount = placeholders.filter(a =>
                (a.rank_name || '').trim().toLowerCase() === rank.name.trim().toLowerCase()
            ).length;

            const percentage = totalAssigned > 0 ? ((count / totalAssigned) * 100).toFixed(1) : '0';

            return {
                ...rank,
                count,
                reservedCount,
                percentage
            };
        });

        // Find max count for graph scaling
        const maxRankCount = Math.max(...rankCounts.map(r => r.count), 1);

        // Count per division
        const divisionCounts = divisions.map(div => {
            const count = assignedAgents.filter(a => {
                const divs = Array.isArray(a.divisions) ? a.divisions : [];
                return divs.includes(div.short_name) || divs.includes(div.name);
            }).length;

            return {
                ...div,
                count,
                percentage: totalAssigned > 0 ? ((count / totalAssigned) * 100).toFixed(1) : '0'
            };
        });

        return {
            totalAssigned,
            totalPlaceholders,
            totalAll: realAgents.length,
            activos,
            pocoActivos,
            inactivos,
            conFaltasActivas,
            rankCounts,
            maxRankCount,
            divisionCounts
        };
    }, [agents, ranks, divisions, iaStatusMap]);

    return (
        <div className="mac-modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
            <div
                className="mac-modal-card"
                onClick={e => e.stopPropagation()}
                style={{
                    maxWidth: '960px',
                    width: '95%',
                    maxHeight: '92vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '20px',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: 'rgba(59, 130, 246, 0.2)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.3rem'
                        }}>
                            📊
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: '#f8fafc' }}>
                                Analíticas y Censo del Departamento
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                                Métricas de personal, distribución jerárquica de rangos y efectivos en servicio
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#cbd5e1',
                            padding: '0.45rem 0.85rem',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Top KPI Summary Cards */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: '0.85rem'
                    }}>
                        {/* Total Department */}
                        <div style={{
                            background: 'rgba(30, 41, 59, 0.6)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '14px',
                            padding: '1rem 1.15rem'
                        }}>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>
                                👥 Total Efectivos
                            </div>
                            <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#f8fafc', marginTop: '0.2rem' }}>
                                {stats.totalAssigned}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>
                                +{stats.totalPlaceholders} plazas reservadas
                            </div>
                        </div>

                        {/* Activos */}
                        <div style={{
                            background: 'rgba(16, 185, 129, 0.1)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '14px',
                            padding: '1rem 1.15rem'
                        }}>
                            <div style={{ fontSize: '0.72rem', color: '#86efac', fontWeight: 800, textTransform: 'uppercase' }}>
                                🟢 Activos
                            </div>
                            <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#34d399', marginTop: '0.2rem' }}>
                                {stats.activos}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                                {stats.totalAssigned > 0 ? ((stats.activos / stats.totalAssigned) * 100).toFixed(0) : 0}% de la plantilla
                            </div>
                        </div>

                        {/* Poco Activa / Vacaciones */}
                        <div style={{
                            background: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            borderRadius: '14px',
                            padding: '1rem 1.15rem'
                        }}>
                            <div style={{ fontSize: '0.72rem', color: '#fde047', fontWeight: 800, textTransform: 'uppercase' }}>
                                🟡 Poco / Vacaciones
                            </div>
                            <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#fbbf24', marginTop: '0.2rem' }}>
                                {stats.pocoActivos}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                                En permiso o actividad baja
                            </div>
                        </div>

                        {/* Inactivos */}
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '14px',
                            padding: '1rem 1.15rem'
                        }}>
                            <div style={{ fontSize: '0.72rem', color: '#fca5a5', fontWeight: 800, textTransform: 'uppercase' }}>
                                🔴 Inactivos
                            </div>
                            <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#f87171', marginTop: '0.2rem' }}>
                                {stats.inactivos}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                                Sin servicio reciente
                            </div>
                        </div>

                        {/* Faltas IA Activas */}
                        <div style={{
                            background: 'rgba(220, 38, 38, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.45)',
                            borderRadius: '14px',
                            padding: '1rem 1.15rem'
                        }}>
                            <div style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase' }}>
                                ⚖️ Faltas IA Activas
                            </div>
                            <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#ef4444', marginTop: '0.2rem' }}>
                                {stats.conFaltasActivas}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#cbd5e1', marginTop: '0.15rem' }}>
                                Con expediente disciplinario
                            </div>
                        </div>
                    </div>

                    {/* Visual Bar Chart of Ranks */}
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        padding: '1.25rem 1.5rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#f8fafc' }}>
                                    📈 Gráfica de Distribución por Rangos (Orden Jerárquico)
                                </h3>
                                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                                    Representación visual del volumen de personal en cada escalafón departamental
                                </p>
                            </div>
                            <span style={{
                                fontSize: '0.72rem',
                                color: '#6ee7b7',
                                background: 'rgba(16, 185, 129, 0.15)',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontWeight: 800
                            }}>
                                De Mayor a Menor Rango
                            </span>
                        </div>

                        {/* Horizontal Bar Chart */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {stats.rankCounts.map((r, i) => {
                                const barPercent = stats.maxRankCount > 0 ? (r.count / stats.maxRankCount) * 100 : 0;
                                const isHighRank = i < 3;
                                return (
                                    <div key={r.id || r.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {/* Rank label */}
                                        <div style={{ width: '190px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                            <div style={{
                                                width: '22px',
                                                height: '22px',
                                                borderRadius: '4px',
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                border: `1px solid ${r.color || '#3b82f6'}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden'
                                            }}>
                                                {r.badge_image_url ? (
                                                    <img src={r.badge_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                ) : (
                                                    <span style={{ fontSize: '0.7rem' }}>🎖️</span>
                                                )}
                                            </div>
                                            <span style={{
                                                fontSize: '0.8rem',
                                                fontWeight: 800,
                                                color: isHighRank ? '#fbbf24' : '#f8fafc',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }} title={r.name}>
                                                {r.name}
                                            </span>
                                        </div>

                                        {/* Bar */}
                                        <div style={{
                                            flex: 1,
                                            height: '24px',
                                            background: 'rgba(15, 23, 42, 0.7)',
                                            borderRadius: '6px',
                                            overflow: 'hidden',
                                            position: 'relative',
                                            border: '1px solid rgba(255, 255, 255, 0.06)'
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${Math.max(barPercent, r.count > 0 ? 3 : 0)}%`,
                                                background: r.count > 0 ? `linear-gradient(90deg, ${r.color || '#3b82f6'}, #60a5fa)` : 'transparent',
                                                borderRadius: '6px',
                                                transition: 'width 0.5s ease',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'flex-end',
                                                paddingRight: '8px'
                                            }}>
                                            </div>
                                        </div>

                                        {/* Count & % Badge */}
                                        <div style={{ width: '85px', textAlign: 'right', flexShrink: 0 }}>
                                            <span style={{
                                                fontSize: '0.82rem',
                                                fontWeight: 900,
                                                color: r.count > 0 ? '#f8fafc' : '#64748b'
                                            }}>
                                                {r.count} {r.count === 1 ? 'agente' : 'agentes'}
                                            </span>
                                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block' }}>
                                                ({r.percentage}%)
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Breakdown by Divisions */}
                    <div style={{
                        background: 'rgba(30, 41, 59, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '16px',
                        padding: '1.25rem 1.5rem'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 900, color: '#f8fafc' }}>
                            🏢 Efectivos Asignados por División
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                            {stats.divisionCounts.map(div => (
                                <div
                                    key={div.id || div.name}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.6)',
                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                        borderRadius: '12px',
                                        padding: '0.85rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '8px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: `1px solid ${div.color || '#10b981'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        flexShrink: 0
                                    }}>
                                        {div.badge_image_url ? (
                                            <img src={div.badge_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <span style={{ fontSize: '1.1rem' }}>🏢</span>
                                        )}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {div.name}
                                        </div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 900, color: div.color || '#34d399', marginTop: '1px' }}>
                                            {div.count} <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>({div.percentage}%)</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

