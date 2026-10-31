import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import {
    calculatePromotionDays,
    sortAgentsByRankHierarchy,
    sortAgentsByBadge,
    insertAgentByClosestBadge,
    updateAgentsOrder,
    savePlantillaAgent,
    deletePlantillaAgent,
    savePlantillaDivider,
    deletePlantillaDivider,
    DEFAULT_VALORACIONES,
    hexToRgba
} from '../../services/plantillaService';
import PlantillaAgentModal from './PlantillaAgentModal';
import PlantillaDividerModal from './PlantillaDividerModal';
import PlantillaRanksManager from './PlantillaRanksManager';
import PlantillaDivisionsManager from './PlantillaDivisionsManager';
import PlantillaValoracionesManager from './PlantillaValoracionesManager';
import PlantillaAnalytics from './PlantillaAnalytics';

export default function PlantillaRosterTable({
    agents = [],
    ranks = [],
    divisions = [],
    valoraciones = [],
    iaStatusMap,
    currentUser,
    onAgentsUpdated,
    onRanksUpdated,
    onDivisionsUpdated,
    onValoracionesUpdated,
    onRefreshIA
}) {
    const { isLSSD, branding } = useTheme();
    const navigate = useNavigate();

    // Modals state
    const [showAgentModal, setShowAgentModal] = useState(false);
    const [selectedAgentForEdit, setSelectedAgentForEdit] = useState(null);

    const [showDividerModal, setShowDividerModal] = useState(false);
    const [selectedDividerForEdit, setSelectedDividerForEdit] = useState(null);
    const [dividerInsertIndex, setDividerInsertIndex] = useState(null);

    const [showRanksManager, setShowRanksManager] = useState(false);
    const [showDivisionsManager, setShowDivisionsManager] = useState(false);
    const [showValoracionesManager, setShowValoracionesManager] = useState(false);
    const [showAnalytics, setShowAnalytics] = useState(false);

    // Copied email feedback state (agent id)
    const [copiedEmailAgentId, setCopiedEmailAgentId] = useState(null);

    // Active valoraciones fallback
    const activeValoraciones = valoraciones && valoraciones.length > 0 ? valoraciones : DEFAULT_VALORACIONES;

    // Filter & Search state
    const [searchTerm, setSearchTerm] = useState('');
    const [rankFilter, setRankFilter] = useState('all');
    const [divisionFilter, setDivisionFilter] = useState('all');
    const [activityFilter, setActivityFilter] = useState('all');
    const [valoracionFilter, setValoracionFilter] = useState('all');
    const [iaSanctionFilter, setIaSanctionFilter] = useState('all'); // 'all' | 'active_only'

    // Open Add Agent modal
    const handleOpenAddAgent = () => {
        setSelectedAgentForEdit(null);
        setShowAgentModal(true);
    };

    // Open Edit Agent modal
    const handleOpenEditAgent = (agent) => {
        setSelectedAgentForEdit(agent);
        setShowAgentModal(true);
    };

    // Save agent handler (grouped into closest badge section on creation, manual positions preserved on edit)
    const handleSaveAgent = async (agentData) => {
        const isNewAgent = !agentData.id;
        const saved = await savePlantillaAgent(agentData);
        let updatedList;

        if (isNewAgent) {
            // Detección inteligente: se agrupa en el bloque de la placa más cercana (y desde arriba en empates)
            updatedList = insertAgentByClosestBadge(saved, agents);
            if (onAgentsUpdated) onAgentsUpdated(updatedList);
            try {
                const persisted = await updateAgentsOrder(updatedList);
                if (onAgentsUpdated) onAgentsUpdated(persisted);
            } catch (err) {
                console.error('Error auto-ordering agents by closest badge:', err);
            }
        } else {
            // En edición, preservar la posición actual del agente
            updatedList = agents.map(a => a.id === agentData.id ? saved : a);
            updatedList = updatedList.map((item, idx) => ({ ...item, order_index: idx + 1 }));
            if (onAgentsUpdated) onAgentsUpdated(updatedList);
            try {
                const persisted = await updateAgentsOrder(updatedList);
                if (onAgentsUpdated) onAgentsUpdated(persisted);
            } catch (err) {
                console.error('Error persisting agents list:', err);
            }
        }
    };

    // Delete agent handler
    const handleDeleteAgent = async (agent) => {
        const label = agent.nombre || agent.apellido ? `${agent.nombre} ${agent.apellido} (#${agent.no_placa})` : `Fila Placa #${agent.no_placa}`;
        if (!window.confirm(`¿Seguro que deseas eliminar a ${label} de la plantilla?`)) return;

        try {
            await deletePlantillaAgent(agent.id);
            const updated = agents.filter(a => a.id !== agent.id).map((item, idx) => ({ ...item, order_index: idx + 1 }));
            if (onAgentsUpdated) onAgentsUpdated(updated);
            await updateAgentsOrder(updated);
        } catch (err) {
            alert('Error eliminando agente: ' + err.message);
        }
    };

    // Open Add Divider Modal
    const handleOpenAddDivider = (insertIdx = null) => {
        setSelectedDividerForEdit(null);
        setDividerInsertIndex(insertIdx);
        setShowDividerModal(true);
    };

    // Open Edit Divider Modal
    const handleOpenEditDivider = (divider) => {
        setSelectedDividerForEdit(divider);
        setShowDividerModal(true);
    };

    // Save Divider handler
    const handleSaveDivider = async (dividerData, insertPosition) => {
        let updatedList = [...agents];
        if (dividerData.id && selectedDividerForEdit) {
            updatedList = updatedList.map(a => a.id === dividerData.id ? {
                ...a,
                ...dividerData,
                is_divider: true,
                title: (dividerData.title || dividerData.nombre || a.title || a.nombre || 'SECCIÓN').trim().toUpperCase(),
                color: dividerData.color || a.color || '#3b82f6',
                icon: dividerData.icon || a.icon || '📁'
            } : a);
        } else {
            const newDivider = {
                id: `div-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                ...dividerData,
                is_divider: true,
                title: (dividerData.title || dividerData.nombre || 'SECCIÓN').trim().toUpperCase(),
                color: dividerData.color || '#3b82f6',
                icon: dividerData.icon || '📁'
            };
            if (insertPosition === 'start') {
                updatedList = [newDivider, ...updatedList];
            } else if (insertPosition === 'end' || insertPosition === null || insertPosition === undefined) {
                updatedList = [...updatedList, newDivider];
            } else if (typeof insertPosition === 'number') {
                const insertAt = insertPosition + 1;
                updatedList.splice(insertAt, 0, newDivider);
            }
        }

        updatedList = updatedList.map((item, idx) => ({ ...item, order_index: idx + 1 }));
        if (onAgentsUpdated) onAgentsUpdated(updatedList);
        try {
            await updateAgentsOrder(updatedList);
        } catch (err) {
            console.error('Error saving divider:', err);
        }
    };

    // Delete Divider handler
    const handleDeleteDivider = async (divider) => {
        const title = divider.title || divider.nombre || 'esta sección';
        if (!window.confirm(`¿Seguro que deseas eliminar la barra divisoria "${title}"?\n\nLos agentes que contiene no se eliminarán.`)) return;

        const updatedList = agents.filter(a => a.id !== divider.id).map((item, idx) => ({ ...item, order_index: idx + 1 }));
        if (onAgentsUpdated) onAgentsUpdated(updatedList);
        try {
            await deletePlantillaDivider(divider.id);
            await updateAgentsOrder(updatedList);
        } catch (err) {
            console.error('Error deleting divider:', err);
        }
    };

    // Manual Reorder: Move up / down (allows user to alter a concrete agent's position)
    const handleMoveAgent = async (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= agents.length) return;

        const updated = [...agents];
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;

        if (onAgentsUpdated) onAgentsUpdated(updated);
        try {
            const persisted = await updateAgentsOrder(updated);
            if (onAgentsUpdated) onAgentsUpdated(persisted);
        } catch (e) {
            console.error('Error reordering agents:', e);
        }
    };

    // Sort by badge number (# placa) ascending
    const handleSortByBadge = async () => {
        const sorted = sortAgentsByBadge(agents);
        if (onAgentsUpdated) onAgentsUpdated(sorted);
        try {
            const persisted = await updateAgentsOrder(sorted);
            if (onAgentsUpdated) onAgentsUpdated(persisted);
        } catch (e) {
            console.error('Error sorting agents by badge:', e);
        }
    };

    // Optional manual hierarchical sorting (only if user explicitly clicks in rank manager)
    const handleSortByRankHierarchy = async (customRanks) => {
        const effectiveRanks = customRanks || ranks;
        const sorted = sortAgentsByRankHierarchy(agents, effectiveRanks);
        if (onAgentsUpdated) onAgentsUpdated(sorted);
        try {
            const persisted = await updateAgentsOrder(sorted);
            if (onAgentsUpdated) onAgentsUpdated(persisted);
        } catch (e) {
            console.error('Error sorting agents by hierarchy:', e);
        }
    };

    // Rank update handler (preserves manual agent positions)
    const handleRanksUpdated = async (newRanks) => {
        if (onRanksUpdated) onRanksUpdated(newRanks);
    };

    // Quick toggle activity status
    const handleQuickChangeActivity = async (agent, newStatus) => {
        const updatedAgent = { ...agent, activity_status: newStatus };
        try {
            const saved = await savePlantillaAgent(updatedAgent);
            const updatedList = agents.map(a => a.id === agent.id ? saved : a);
            if (onAgentsUpdated) onAgentsUpdated(updatedList);
        } catch (err) {
            alert('Error actualizando actividad: ' + err.message);
        }
    };

    // Quick change valoracion / acotacion status (colors the whole row)
    const handleQuickChangeValoracion = async (agent, newValoracion) => {
        const updatedAgent = { ...agent, valoracion: newValoracion };
        try {
            const saved = await savePlantillaAgent(updatedAgent);
            const updatedList = agents.map(a => a.id === agent.id ? saved : a);
            if (onAgentsUpdated) onAgentsUpdated(updatedList);
        } catch (err) {
            alert('Error actualizando valoración: ' + err.message);
        }
    };

    // Copy agent email to clipboard
    const handleCopyEmail = (agentEmail, agentId) => {
        if (!agentEmail || !agentEmail.trim()) return;
        const cleanEmail = agentEmail.trim();
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(cleanEmail).catch(err => {
                console.warn('Clipboard write failed:', err);
            });
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = cleanEmail;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (e) {
                console.warn('Fallback copy failed:', e);
            }
            document.body.removeChild(textArea);
        }
        setCopiedEmailAgentId(agentId);
        setTimeout(() => {
            setCopiedEmailAgentId(null);
        }, 1800);
    };

    // Quick toggle division for agent
    const handleQuickToggleDivision = async (agent, divCode) => {
        const currentDivs = Array.isArray(agent.divisions) ? agent.divisions : [];
        let newDivs;
        if (currentDivs.includes(divCode)) {
            newDivs = currentDivs.filter(d => d !== divCode);
        } else {
            newDivs = [...currentDivs, divCode];
        }
        const updatedAgent = { ...agent, divisions: newDivs };
        try {
            const saved = await savePlantillaAgent(updatedAgent);
            const updatedList = agents.map(a => a.id === agent.id ? saved : a);
            if (onAgentsUpdated) onAgentsUpdated(updatedList);
        } catch (err) {
            console.error('Error toggling division:', err);
        }
    };

    // Filter agents
    const filteredAgents = useMemo(() => {
        return agents.filter(agent => {
            // Dividers handling
            if (agent.is_divider) {
                if (searchTerm.trim()) {
                    return (agent.title || agent.nombre || '').toLowerCase().includes(searchTerm.toLowerCase());
                }
                // When filtering by a concrete rank, division, activity, or valoracion, hide dividers so only matching agents appear
                if (rankFilter !== 'all' || divisionFilter !== 'all' || activityFilter !== 'all' || valoracionFilter !== 'all' || iaSanctionFilter !== 'all') {
                    return false;
                }
                return true;
            }

            // Text search
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const fullName = `${agent.nombre || ''} ${agent.apellido || ''}`.toLowerCase();
                const user = (agent.username || '').toLowerCase();
                const email = (agent.email || '').toLowerCase();
                const badge = (agent.no_placa || '').toLowerCase();
                const rank = (agent.rank_name || '').toLowerCase();
                const matchesText = fullName.includes(term) || user.includes(term) || email.includes(term) || badge.includes(term) || rank.includes(term);
                if (!matchesText) return false;
            }

            // Rank filter
            if (rankFilter !== 'all') {
                if ((agent.rank_name || '').trim().toLowerCase() !== rankFilter.trim().toLowerCase()) {
                    return false;
                }
            }

            // Division filter
            if (divisionFilter !== 'all') {
                const divs = Array.isArray(agent.divisions) ? agent.divisions : [];
                if (!divs.includes(divisionFilter)) {
                    return false;
                }
            }

            // Activity filter
            if (activityFilter !== 'all') {
                if (agent.is_placeholder || (!agent.nombre && !agent.apellido)) return false;
                const act = (agent.activity_status || 'Activo').toLowerCase();
                if (activityFilter === 'Activo' && !act.includes('activ')) return false;
                if (activityFilter === 'Poco activa' && (!act.includes('poco') && !act.includes('vacacion'))) return false;
                if (activityFilter === 'Inactivo' && !act.includes('inactiv') && !act.includes('no activ')) return false;
            }

            // Valoracion filter
            if (valoracionFilter !== 'all') {
                if (valoracionFilter === 'none') {
                    if (agent.valoracion && agent.valoracion.trim()) return false;
                } else {
                    if ((agent.valoracion || '').trim().toLowerCase() !== valoracionFilter.trim().toLowerCase()) {
                        return false;
                    }
                }
            }

            // IA Sanctions filter
            if (iaSanctionFilter === 'active_only') {
                const ia = iaStatusMap?.getAgentStatus ? iaStatusMap.getAgentStatus(agent) : null;
                if (!ia?.hasActive) return false;
            }

            return true;
        });
    }, [agents, searchTerm, rankFilter, divisionFilter, activityFilter, valoracionFilter, iaSanctionFilter, iaStatusMap]);

    // Helper to identify real agents vs reserved spaces / dividers
    const isRealAgent = (a) => {
        if (!a || a.is_divider || a.is_placeholder) return false;
        const nombre = (a.nombre || '').trim();
        const apellido = (a.apellido || '').trim();
        const username = (a.username || '').trim();
        return Boolean(nombre || apellido || username);
    };

    // Ranks count for mini-summary box
    const ranksMiniSummary = useMemo(() => {
        return ranks.slice(0, 8).map(r => {
            const count = agents.filter(a =>
                isRealAgent(a) &&
                (a.rank_name || '').trim().toLowerCase() === r.name.trim().toLowerCase()
            ).length;
            return { name: r.name, count };
        });
    }, [agents, ranks]);

    // Counts for summary bar
    const summaryKPIs = useMemo(() => {
        const realAgents = agents.filter(isRealAgent);
        let activos = 0;
        let poco = 0;
        let inactivos = 0;
        let conFaltas = 0;

        realAgents.forEach(a => {
            const st = (a.activity_status || 'Activo').toLowerCase();
            if (st.includes('inactiv') || st.includes('no activ')) inactivos++;
            else if (st.includes('poco') || st.includes('vacacion')) poco++;
            else activos++;

            if (iaStatusMap?.getAgentStatus) {
                const ia = iaStatusMap.getAgentStatus(a);
                if (ia?.hasActive) conFaltas++;
            }
        });

        return {
            total: realAgents.length,
            activos,
            poco,
            inactivos,
            conFaltas
        };
    }, [agents, iaStatusMap]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>

            {/* TOP HEADER: Department Logo, Title, Mini-Stats & Legends (Ultra-Compact) */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '0.35rem 0.75rem',
                backdropFilter: 'blur(16px)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.65rem',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                {/* Brand & Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(59, 130, 246, 0.2))',
                        border: '1px solid rgba(234, 179, 8, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                        overflow: 'hidden',
                        flexShrink: 0
                    }}>
                        {branding?.logo ? (
                            <img src={branding.logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                            <span>⭐</span>
                        )}
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                                fontSize: '0.58rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: '#fbbf24',
                                background: 'rgba(234, 179, 8, 0.15)',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                border: '1px solid rgba(234, 179, 8, 0.3)'
                            }}>
                                {isLSSD ? 'LSSD' : 'LSPD'}
                            </span>
                            <span style={{ fontSize: '0.92rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                                Plantilla {isLSSD ? 'LSSD' : 'LSPD'} • Comandancia
                            </span>
                            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                (Roster Jerárquico)
                            </span>
                        </div>
                    </div>
                </div>

                {/* Quick Summary Pill Boxes (Mirroring the Excel top stats) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    {/* Summary box */}
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '0.22rem 0.65rem',
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'center'
                    }}>
                        <div>
                            <div style={{ fontSize: '0.56rem', color: '#86efac', fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>Activos</div>
                            <div style={{ fontSize: '0.90rem', fontWeight: 900, color: '#34d399', lineHeight: 1.1 }}>{summaryKPIs.activos}</div>
                        </div>
                        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />
                        <div>
                            <div style={{ fontSize: '0.56rem', color: '#fde047', fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>Poco/Vac.</div>
                            <div style={{ fontSize: '0.90rem', fontWeight: 900, color: '#fbbf24', lineHeight: 1.1 }}>{summaryKPIs.poco}</div>
                        </div>
                        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />
                        <div>
                            <div style={{ fontSize: '0.56rem', color: '#fca5a5', fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>Inactivos</div>
                            <div style={{ fontSize: '0.90rem', fontWeight: 900, color: '#f87171', lineHeight: 1.1 }}>{summaryKPIs.inactivos}</div>
                        </div>
                        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />
                        <div>
                            <div style={{ fontSize: '0.56rem', color: '#60a5fa', fontWeight: 800, textTransform: 'uppercase', lineHeight: 1 }}>Total</div>
                            <div style={{ fontSize: '0.90rem', fontWeight: 900, color: '#93c5fd', lineHeight: 1.1 }}>{summaryKPIs.total}</div>
                        </div>
                    </div>

                    {/* Legend: Tiempo sin ascenso */}
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        padding: '0.22rem 0.55rem',
                        display: 'flex',
                        gap: '4px',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontSize: '0.56rem', fontWeight: 800, color: '#cbd5e1', textTransform: 'uppercase', marginRight: '2px' }}>
                            Sin Ascenso:
                        </span>
                        <span style={{ fontSize: '0.60rem', padding: '1px 4px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                            &lt; 15d
                        </span>
                        <span style={{ fontSize: '0.60rem', padding: '1px 4px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.25)', color: '#34d399', fontWeight: 800 }}>
                            15-29d
                        </span>
                        <span style={{ fontSize: '0.60rem', padding: '1px 4px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24', fontWeight: 800 }}>
                            30-49d
                        </span>
                        <span style={{ fontSize: '0.60rem', padding: '1px 4px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.25)', color: '#f87171', fontWeight: 800 }}>
                            50d+
                        </span>
                    </div>
                </div>
            </div>

            {/* ACTION TOOLBAR & FILTERS (Ultra-Compact) */}
            <div style={{
                background: 'rgba(30, 41, 59, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '0.3rem 0.65rem',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.45rem',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                {/* Search & Filters */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', flex: 1, minWidth: '220px' }}>
                    {/* Search Input */}
                    <div style={{ position: 'relative', width: '175px' }}>
                        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.72rem', color: '#94a3b8' }}>
                            🔍
                        </span>
                        <input
                            type="text"
                            placeholder="Buscar agente, placa..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                background: 'rgba(15, 23, 42, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                borderRadius: '6px',
                                padding: '0.24rem 0.5rem 0.24rem 1.6rem',
                                color: '#f8fafc',
                                fontSize: '0.74rem'
                            }}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                style={{
                                    position: 'absolute',
                                    right: '6px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: '0.72rem'
                                }}
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Rank Filter */}
                    <select
                        value={rankFilter}
                        onChange={e => setRankFilter(e.target.value)}
                        style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            padding: '0.24rem 0.5rem',
                            color: '#f8fafc',
                            fontSize: '0.73rem'
                        }}
                    >
                        <option value="all">🎖️ Rangos</option>
                        {ranks.map(r => (
                            <option key={r.id || r.name} value={r.name}>{r.name}</option>
                        ))}
                    </select>

                    {/* Division Filter */}
                    <select
                        value={divisionFilter}
                        onChange={e => setDivisionFilter(e.target.value)}
                        style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            padding: '0.24rem 0.5rem',
                            color: '#f8fafc',
                            fontSize: '0.73rem'
                        }}
                    >
                        <option value="all">🏢 Divisiones</option>
                        {divisions.map(d => (
                            <option key={d.id || d.name} value={d.short_name || d.name}>{d.name} ({d.short_name})</option>
                        ))}
                    </select>

                    {/* Activity Filter */}
                    <select
                        value={activityFilter}
                        onChange={e => setActivityFilter(e.target.value)}
                        style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            padding: '0.24rem 0.5rem',
                            color: '#f8fafc',
                            fontSize: '0.73rem'
                        }}
                    >
                        <option value="all">🔘 Estados</option>
                        <option value="Activo">🟢 Solo Activos</option>
                        <option value="Poco activa">🟡 Poco / Vacaciones</option>
                        <option value="Inactivo">🔴 Solo Inactivos</option>
                    </select>

                    {/* Valoración Filter */}
                    <select
                        value={valoracionFilter}
                        onChange={e => setValoracionFilter(e.target.value)}
                        style={{
                            background: 'rgba(15, 23, 42, 0.8)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            padding: '0.24rem 0.5rem',
                            color: '#f8fafc',
                            fontSize: '0.73rem'
                        }}
                    >
                        <option value="all">🏷️ Valoraciones</option>
                        <option value="none">⚪ Sin Valoración</option>
                        {activeValoraciones.map(v => (
                            <option key={v.id || v.name} value={v.name}>
                                ● {v.name}
                            </option>
                        ))}
                    </select>

                    {/* Toggle Faltas IA Activas Filter */}
                    <button
                        type="button"
                        onClick={() => setIaSanctionFilter(prev => prev === 'all' ? 'active_only' : 'all')}
                        style={{
                            background: iaSanctionFilter === 'active_only' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                            border: iaSanctionFilter === 'active_only' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(255, 255, 255, 0.12)',
                            color: iaSanctionFilter === 'active_only' ? '#fca5a5' : '#cbd5e1',
                            borderRadius: '6px',
                            padding: '0.24rem 0.55rem',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <span>⚖️</span>
                        <span>{iaSanctionFilter === 'active_only' ? 'Con Falta IA' : 'Faltas IA'}</span>
                    </button>
                </div>

                {/* Management Action Buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                    {/* Add Agent */}
                    <button
                        type="button"
                        onClick={handleOpenAddAgent}
                        style={{
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#ffffff',
                            border: 'none',
                            padding: '0.32rem 0.7rem',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                        }}
                    >
                        <span>➕</span>
                        <span>Añadir Agente / Fila</span>
                    </button>

                    {/* Add Section Divider */}
                    <button
                        type="button"
                        onClick={() => handleOpenAddDivider()}
                        style={{
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.85), rgba(37, 99, 235, 0.95))',
                            color: '#ffffff',
                            border: '1px solid rgba(147, 197, 253, 0.4)',
                            padding: '0.32rem 0.7rem',
                            borderRadius: '6px',
                            fontWeight: 800,
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                        }}
                        title="Añadir una barra divisoria para separar agentes por apartados (Jefatura, Sargentos, Detectives...)"
                    >
                        <span>📑</span>
                        <span>Añadir Sección / Divisoria</span>
                    </button>

                    {/* Sort by Badge */}
                    <button
                        type="button"
                        onClick={handleSortByBadge}
                        style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            border: '1px solid rgba(56, 189, 248, 0.4)',
                            color: '#7dd3fc',
                            padding: '0.32rem 0.65rem',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                        title="Ordenar agentes por número de placa (ascendente) por defecto"
                    >
                        <span>🔢</span>
                        <span>Ordenar por Placa</span>
                    </button>

                    {/* Manage Ranks */}
                    <button
                        type="button"
                        onClick={() => setShowRanksManager(true)}
                        style={{
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(129, 140, 248, 0.35)',
                            color: '#c7d2fe',
                            padding: '0.32rem 0.65rem',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <span>🎖️</span>
                        <span>Gestionar Rangos</span>
                    </button>

                    {/* Manage Divisions */}
                    <button
                        type="button"
                        onClick={() => setShowDivisionsManager(true)}
                        style={{
                            background: 'rgba(14, 165, 233, 0.15)',
                            border: '1px solid rgba(56, 189, 248, 0.35)',
                            color: '#bae6fd',
                            padding: '0.32rem 0.65rem',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <span>🏢</span>
                        <span>Gestionar Divisiones</span>
                    </button>

                    {/* Manage Valoraciones / Acotaciones */}
                    <button
                        type="button"
                        onClick={() => setShowValoracionesManager(true)}
                        style={{
                            background: 'rgba(234, 179, 8, 0.15)',
                            border: '1px solid rgba(250, 204, 21, 0.35)',
                            color: '#fef08a',
                            padding: '0.32rem 0.65rem',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <span>🏷️</span>
                        <span>Gestionar Acotaciones</span>
                    </button>

                    {/* View Analytics */}
                    <button
                        type="button"
                        onClick={() => setShowAnalytics(true)}
                        style={{
                            background: 'rgba(168, 85, 247, 0.15)',
                            border: '1px solid rgba(192, 132, 252, 0.35)',
                            color: '#e9d5ff',
                            padding: '0.32rem 0.65rem',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        <span>📊</span>
                        <span>Analíticas & Gráfica</span>
                    </button>
                </div>
            </div>

            {/* MAIN ROSTER TABLE */}
            <div style={{
                background: '#0f172a',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '14px',
                overflow: 'hidden',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)'
            }}>
                <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 190px)' }}>
                    <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '0.82rem',
                        textAlign: 'left',
                        whiteSpace: 'nowrap'
                    }}>
                        <thead>
                            <tr style={{
                                background: '#1e293b',
                                borderBottom: '2px solid rgba(255, 255, 255, 0.15)',
                                position: 'sticky',
                                top: 0,
                                zIndex: 10
                            }}>
                                {/* Move Reorder Column */}
                                <th style={{ padding: '3px 1px', textAlign: 'center', width: '20px', minWidth: '18px', maxWidth: '20px', color: '#94a3b8', fontSize: '0.60rem', textTransform: 'uppercase' }}>
                                    Ord
                                </th>

                                {/* Photo */}
                                <th style={{ padding: '3px 1px', width: '22px', minWidth: '20px', maxWidth: '22px', textAlign: 'center', color: '#94a3b8', fontSize: '0.60rem', textTransform: 'uppercase' }}>
                                    Foto
                                </th>

                                {/* User info */}
                                <th style={{ padding: '3px 3px', color: '#cbd5e1', fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', width: '75px', minWidth: '65px' }}>
                                    Usuario
                                </th>
                                <th style={{ padding: '3px 3px', color: '#cbd5e1', fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', width: '95px', minWidth: '85px' }}>
                                    Correo
                                </th>
                                <th style={{ padding: '3px 3px', color: '#cbd5e1', fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', width: '70px', minWidth: '60px' }}>
                                    Apellido
                                </th>
                                <th style={{ padding: '3px 3px', color: '#cbd5e1', fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', width: '60px', minWidth: '52px' }}>
                                    Nombre
                                </th>
                                <th
                                    onClick={handleSortByBadge}
                                    style={{
                                        padding: '3px 1px',
                                        textAlign: 'center',
                                        color: '#60a5fa',
                                        fontSize: '0.67rem',
                                        fontWeight: 800,
                                        textTransform: 'uppercase',
                                        width: '42px',
                                        minWidth: '38px',
                                        cursor: 'pointer',
                                        userSelect: 'none'
                                    }}
                                    title="Clic para ordenar por número de placa (ascendente)"
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                        <span># Placa</span>
                                        <span style={{ fontSize: '0.58rem', opacity: 0.8 }}>⇅</span>
                                    </div>
                                </th>
                                <th style={{ padding: '3px 4px', color: '#cbd5e1', fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', width: '130px', minWidth: '120px' }}>
                                    Rango
                                </th>

                                {/* Divisions columns */}
                                {divisions.map(div => {
                                    const rawShort = (div.short_name || div.name || '').trim();
                                    const displayShort = rawShort.length > 4 ? rawShort.substring(0, 3) : rawShort;
                                    return (
                                        <th
                                            key={div.id || div.name}
                                            style={{
                                                padding: '2px 0px',
                                                textAlign: 'center',
                                                width: '24px',
                                                minWidth: '23px',
                                                maxWidth: '25px',
                                                color: div.color || '#34d399',
                                                fontSize: '0.52rem',
                                                fontWeight: 900,
                                                letterSpacing: '-0.03em',
                                                borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
                                                lineHeight: 1
                                            }}
                                            title={`${div.name} (${div.short_name || ''})`}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                                                {div.badge_image_url ? (
                                                    <img src={div.badge_image_url} alt="" style={{ width: '12px', height: '12px', objectFit: 'contain' }} />
                                                ) : (
                                                    <span style={{ fontSize: '0.58rem' }}>🏢</span>
                                                )}
                                                <span style={{ overflow: 'hidden', textOverflow: 'clip', whiteSpace: 'nowrap', maxWidth: '23px' }}>
                                                    {displayShort}
                                                </span>
                                            </div>
                                        </th>
                                    );
                                })}

                                {/* Activity Status */}
                                <th style={{ padding: '3px 2px', textAlign: 'center', color: '#cbd5e1', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', width: '64px', minWidth: '60px', maxWidth: '66px', borderLeft: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                    Activo
                                </th>

                                {/* Valoración / Acotación */}
                                <th style={{ padding: '3px 1px', textAlign: 'center', color: '#cbd5e1', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', width: '64px', minWidth: '58px', maxWidth: '68px', borderLeft: '1px solid rgba(255, 255, 255, 0.06)' }} title="Valoración / Acotación de Fila">
                                    Val.
                                </th>

                                {/* Faltas IA */}
                                <th style={{ padding: '3px 1px', textAlign: 'center', color: '#f87171', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', width: '44px', minWidth: '40px', maxWidth: '48px' }} title="Faltas de Asuntos Internos">
                                    F. IA
                                </th>

                                {/* Dias sin ascender */}
                                <th style={{ padding: '3px 1px', textAlign: 'center', color: '#cbd5e1', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', width: '38px', minWidth: '34px' }}>
                                    Días
                                </th>

                                {/* Fecha ultimo ascenso */}
                                <th style={{ padding: '3px 2px', textAlign: 'center', color: '#cbd5e1', fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', width: '54px', minWidth: '50px' }}>
                                    F. Asc.
                                </th>

                                {/* Notas */}
                                <th style={{ padding: '3px 4px', color: '#cbd5e1', fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', width: 'auto', minWidth: '150px' }}>
                                    Notas
                                </th>

                                {/* Actions */}
                                <th style={{ padding: '3px 1px', textAlign: 'center', color: '#94a3b8', fontSize: '0.62rem', textTransform: 'uppercase', width: '56px', minWidth: '50px' }}>
                                    Acc.
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredAgents.length === 0 ? (
                                <tr>
                                    <td colSpan={15 + divisions.length} style={{ padding: '2.5rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                                        <div style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>📋</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                                            No se encontraron agentes en la plantilla con los filtros actuales
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>
                                            Prueba limpiando la búsqueda o haz clic en "Añadir Agente / Fila" para crear nuevos registros.
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredAgents.map((agent, index) => {
                                    // SECTION / DIVIDER ROW
                                    if (agent.is_divider) {
                                        const dividerColor = agent.color || '#3b82f6';
                                        let sectionAgentCount = 0;
                                        for (let i = index + 1; i < filteredAgents.length; i++) {
                                            if (filteredAgents[i].is_divider) break;
                                            sectionAgentCount++;
                                        }

                                        return (
                                            <tr
                                                key={agent.id || `div-${index}`}
                                                style={{
                                                    background: `linear-gradient(90deg, ${hexToRgba(dividerColor, 0.28)} 0%, rgba(15, 23, 42, 0.95) 45%, rgba(15, 23, 42, 0.98) 100%)`,
                                                    borderTop: `2px solid ${dividerColor}`,
                                                    borderBottom: `1px solid ${hexToRgba(dividerColor, 0.45)}`,
                                                    height: '34px',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                {/* Ord / Reorder Arrows */}
                                                <td style={{ padding: '2px 2px', textAlign: 'center', width: '20px' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                                                        <button
                                                            type="button"
                                                            disabled={index === 0}
                                                            onClick={() => handleMoveAgent(index, -1)}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: index === 0 ? '#334155' : '#94a3b8',
                                                                cursor: index === 0 ? 'default' : 'pointer',
                                                                fontSize: '0.55rem',
                                                                lineHeight: 1,
                                                                padding: 0
                                                            }}
                                                            title="Mover sección arriba"
                                                        >
                                                            ▲
                                                        </button>
                                                        <span style={{ fontSize: '0.58rem', color: dividerColor, fontWeight: 900, lineHeight: 1 }}>
                                                            §
                                                        </span>
                                                        <button
                                                            type="button"
                                                            disabled={index === agents.length - 1}
                                                            onClick={() => handleMoveAgent(index, 1)}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: index === agents.length - 1 ? '#334155' : '#94a3b8',
                                                                cursor: index === agents.length - 1 ? 'default' : 'pointer',
                                                                fontSize: '0.55rem',
                                                                lineHeight: 1,
                                                                padding: 0
                                                            }}
                                                            title="Mover sección abajo"
                                                        >
                                                            ▼
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Spanning cell for section banner */}
                                                <td
                                                    colSpan={14 + divisions.length}
                                                    style={{ padding: '3px 10px' }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '1rem', lineHeight: 1 }}>
                                                                {agent.icon || '📁'}
                                                            </span>
                                                            <span style={{
                                                                fontSize: '0.80rem',
                                                                fontWeight: 900,
                                                                letterSpacing: '0.08em',
                                                                textTransform: 'uppercase',
                                                                color: '#ffffff',
                                                                textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                                                            }}>
                                                                {agent.title || agent.nombre || 'SECCIÓN'}
                                                            </span>
                                                            <span style={{
                                                                fontSize: '0.60rem',
                                                                fontWeight: 800,
                                                                padding: '2px 7px',
                                                                borderRadius: '10px',
                                                                background: hexToRgba(dividerColor, 0.35),
                                                                color: '#f8fafc',
                                                                border: `1px solid ${hexToRgba(dividerColor, 0.65)}`
                                                            }}>
                                                                {sectionAgentCount} {sectionAgentCount === 1 ? 'agente' : 'agentes'}
                                                            </span>
                                                            <div style={{
                                                                width: '50px',
                                                                height: '2px',
                                                                background: `linear-gradient(90deg, ${dividerColor}, transparent)`,
                                                                borderRadius: '2px'
                                                            }} />
                                                        </div>

                                                        {/* Actions for divider */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEditDivider(agent)}
                                                                style={{
                                                                    background: 'rgba(255, 255, 255, 0.08)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                                                    color: '#cbd5e1',
                                                                    borderRadius: '4px',
                                                                    padding: '2px 6px',
                                                                    fontSize: '0.65rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px'
                                                                }}
                                                                title="Editar nombre/color de sección"
                                                            >
                                                                <span>✏️</span>
                                                                <span style={{ fontSize: '0.62rem' }}>Editar</span>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteDivider(agent)}
                                                                style={{
                                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                                                    color: '#f87171',
                                                                    borderRadius: '4px',
                                                                    padding: '2px 6px',
                                                                    fontSize: '0.65rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px'
                                                                }}
                                                                title="Eliminar esta barra divisoria"
                                                            >
                                                                <span>🗑️</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    const rankObj = ranks.find(r => (r.name || '').trim().toLowerCase() === (agent.rank_name || '').trim().toLowerCase());
                                    const promoDays = calculatePromotionDays(agent.last_promotion_date);
                                    const iaStatus = iaStatusMap?.getAgentStatus ? iaStatusMap.getAgentStatus(agent) : { hasActive: false, activeCount: 0 };
                                    const isPlaceholder = agent.is_placeholder || (!agent.nombre && !agent.apellido);

                                    // Valoración / Acotación matching & row color styling
                                    const valObj = activeValoraciones.find(v => (v.name || '').trim().toLowerCase() === (agent.valoracion || '').trim().toLowerCase());
                                    const hasVal = Boolean(valObj && valObj.color);
                                    const valColor = hasVal ? valObj.color : null;
                                    const defaultBg = isPlaceholder ? 'rgba(234, 179, 8, 0.03)' : (index % 2 === 0 ? 'rgba(15, 23, 42, 0.3)' : 'transparent');
                                    const rowBg = hasVal
                                        ? `linear-gradient(90deg, ${hexToRgba(valColor, 0.30)} 0%, ${hexToRgba(valColor, 0.12)} 100%)`
                                        : defaultBg;
                                    const rowHoverBg = hasVal
                                        ? `linear-gradient(90deg, ${hexToRgba(valColor, 0.40)} 0%, ${hexToRgba(valColor, 0.20)} 100%)`
                                        : (isPlaceholder ? 'rgba(234, 179, 8, 0.08)' : 'rgba(255, 255, 255, 0.04)');

                                    return (
                                        <tr
                                            key={agent.id || index}
                                            style={{
                                                borderBottom: hasVal ? `1px solid ${hexToRgba(valColor, 0.45)}` : '1px solid rgba(255, 255, 255, 0.04)',
                                                background: rowBg,
                                                boxShadow: hasVal ? `inset 4px 0 0 0 ${valColor}` : 'none',
                                                transition: 'background 0.12s ease',
                                                height: '32px'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = rowHoverBg}
                                            onMouseLeave={e => e.currentTarget.style.background = rowBg}
                                        >
                                            {/* Move Reorder */}
                                            <td style={{ padding: '2px 2px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                                                    <button
                                                        type="button"
                                                        disabled={index === 0}
                                                        onClick={() => handleMoveAgent(index, -1)}
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: index === 0 ? '#334155' : '#94a3b8',
                                                            cursor: index === 0 ? 'default' : 'pointer',
                                                            fontSize: '0.55rem',
                                                            lineHeight: 1,
                                                            padding: 0
                                                        }}
                                                        title="Mover arriba"
                                                    >
                                                        ▲
                                                    </button>
                                                    <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, lineHeight: 1 }}>
                                                        {index + 1}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        disabled={index === agents.length - 1}
                                                        onClick={() => handleMoveAgent(index, 1)}
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: index === agents.length - 1 ? '#334155' : '#94a3b8',
                                                            cursor: index === agents.length - 1 ? 'default' : 'pointer',
                                                            fontSize: '0.55rem',
                                                            lineHeight: 1,
                                                            padding: 0
                                                        }}
                                                        title="Mover abajo"
                                                    >
                                                        ▼
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Foto */}
                                            <td style={{ padding: '2px 1px', textAlign: 'center', width: '22px' }}>
                                                <div style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: '50%',
                                                    background: 'rgba(255, 255, 255, 0.08)',
                                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                                    overflow: 'hidden',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '0.68rem'
                                                }}>
                                                    {agent.avatar_url ? (
                                                        <img src={agent.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
                                                    ) : (
                                                        <span>{isPlaceholder ? '📌' : '👤'}</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Usuario */}
                                            <td style={{ padding: '2px 3px', width: '75px', minWidth: '65px' }} title={agent.username}>
                                                <div style={{
                                                    color: agent.username ? '#f8fafc' : '#64748b',
                                                    fontWeight: 600,
                                                    fontSize: '0.70rem',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {agent.username || (isPlaceholder ? <span style={{ color: '#eab308', fontStyle: 'italic', fontSize: '0.66rem' }}>[Reserv.]</span> : '—')}
                                                </div>
                                            </td>

                                            {/* Correo (Click/Hover para copiar al portapapeles) */}
                                            {(() => {
                                                const isCopied = copiedEmailAgentId === (agent.id || index);
                                                return (
                                                    <td style={{ padding: '2px 3px', width: '95px', minWidth: '85px' }}>
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopyEmail(agent.email, agent.id || index);
                                                            }}
                                                            style={{
                                                                color: isCopied ? '#34d399' : (agent.email ? '#94a3b8' : '#475569'),
                                                                fontSize: '0.67rem',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                                cursor: agent.email ? 'pointer' : 'default',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '3px',
                                                                borderRadius: '4px',
                                                                padding: '1px 3px',
                                                                transition: 'all 0.15s ease',
                                                                background: isCopied ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                                                                border: isCopied ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid transparent'
                                                            }}
                                                            onMouseEnter={e => {
                                                                if (agent.email && !isCopied) {
                                                                    e.currentTarget.style.color = '#38bdf8';
                                                                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)';
                                                                    e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                                                                }
                                                            }}
                                                            onMouseLeave={e => {
                                                                if (!isCopied) {
                                                                    e.currentTarget.style.color = agent.email ? '#94a3b8' : '#475569';
                                                                    e.currentTarget.style.background = 'transparent';
                                                                    e.currentTarget.style.borderColor = 'transparent';
                                                                }
                                                            }}
                                                            title={isCopied ? '¡Correo copiado al portapapeles!' : (agent.email ? `📋 Clic para copiar: ${agent.email}` : 'Sin correo registrado')}
                                                        >
                                                            {isCopied ? (
                                                                <span style={{ fontWeight: 800, fontSize: '0.64rem', color: '#34d399' }}>✓ Copiado</span>
                                                            ) : (
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.email || '—'}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })()}

                                            {/* Apellido */}
                                            <td style={{ padding: '2px 3px', width: '70px', minWidth: '60px' }} title={agent.apellido}>
                                                <div style={{
                                                    color: agent.apellido ? '#f8fafc' : '#64748b',
                                                    fontWeight: 800,
                                                    fontSize: '0.72rem',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {agent.apellido || '—'}
                                                </div>
                                            </td>

                                            {/* Nombre */}
                                            <td style={{ padding: '2px 3px', width: '60px', minWidth: '52px' }} title={agent.nombre}>
                                                <div style={{
                                                    color: agent.nombre ? '#cbd5e1' : '#64748b',
                                                    fontSize: '0.72rem',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {agent.nombre || '—'}
                                                </div>
                                            </td>

                                            {/* # Placa */}
                                            <td style={{ padding: '2px 1px', textAlign: 'center', width: '38px', minWidth: '36px' }}>
                                                <span style={{
                                                    fontSize: '0.70rem',
                                                    fontWeight: 900,
                                                    color: isPlaceholder ? '#fbbf24' : '#60a5fa',
                                                    background: isPlaceholder ? 'rgba(234, 179, 8, 0.15)' : 'rgba(59, 130, 246, 0.12)',
                                                    padding: '1px 2px',
                                                    borderRadius: '3px',
                                                    border: isPlaceholder ? '1px dashed rgba(234, 179, 8, 0.4)' : '1px solid rgba(59, 130, 246, 0.3)'
                                                }}>
                                                    {agent.no_placa || 'S/P'}
                                                </span>
                                            </td>

                                            {/* Rango (with badge image) */}
                                            <td style={{ padding: '2px 4px', width: '130px', minWidth: '120px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    {rankObj?.badge_image_url ? (
                                                        <div style={{
                                                             width: '14px',
                                                             height: '14px',
                                                             borderRadius: '2px',
                                                             background: 'rgba(15, 23, 42, 0.8)',
                                                             border: `1px solid ${rankObj.color || 'rgba(255, 255, 255, 0.2)'}`,
                                                             display: 'flex',
                                                             alignItems: 'center',
                                                             justifyContent: 'center',
                                                             overflow: 'hidden',
                                                             flexShrink: 0
                                                        }}>
                                                            <img src={rankObj.badge_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '0.66rem', flexShrink: 0 }}>🎖️</span>
                                                    )}
                                                    <span style={{
                                                        fontSize: '0.70rem',
                                                        fontWeight: 800,
                                                        color: rankObj?.color || '#f8fafc',
                                                        whiteSpace: 'nowrap'
                                                    }} title={agent.rank_name}>
                                                        {agent.rank_name || 'Sin Rango'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Divisions cells */}
                                            {divisions.map(div => {
                                                const agentDivs = Array.isArray(agent.divisions) ? agent.divisions : [];
                                                const hasDiv = agentDivs.includes(div.short_name) || agentDivs.includes(div.name);

                                                return (
                                                    <td
                                                        key={div.id || div.name}
                                                        onClick={() => handleQuickToggleDivision(agent, div.short_name || div.name)}
                                                        style={{
                                                            padding: '1px 0px',
                                                            textAlign: 'center',
                                                            width: '24px',
                                                            minWidth: '23px',
                                                            maxWidth: '25px',
                                                            cursor: 'pointer',
                                                            borderLeft: '1px solid rgba(255, 255, 255, 0.05)',
                                                            background: hasDiv ? 'rgba(16, 185, 129, 0.15)' : 'transparent'
                                                        }}
                                                        title={`${hasDiv ? 'Quitar de' : 'Asignar a'} ${div.name}`}
                                                    >
                                                        {hasDiv ? (
                                                            div.badge_image_url ? (
                                                                <img
                                                                    src={div.badge_image_url}
                                                                    alt={div.short_name}
                                                                    style={{ width: '13px', height: '13px', objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle' }}
                                                                />
                                                            ) : (
                                                                <span style={{ fontSize: '0.62rem', color: div.color || '#34d399', fontWeight: 900, lineHeight: 1 }}>
                                                                    ✓
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span style={{ color: 'rgba(255, 255, 255, 0.05)', fontSize: '0.52rem' }}>·</span>
                                                        )}
                                                    </td>
                                                );
                                            })}

                                            {/* Actividad */}
                                            <td style={{ padding: '2px 2px', textAlign: 'center', width: '64px', minWidth: '60px', maxWidth: '66px', borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                                {(() => {
                                                    const act = (agent.activity_status || 'Activo').toLowerCase();
                                                    const isActivo = !act.includes('inactiv') && !act.includes('no activ') && !act.includes('poco') && !act.includes('vacacion');
                                                    const isPoco = act.includes('poco') || act.includes('vacacion');

                                                    return (
                                                        <select
                                                            value={agent.activity_status || 'Activo'}
                                                            onChange={e => handleQuickChangeActivity(agent, e.target.value)}
                                                            style={{
                                                                background: isActivo ? 'rgba(16, 185, 129, 0.18)' : (isPoco ? 'rgba(245, 158, 11, 0.18)' : 'rgba(239, 68, 68, 0.18)'),
                                                                border: isActivo ? '1px solid rgba(16, 185, 129, 0.45)' : (isPoco ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid rgba(239, 68, 68, 0.45)'),
                                                                color: isActivo ? '#34d399' : (isPoco ? '#fbbf24' : '#f87171'),
                                                                borderRadius: '4px',
                                                                padding: '1px 3px',
                                                                fontSize: '0.67rem',
                                                                fontWeight: 800,
                                                                cursor: 'pointer',
                                                                width: '58px'
                                                            }}
                                                        >
                                                            <option value="Activo">🟢 Si</option>
                                                            <option value="Poco activa">🟡 Poco</option>
                                                            <option value="Inactivo">🔴 No</option>
                                                        </select>
                                                    );
                                                })()}
                                            </td>

                                            {/* Valoración / Acotación Quick Selector */}
                                            <td style={{ padding: '2px 1px', textAlign: 'center', width: '64px', minWidth: '58px', maxWidth: '68px', borderLeft: '1px solid rgba(255, 255, 255, 0.06)' }}>
                                                <select
                                                    value={agent.valoracion || ''}
                                                    onChange={e => handleQuickChangeValoracion(agent, e.target.value)}
                                                    style={{
                                                        background: hasVal ? hexToRgba(valColor, 0.35) : 'rgba(15, 23, 42, 0.85)',
                                                        border: hasVal ? `1px solid ${valColor}` : '1px solid rgba(255, 255, 255, 0.15)',
                                                        color: hasVal ? '#ffffff' : '#94a3b8',
                                                        borderRadius: '4px',
                                                        padding: '1px 2px',
                                                        fontSize: '0.63rem',
                                                        fontWeight: 800,
                                                        cursor: 'pointer',
                                                        width: '58px',
                                                        maxWidth: '60px',
                                                        textOverflow: 'ellipsis'
                                                    }}
                                                    title={valObj?.description ? `${valObj.name}: ${valObj.description}` : 'Asignar valoración / acotación a toda la fila'}
                                                >
                                                    <option value="" style={{ background: '#0f172a', color: '#94a3b8' }}>—</option>
                                                    {activeValoraciones.map(v => (
                                                        <option key={v.id || v.name} value={v.name} style={{ background: '#0f172a', color: v.color || '#f8fafc' }}>
                                                            ● {v.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>

                                            {/* Faltas IA (Linked IA status indicator - Clickable to open IA dossier) */}
                                            <td
                                                style={{ padding: '2px 1px', textAlign: 'center', width: '44px', minWidth: '40px', maxWidth: '48px', cursor: 'pointer' }}
                                                onClick={() => navigate(iaStatus?.profileId ? `/internal-affairs/sanctions/${iaStatus.profileId}` : '/internal-affairs/sanctions')}
                                                title={iaStatus.hasActive
                                                    ? `Falta activa en IA: ${iaStatus.mostSevereActive}. Expira: ${iaStatus.latestExpiryDateFormatted || ''} (${iaStatus.maxDaysRemaining}d restantes).\nClic para abrir expediente en Asuntos Internos.`
                                                    : '0 faltas activas en IA.\nClic para ir a Asuntos Internos.'}
                                            >
                                                {iaStatus.hasActive ? (
                                                    <div
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.2)',
                                                            border: '1px solid rgba(239, 68, 68, 0.5)',
                                                            color: '#f87171',
                                                            borderRadius: '4px',
                                                            padding: '1px 3px',
                                                            fontSize: '0.63rem',
                                                            fontWeight: 800,
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '2px',
                                                            transition: 'transform 0.15s ease'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                    >
                                                        <span>⚠️ {iaStatus.activeCount}</span>
                                                    </div>
                                                ) : (
                                                    <span
                                                        style={{
                                                            fontSize: '0.64rem',
                                                            color: '#6ee7b7',
                                                            background: 'rgba(16, 185, 129, 0.1)',
                                                            padding: '1px 3px',
                                                            borderRadius: '3px',
                                                            fontWeight: 700,
                                                            display: 'inline-block',
                                                            transition: 'transform 0.15s ease'
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                    >
                                                        ✅ 0
                                                    </span>
                                                )}
                                            </td>

                                            {/* Días sin ascender (Color coded) */}
                                            <td style={{ padding: '2px 1px', textAlign: 'center', width: '38px', minWidth: '34px' }}>
                                                <span style={{
                                                    fontSize: '0.68rem',
                                                    fontWeight: 900,
                                                    background: promoDays.bg,
                                                    border: promoDays.border,
                                                    color: promoDays.color,
                                                    padding: '1px 3px',
                                                    borderRadius: '3px'
                                                }}>
                                                    {promoDays.days}d
                                                </span>
                                            </td>

                                            {/* Fecha último ascenso */}
                                            <td style={{ padding: '2px 2px', textAlign: 'center', fontSize: '0.64rem', width: '54px', minWidth: '50px', color: agent.last_promotion_date ? '#cbd5e1' : '#64748b' }}>
                                                {agent.last_promotion_date ? agent.last_promotion_date.split('T')[0].split('-').reverse().slice(0, 2).join('/') : '—'}
                                            </td>

                                            {/* Notas */}
                                            <td style={{ padding: '2px 4px', width: 'auto', minWidth: '150px' }} title={agent.notes}>
                                                <div style={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    color: agent.notes ? '#cbd5e1' : '#475569',
                                                    fontSize: '0.68rem'
                                                }}>
                                                    {agent.notes || '—'}
                                                </div>
                                            </td>

                                            {/* Acciones */}
                                            <td style={{ padding: '2px 1px', textAlign: 'center', width: '56px', minWidth: '50px' }}>
                                                <div style={{ display: 'inline-flex', gap: '2px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditAgent(agent)}
                                                        style={{
                                                            background: 'rgba(255, 255, 255, 0.08)',
                                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                                            color: '#cbd5e1',
                                                            borderRadius: '4px',
                                                            padding: '1px 3px',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Editar agente"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenAddDivider(index)}
                                                        style={{
                                                            background: 'rgba(59, 130, 246, 0.12)',
                                                            border: '1px solid rgba(59, 130, 246, 0.3)',
                                                            color: '#93c5fd',
                                                            borderRadius: '4px',
                                                            padding: '1px 3px',
                                                            fontSize: '0.62rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Insertar barra divisoria debajo de este agente"
                                                    >
                                                        📑
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteAgent(agent)}
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.08)',
                                                            border: '1px solid rgba(239, 68, 68, 0.25)',
                                                            color: '#fca5a5',
                                                            borderRadius: '4px',
                                                            padding: '1px 3px',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Eliminar de la plantilla"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODALS */}

            {/* Agent Create / Edit Modal */}
            {showAgentModal && (
                <PlantillaAgentModal
                    agent={selectedAgentForEdit}
                    ranks={ranks}
                    divisions={divisions}
                    valoraciones={activeValoraciones}
                    onClose={() => {
                        setShowAgentModal(false);
                        setSelectedAgentForEdit(null);
                    }}
                    onSave={handleSaveAgent}
                />
            )}

            {/* Section Divider Modal */}
            {showDividerModal && (
                <PlantillaDividerModal
                    isOpen={showDividerModal}
                    divider={selectedDividerForEdit}
                    initialInsertIndex={dividerInsertIndex}
                    agents={agents}
                    onClose={() => {
                        setShowDividerModal(false);
                        setSelectedDividerForEdit(null);
                        setDividerInsertIndex(null);
                    }}
                    onSave={handleSaveDivider}
                />
            )}

            {/* Ranks Manager Modal */}
            {showRanksManager && (
                <PlantillaRanksManager
                    ranks={ranks}
                    onClose={() => setShowRanksManager(false)}
                    onRanksUpdated={handleRanksUpdated}
                    onApplyHierarchy={handleSortByRankHierarchy}
                />
            )}

            {/* Divisions Manager Modal */}
            {showDivisionsManager && (
                <PlantillaDivisionsManager
                    divisions={divisions}
                    onClose={() => setShowDivisionsManager(false)}
                    onDivisionsUpdated={onDivisionsUpdated}
                />
            )}

            {/* Valoraciones / Acotaciones Manager Modal */}
            {showValoracionesManager && (
                <PlantillaValoracionesManager
                    valoraciones={activeValoraciones}
                    onClose={() => setShowValoracionesManager(false)}
                    onValoracionesUpdated={onValoracionesUpdated}
                />
            )}

            {/* Analytics Modal */}
            {showAnalytics && (
                <PlantillaAnalytics
                    agents={agents}
                    ranks={ranks}
                    divisions={divisions}
                    iaStatusMap={iaStatusMap}
                    onClose={() => setShowAnalytics(false)}
                />
            )}

        </div>
    );
}

