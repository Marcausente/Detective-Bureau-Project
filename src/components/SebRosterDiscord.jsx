import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { uploadImageToStorage } from '../utils/imageStorage';
import {
    SCUB_LOGO_URL,
    DEFAULT_SEB_ROSTER_DATA,
    getSEBRosterConfig,
    saveSEBRosterConfig,
    sendSEBRosterToDiscord,
    formatSEBMemberLine,
    buildSEBRosterDiscordMarkdown,
    normalizeDiscordImageUrl
} from '../utils/discordWebhook';
import '../index.css';

export default function SebRosterDiscord() {
    const { language } = useLanguage();
    const { branding } = useTheme();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);

    // Roster Config State
    const [rosterData, setRosterData] = useState(DEFAULT_SEB_ROSTER_DATA);
    const [title, setTitle] = useState('Miembros e indicativos.');
    const [bannerUrl, setBannerUrl] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [rolePing, setRolePing] = useState('');
    const [botName, setBotName] = useState('SEB • Special Enforcement Bureau');
    const [botAvatar, setBotAvatar] = useState(SCUB_LOGO_URL);
    const [enabled, setEnabled] = useState(true);

    // Modals & UI State
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    
    // Add / Edit Team Modal State
    const [showTeamModal, setShowTeamModal] = useState(false);
    const [editingTeam, setEditingTeam] = useState(null); // { id, teamName, teamIcon }
    const [teamForm, setTeamForm] = useState({ teamName: '', teamIcon: '🦇' });

    // Add / Edit Group Modal State
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [targetTeamId, setTargetTeamId] = useState(null);
    const [editingGroup, setEditingGroup] = useState(null); // { teamId, groupId, name, icon }
    const [groupForm, setGroupForm] = useState({ name: '', icon: '' });

    // Edit Member Modal State
    const [showEditMemberModal, setShowEditMemberModal] = useState(false);
    const [editingMemberInfo, setEditingMemberInfo] = useState(null); // { teamId, groupId, memberIdx, member }

    // Quick Add Member Inline Inputs: { [groupId]: { callsign: '', name: '', discordId: '', badge: '' } }
    const [memberInputs, setMemberInputs] = useState({});

    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const showSuccess = (msg) => {
        setFeedback(msg);
        setErrorMsg(null);
        setTimeout(() => setFeedback(null), 4500);
    };

    const showError = (msg) => {
        setErrorMsg(msg);
        setFeedback(null);
        setTimeout(() => setErrorMsg(null), 6000);
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const config = await getSEBRosterConfig();
            setRosterData(Array.isArray(config.rosterData) && config.rosterData.length > 0 ? config.rosterData : DEFAULT_SEB_ROSTER_DATA);
            setTitle(config.title || 'Miembros e indicativos.');
            setBannerUrl(config.bannerUrl || '');
            setWebhookUrl(config.webhookUrl || '');
            setRolePing(config.rolePing || '');
            setBotName(config.botName || 'SEB • Special Enforcement Bureau');
            setBotAvatar(config.botAvatar || SCUB_LOGO_URL);
            setEnabled(config.enabled !== undefined ? config.enabled : true);
        } catch (err) {
            console.error('Error loading SEB roster:', err);
            showError('Error al cargar la plantilla: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Save Roster to Supabase & LocalStorage
    const handleSaveRoster = async () => {
        try {
            setSubmitting(true);
            const res = await saveSEBRosterConfig({
                rosterData,
                webhookUrl,
                title,
                bannerUrl,
                rolePing,
                botName,
                botAvatar,
                enabled
            });

            if (res.success) {
                showSuccess('✅ Plantilla de SEB e indicativos guardada con éxito.');
            } else {
                showError('Error al guardar: ' + (res.error || 'Desconocido'));
            }
        } catch (err) {
            showError('Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Publish to Discord
    const handlePublishDiscord = async () => {
        if (!webhookUrl || !webhookUrl.trim().startsWith('https://')) {
            setShowSettingsModal(true);
            showError('Configura primero una URL de Webhook válida de Discord.');
            return;
        }

        try {
            setPublishing(true);

            // Auto-save first
            await saveSEBRosterConfig({
                rosterData,
                webhookUrl,
                title,
                bannerUrl,
                rolePing,
                botName,
                botAvatar,
                enabled
            });

            const res = await sendSEBRosterToDiscord({
                rosterData,
                title,
                bannerUrl,
                customConfig: {
                    webhookUrl,
                    enabled: true,
                    rolePing,
                    botName,
                    botAvatar
                },
                forceSend: true
            });

            if (res.success) {
                showSuccess('🚀 ¡Plantilla de miembros e indicativos de SEB publicada exitosamente en Discord!');
            } else {
                showError('Error al enviar a Discord: ' + (res.error || 'Verifica la URL del Webhook.'));
            }
        } catch (err) {
            showError('Error al publicar: ' + err.message);
        } finally {
            setPublishing(false);
        }
    };

    // Upload Banner Image
    const handleBannerUpload = async (file) => {
        if (!file) return;
        try {
            setUploadingBanner(true);
            const url = await uploadImageToStorage(file, 'seb');
            setBannerUrl(url);
            showSuccess('Banner subido con éxito.');
        } catch (err) {
            showError('Error al subir banner: ' + err.message);
        } finally {
            setUploadingBanner(false);
        }
    };

    // Upload Avatar Image
    const handleAvatarUpload = async (file) => {
        if (!file) return;
        try {
            setUploadingAvatar(true);
            const url = await uploadImageToStorage(file, 'seb');
            setBotAvatar(url);
            showSuccess('Avatar de bot subido con éxito.');
        } catch (err) {
            showError('Error al subir avatar: ' + err.message);
        } finally {
            setUploadingAvatar(false);
        }
    };

    // --------------------------------------------------------------------------
    // TEAM ACTIONS
    // --------------------------------------------------------------------------
    const handleOpenAddTeam = () => {
        setEditingTeam(null);
        setTeamForm({ teamName: '', teamIcon: '🦇' });
        setShowTeamModal(true);
    };

    const handleOpenEditTeam = (team) => {
        setEditingTeam(team);
        setTeamForm({ teamName: team.teamName || '', teamIcon: team.teamIcon || '' });
        setShowTeamModal(true);
    };

    const handleSaveTeam = () => {
        if (!teamForm.teamName.trim()) {
            showError('El nombre del equipo es obligatorio.');
            return;
        }

        if (editingTeam) {
            // Edit existing team
            setRosterData(prev => prev.map(t => t.id === editingTeam.id ? {
                ...t,
                teamName: teamForm.teamName.trim(),
                teamIcon: teamForm.teamIcon.trim()
            } : t));
            showSuccess('Equipo actualizado.');
        } else {
            // Add new team
            const newTeam = {
                id: 'team-' + Date.now(),
                teamName: teamForm.teamName.trim(),
                teamIcon: teamForm.teamIcon.trim(),
                groups: []
            };
            setRosterData(prev => [...prev, newTeam]);
            showSuccess('Nuevo equipo añadido.');
        }

        setShowTeamModal(false);
    };

    const handleDeleteTeam = (teamId) => {
        if (window.confirm('¿Seguro que deseas eliminar este equipo y todos sus grupos?')) {
            setRosterData(prev => prev.filter(t => t.id !== teamId));
            showSuccess('Equipo eliminado.');
        }
    };

    const handleMoveTeam = (teamIdx, direction) => {
        const newRoster = [...rosterData];
        const targetIdx = teamIdx + direction;
        if (targetIdx < 0 || targetIdx >= newRoster.length) return;
        const temp = newRoster[teamIdx];
        newRoster[teamIdx] = newRoster[targetIdx];
        newRoster[targetIdx] = temp;
        setRosterData(newRoster);
    };

    // --------------------------------------------------------------------------
    // GROUP ACTIONS
    // --------------------------------------------------------------------------
    const handleOpenAddGroup = (teamId) => {
        setTargetTeamId(teamId);
        setEditingGroup(null);
        setGroupForm({ name: '', icon: '' });
        setShowGroupModal(true);
    };

    const handleOpenEditGroup = (teamId, group) => {
        setTargetTeamId(teamId);
        setEditingGroup({ teamId, groupId: group.id });
        setGroupForm({ name: group.name || '', icon: group.icon || '' });
        setShowGroupModal(true);
    };

    const handleSaveGroup = () => {
        if (!groupForm.name.trim()) {
            showError('El nombre del grupo es obligatorio.');
            return;
        }

        if (editingGroup) {
            // Edit group
            setRosterData(prev => prev.map(t => {
                if (t.id !== editingGroup.teamId) return t;
                return {
                    ...t,
                    groups: (t.groups || []).map(g => g.id === editingGroup.groupId ? {
                        ...g,
                        name: groupForm.name.trim(),
                        icon: groupForm.icon.trim()
                    } : g)
                };
            }));
            showSuccess('Grupo actualizado.');
        } else {
            // Add new group to target team
            const newGroup = {
                id: 'grp-' + Date.now(),
                name: groupForm.name.trim(),
                icon: groupForm.icon.trim(),
                members: []
            };
            setRosterData(prev => prev.map(t => {
                if (t.id !== targetTeamId) return t;
                return {
                    ...t,
                    groups: [...(t.groups || []), newGroup]
                };
            }));
            showSuccess('Nuevo grupo añadido.');
        }

        setShowGroupModal(false);
    };

    const handleDeleteGroup = (teamId, groupId) => {
        if (window.confirm('¿Seguro que deseas eliminar este grupo y sus integrantes?')) {
            setRosterData(prev => prev.map(t => {
                if (t.id !== teamId) return t;
                return {
                    ...t,
                    groups: (t.groups || []).filter(g => g.id !== groupId)
                };
            }));
            showSuccess('Grupo eliminado.');
        }
    };

    const handleMoveGroup = (teamId, groupIdx, direction) => {
        setRosterData(prev => prev.map(t => {
            if (t.id !== teamId) return t;
            const groups = [...(t.groups || [])];
            const targetIdx = groupIdx + direction;
            if (targetIdx < 0 || targetIdx >= groups.length) return t;
            const temp = groups[groupIdx];
            groups[groupIdx] = groups[targetIdx];
            groups[targetIdx] = temp;
            return { ...t, groups };
        }));
    };

    // --------------------------------------------------------------------------
    // MEMBER ACTIONS
    // --------------------------------------------------------------------------
    const handleMemberInputChange = (groupId, field, value) => {
        setMemberInputs(prev => ({
            ...prev,
            [groupId]: {
                ...(prev[groupId] || {}),
                [field]: value
            }
        }));
    };

    const handleQuickAddMember = (teamId, groupId) => {
        const input = memberInputs[groupId] || {};
        const callsign = (input.callsign || '').trim();
        const name = (input.name || '').trim();
        const discordId = (input.discordId || '').trim();
        const badge = (input.badge || '').trim();

        if (!callsign && !name && !discordId) {
            showError('Introduce al menos el indicativo o el nombre del agente.');
            return;
        }

        const newMember = {
            id: 'm-' + Date.now(),
            callsign,
            name,
            discordId,
            badge
        };

        setRosterData(prev => prev.map(t => {
            if (t.id !== teamId) return t;
            return {
                ...t,
                groups: (t.groups || []).map(g => {
                    if (g.id !== groupId) return g;
                    return {
                        ...g,
                        members: [...(g.members || []), newMember]
                    };
                })
            };
        }));

        // Reset inputs for this group
        setMemberInputs(prev => ({
            ...prev,
            [groupId]: { callsign: '', name: '', discordId: '', badge: '' }
        }));
        showSuccess('Agente añadido al grupo.');
    };

    const handleOpenEditMember = (teamId, groupId, memberIdx, member) => {
        setEditingMemberInfo({
            teamId,
            groupId,
            memberIdx,
            callsign: member.callsign || '',
            name: member.name || '',
            discordId: member.discordId || '',
            badge: member.badge || member.no_placa || ''
        });
        setShowEditMemberModal(true);
    };

    const handleSaveEditMember = () => {
        if (!editingMemberInfo) return;
        const { teamId, groupId, memberIdx, callsign, name, discordId, badge } = editingMemberInfo;

        setRosterData(prev => prev.map(t => {
            if (t.id !== teamId) return t;
            return {
                ...t,
                groups: (t.groups || []).map(g => {
                    if (g.id !== groupId) return g;
                    const members = [...(g.members || [])];
                    if (members[memberIdx]) {
                        members[memberIdx] = {
                            ...members[memberIdx],
                            callsign: (callsign || '').trim(),
                            name: (name || '').trim(),
                            discordId: (discordId || '').trim(),
                            badge: (badge || '').trim()
                        };
                    }
                    return { ...g, members };
                })
            };
        }));

        setShowEditMemberModal(false);
        showSuccess('Agente actualizado.');
    };

    const handleDeleteMember = (teamId, groupId, memberIdx) => {
        setRosterData(prev => prev.map(t => {
            if (t.id !== teamId) return t;
            return {
                ...t,
                groups: (t.groups || []).map(g => {
                    if (g.id !== groupId) return g;
                    return {
                        ...g,
                        members: (g.members || []).filter((_, idx) => idx !== memberIdx)
                    };
                })
            };
        }));
    };

    const handleMoveMember = (teamId, groupId, memberIdx, direction) => {
        setRosterData(prev => prev.map(t => {
            if (t.id !== teamId) return t;
            return {
                ...t,
                groups: (t.groups || []).map(g => {
                    if (g.id !== groupId) return g;
                    const members = [...(g.members || [])];
                    const targetIdx = memberIdx + direction;
                    if (targetIdx < 0 || targetIdx >= members.length) return g;
                    const temp = members[memberIdx];
                    members[memberIdx] = members[targetIdx];
                    members[targetIdx] = temp;
                    return { ...g, members };
                })
            };
        }));
    };

    // Calculate total statistics
    const totalTeams = rosterData.length;
    const totalGroups = rosterData.reduce((acc, t) => acc + (t.groups?.length || 0), 0);
    const totalMembers = rosterData.reduce((acc, t) => acc + (t.groups?.reduce((gAcc, g) => gAcc + (g.members?.length || 0), 0) || 0), 0);

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Feedback Notifications */}
            {feedback && (
                <div style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#6ee7b7',
                    padding: '0.9rem 1.25rem',
                    borderRadius: '12px',
                    marginBottom: '1.5rem',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    backdropFilter: 'blur(10px)'
                }}>
                    <span>{feedback}</span>
                </div>
            )}

            {errorMsg && (
                <div style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                    padding: '0.9rem 1.25rem',
                    borderRadius: '12px',
                    marginBottom: '1.5rem',
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    backdropFilter: 'blur(10px)'
                }}>
                    <span>⚠️ {errorMsg}</span>
                </div>
            )}

            {/* Top Tactical Command Bar */}
            <div style={{
                background: 'rgba(15, 23, 42, 0.75)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: '16px',
                padding: '1.25rem 1.75rem',
                marginBottom: '1.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.25rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.3), rgba(202, 138, 4, 0.2))',
                        border: '1px solid rgba(234, 179, 8, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.6rem',
                        boxShadow: '0 0 15px rgba(234, 179, 8, 0.2)'
                    }}>
                        🦇
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fef08a', margin: 0 }}>
                                {title || 'Miembros e indicativos.'}
                            </h2>
                            <span style={{
                                background: webhookUrl ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: webhookUrl ? '#34d399' : '#f87171',
                                border: `1px solid ${webhookUrl ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                                padding: '0.15rem 0.6rem',
                                borderRadius: '999px',
                                fontSize: '0.72rem',
                                fontWeight: 700
                            }}>
                                {webhookUrl ? '● Webhook Conectado' : '○ Webhook Sin Configurar'}
                            </span>
                        </div>
                        <p style={{ margin: '0.2rem 0 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>
                            {totalTeams} Equipos • {totalGroups} Grupos Tácticos • {totalMembers} Integrantes asignados
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Open Webhook Settings */}
                    <button
                        type="button"
                        onClick={() => setShowSettingsModal(true)}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#e2e8f0',
                            padding: '0.6rem 1.1rem',
                            borderRadius: '10px',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>⚙️</span>
                        <span>Configurar Webhook</span>
                    </button>

                    {/* Preview Discord Embed */}
                    <button
                        type="button"
                        onClick={() => setShowPreviewModal(true)}
                        style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.35)',
                            color: '#93c5fd',
                            padding: '0.6rem 1.1rem',
                            borderRadius: '10px',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>👁️</span>
                        <span>Vista Previa Discord</span>
                    </button>

                    {/* Add Team */}
                    <button
                        type="button"
                        onClick={handleOpenAddTeam}
                        style={{
                            background: 'rgba(234, 179, 8, 0.15)',
                            border: '1px solid rgba(234, 179, 8, 0.35)',
                            color: '#fef08a',
                            padding: '0.6rem 1.1rem',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>➕</span>
                        <span>Añadir Equipo</span>
                    </button>

                    {/* Save Changes */}
                    <button
                        type="button"
                        onClick={handleSaveRoster}
                        disabled={submitting}
                        style={{
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            color: '#6ee7b7',
                            padding: '0.6rem 1.25rem',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: submitting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>💾</span>
                        <span>{submitting ? 'Guardando...' : 'Guardar'}</span>
                    </button>

                    {/* Publish to Discord */}
                    <button
                        type="button"
                        onClick={handlePublishDiscord}
                        disabled={publishing}
                        style={{
                            background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                            border: '1px solid #eab308',
                            color: '#0f172a',
                            padding: '0.6rem 1.35rem',
                            borderRadius: '10px',
                            fontWeight: 800,
                            fontSize: '0.88rem',
                            cursor: publishing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 14px rgba(234, 179, 8, 0.4)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>🚀</span>
                        <span>{publishing ? 'Publicando...' : 'Publicar a Discord'}</span>
                    </button>
                </div>
            </div>

            {/* Teams and Groups Layout */}
            {rosterData.length === 0 ? (
                <div style={{
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px dashed rgba(255, 255, 255, 0.2)',
                    borderRadius: '16px',
                    padding: '3rem 2rem',
                    textAlign: 'center',
                    color: '#94a3b8'
                }}>
                    <p style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>No hay equipos creados todavía.</p>
                    <button
                        onClick={handleOpenAddTeam}
                        style={{
                            background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                            color: '#0f172a',
                            border: 'none',
                            padding: '0.7rem 1.5rem',
                            borderRadius: '10px',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        ➕ Crear Primer Equipo (Ej: Equipo S.E.B.)
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {rosterData.map((team, teamIdx) => (
                        <div
                            key={team.id || teamIdx}
                            style={{
                                background: 'rgba(15, 23, 42, 0.7)',
                                border: '1px solid rgba(234, 179, 8, 0.25)',
                                borderRadius: '18px',
                                overflow: 'hidden',
                                backdropFilter: 'blur(16px)',
                                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)'
                            }}
                        >
                            {/* Team Header */}
                            <div style={{
                                background: 'linear-gradient(90deg, rgba(234, 179, 8, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)',
                                borderBottom: '1px solid rgba(234, 179, 8, 0.25)',
                                padding: '1rem 1.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '1rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <span style={{ fontSize: '1.4rem' }}>{team.teamIcon || '🛡️'}</span>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fef08a', margin: 0 }}>
                                        {team.teamName}
                                    </h3>
                                    <span style={{
                                        background: 'rgba(234, 179, 8, 0.2)',
                                        color: '#fef08a',
                                        padding: '0.15rem 0.55rem',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 700
                                    }}>
                                        {team.groups?.length || 0} Grupos
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {/* Move Team Up / Down */}
                                    <button
                                        type="button"
                                        onClick={() => handleMoveTeam(teamIdx, -1)}
                                        disabled={teamIdx === 0}
                                        title="Mover arriba"
                                        style={{
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: teamIdx === 0 ? '#475569' : '#cbd5e1',
                                            padding: '0.35rem 0.6rem',
                                            borderRadius: '6px',
                                            cursor: teamIdx === 0 ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        ▲
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleMoveTeam(teamIdx, 1)}
                                        disabled={teamIdx === rosterData.length - 1}
                                        title="Mover abajo"
                                        style={{
                                            background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: teamIdx === rosterData.length - 1 ? '#475569' : '#cbd5e1',
                                            padding: '0.35rem 0.6rem',
                                            borderRadius: '6px',
                                            cursor: teamIdx === rosterData.length - 1 ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        ▼
                                    </button>

                                    {/* Add Group inside Team */}
                                    <button
                                        type="button"
                                        onClick={() => handleOpenAddGroup(team.id)}
                                        style={{
                                            background: 'rgba(234, 179, 8, 0.2)',
                                            border: '1px solid rgba(234, 179, 8, 0.4)',
                                            color: '#fef08a',
                                            padding: '0.4rem 0.9rem',
                                            borderRadius: '8px',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem'
                                        }}
                                    >
                                        <span>➕</span>
                                        <span>Añadir Grupo</span>
                                    </button>

                                    {/* Edit Team */}
                                    <button
                                        type="button"
                                        onClick={() => handleOpenEditTeam(team)}
                                        title="Editar Equipo"
                                        style={{
                                            background: 'rgba(255,255,255,0.08)',
                                            border: '1px solid rgba(255,255,255,0.15)',
                                            color: '#cbd5e1',
                                            padding: '0.4rem 0.75rem',
                                            borderRadius: '8px',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ✏️
                                    </button>

                                    {/* Delete Team */}
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteTeam(team.id)}
                                        title="Eliminar Equipo"
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            color: '#f87171',
                                            padding: '0.4rem 0.75rem',
                                            borderRadius: '8px',
                                            fontSize: '0.8rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>

                            {/* Groups in this Team */}
                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {(!team.groups || team.groups.length === 0) ? (
                                    <div style={{
                                        padding: '1.5rem',
                                        textAlign: 'center',
                                        color: '#94a3b8',
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        borderRadius: '12px',
                                        border: '1px dashed rgba(255, 255, 255, 0.1)'
                                    }}>
                                        Este equipo no tiene grupos aún.
                                        <button
                                            onClick={() => handleOpenAddGroup(team.id)}
                                            style={{
                                                marginLeft: '0.8rem',
                                                background: 'transparent',
                                                color: '#fef08a',
                                                border: '1px solid #fef08a',
                                                padding: '0.3rem 0.7rem',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem',
                                                fontWeight: 700
                                            }}
                                        >
                                            + Añadir Primer Grupo
                                        </button>
                                    </div>
                                ) : (
                                    team.groups.map((group, groupIdx) => (
                                        <div
                                            key={group.id || groupIdx}
                                            style={{
                                                background: 'rgba(15, 23, 42, 0.6)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '14px',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            {/* Group Header */}
                                            <div style={{
                                                background: 'rgba(255, 255, 255, 0.04)',
                                                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                                padding: '0.75rem 1.25rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                flexWrap: 'wrap',
                                                gap: '0.75rem'
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                                    {group.icon && <span style={{ fontSize: '1.1rem' }}>{group.icon}</span>}
                                                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#ffffff', letterSpacing: '0.04em' }}>
                                                        {group.name.toUpperCase()}
                                                    </span>
                                                    <span style={{
                                                        background: 'rgba(255, 255, 255, 0.1)',
                                                        color: '#94a3b8',
                                                        padding: '0.1rem 0.5rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700
                                                    }}>
                                                        {group.members?.length || 0}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                    {/* Move Group */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveGroup(team.id, groupIdx, -1)}
                                                        disabled={groupIdx === 0}
                                                        title="Mover arriba"
                                                        style={{
                                                            background: 'rgba(255,255,255,0.05)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            color: groupIdx === 0 ? '#475569' : '#cbd5e1',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: '5px',
                                                            fontSize: '0.75rem',
                                                            cursor: groupIdx === 0 ? 'not-allowed' : 'pointer'
                                                        }}
                                                    >
                                                        ▲
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveGroup(team.id, groupIdx, 1)}
                                                        disabled={groupIdx === team.groups.length - 1}
                                                        title="Mover abajo"
                                                        style={{
                                                            background: 'rgba(255,255,255,0.05)',
                                                            border: '1px solid rgba(255,255,255,0.1)',
                                                            color: groupIdx === team.groups.length - 1 ? '#475569' : '#cbd5e1',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: '5px',
                                                            fontSize: '0.75rem',
                                                            cursor: groupIdx === team.groups.length - 1 ? 'not-allowed' : 'pointer'
                                                        }}
                                                    >
                                                        ▼
                                                    </button>

                                                    {/* Edit Group */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditGroup(team.id, group)}
                                                        title="Editar Grupo"
                                                        style={{
                                                            background: 'rgba(255,255,255,0.06)',
                                                            border: '1px solid rgba(255,255,255,0.12)',
                                                            color: '#cbd5e1',
                                                            padding: '0.25rem 0.6rem',
                                                            borderRadius: '6px',
                                                            fontSize: '0.75rem',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        ✏️
                                                    </button>

                                                    {/* Delete Group */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteGroup(team.id, group.id)}
                                                        title="Eliminar Grupo"
                                                        style={{
                                                            background: 'rgba(239, 68, 68, 0.1)',
                                                            border: '1px solid rgba(239, 68, 68, 0.25)',
                                                            color: '#f87171',
                                                            padding: '0.25rem 0.6rem',
                                                            borderRadius: '6px',
                                                            fontSize: '0.75rem',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Members in this Group */}
                                            <div style={{ padding: '1rem' }}>
                                                {/* Member Cards / Table */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                                    {(!group.members || group.members.length === 0) ? (
                                                        <div style={{ color: '#64748b', fontSize: '0.82rem', fontStyle: 'italic', padding: '0.5rem 0.75rem' }}>
                                                            No hay agentes asignados a este grupo. Rellena los campos abajo para añadir.
                                                        </div>
                                                    ) : (
                                                        group.members.map((member, mIdx) => (
                                                            <div
                                                                key={member.id || mIdx}
                                                                style={{
                                                                    background: 'rgba(0, 0, 0, 0.25)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                    borderRadius: '8px',
                                                                    padding: '0.55rem 0.9rem',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'space-between',
                                                                    flexWrap: 'wrap',
                                                                    gap: '0.75rem',
                                                                    transition: 'background 0.2s'
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                                    {/* Callsign Badge */}
                                                                    {member.callsign ? (
                                                                        <span style={{
                                                                            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(202, 138, 4, 0.15))',
                                                                            color: '#fef08a',
                                                                            border: '1px solid rgba(234, 179, 8, 0.45)',
                                                                            padding: '0.2rem 0.65rem',
                                                                            borderRadius: '6px',
                                                                            fontSize: '0.8rem',
                                                                            fontWeight: 800,
                                                                            letterSpacing: '0.04em'
                                                                        }}>
                                                                            {member.callsign}
                                                                        </span>
                                                                    ) : (
                                                                        <span style={{ color: '#64748b', fontSize: '0.8rem' }}>[Sin Callsign]</span>
                                                                    )}

                                                                    {/* Agent Name / Tag */}
                                                                    <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '0.88rem' }}>
                                                                        {member.name || 'Agente'}
                                                                    </span>

                                                                    {/* Discord Tag */}
                                                                    {member.discordId && (
                                                                        <span style={{
                                                                            background: 'rgba(88, 101, 242, 0.18)',
                                                                            color: '#a5b4fc',
                                                                            border: '1px solid rgba(88, 101, 242, 0.35)',
                                                                            padding: '0.15rem 0.5rem',
                                                                            borderRadius: '6px',
                                                                            fontSize: '0.75rem'
                                                                        }}>
                                                                            @{member.discordId.replace(/^[<@!&>]+|[>]+$/g, '')}
                                                                        </span>
                                                                    )}

                                                                    {/* Badge / Placa */}
                                                                    {member.badge && (
                                                                        <span style={{
                                                                            background: 'rgba(255, 255, 255, 0.08)',
                                                                            color: '#cbd5e1',
                                                                            padding: '0.15rem 0.5rem',
                                                                            borderRadius: '6px',
                                                                            fontSize: '0.75rem',
                                                                            fontWeight: 600
                                                                        }}>
                                                                            | {member.badge}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Member Actions */}
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleMoveMember(team.id, group.id, mIdx, -1)}
                                                                        disabled={mIdx === 0}
                                                                        title="Subir agente"
                                                                        style={{
                                                                            background: 'transparent',
                                                                            border: 'none',
                                                                            color: mIdx === 0 ? '#475569' : '#94a3b8',
                                                                            cursor: mIdx === 0 ? 'not-allowed' : 'pointer',
                                                                            fontSize: '0.8rem',
                                                                            padding: '0.2rem 0.4rem'
                                                                        }}
                                                                    >
                                                                        ▲
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleMoveMember(team.id, group.id, mIdx, 1)}
                                                                        disabled={mIdx === group.members.length - 1}
                                                                        title="Bajar agente"
                                                                        style={{
                                                                            background: 'transparent',
                                                                            border: 'none',
                                                                            color: mIdx === group.members.length - 1 ? '#475569' : '#94a3b8',
                                                                            cursor: mIdx === group.members.length - 1 ? 'not-allowed' : 'pointer',
                                                                            fontSize: '0.8rem',
                                                                            padding: '0.2rem 0.4rem'
                                                                        }}
                                                                    >
                                                                        ▼
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenEditMember(team.id, group.id, mIdx, member)}
                                                                        title="Editar agente"
                                                                        style={{
                                                                            background: 'transparent',
                                                                            border: 'none',
                                                                            color: '#93c5fd',
                                                                            cursor: 'pointer',
                                                                            fontSize: '0.8rem',
                                                                            padding: '0.2rem 0.4rem'
                                                                        }}
                                                                    >
                                                                        ✏️
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteMember(team.id, group.id, mIdx)}
                                                                        title="Eliminar agente"
                                                                        style={{
                                                                            background: 'transparent',
                                                                            border: 'none',
                                                                            color: '#f87171',
                                                                            cursor: 'pointer',
                                                                            fontSize: '0.8rem',
                                                                            padding: '0.2rem 0.4rem'
                                                                        }}
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>

                                                {/* Quick Add Member Row for this Group */}
                                                <div style={{
                                                    background: 'rgba(0, 0, 0, 0.4)',
                                                    border: '1px solid rgba(234, 179, 8, 0.2)',
                                                    borderRadius: '10px',
                                                    padding: '0.75rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.6rem',
                                                    flexWrap: 'wrap'
                                                }}>
                                                    {/* Callsign Input */}
                                                    <div style={{ flex: '1 1 140px' }}>
                                                        <input
                                                            type="text"
                                                            placeholder="Indicativo (Ej: SIERRA-20)"
                                                            value={memberInputs[group.id]?.callsign || ''}
                                                            onChange={e => handleMemberInputChange(group.id, 'callsign', e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && handleQuickAddMember(team.id, group.id)}
                                                            style={{
                                                                width: '100%',
                                                                background: 'rgba(15, 23, 42, 0.8)',
                                                                border: '1px solid rgba(234, 179, 8, 0.35)',
                                                                borderRadius: '8px',
                                                                padding: '0.45rem 0.75rem',
                                                                color: '#fef08a',
                                                                fontWeight: 700,
                                                                fontSize: '0.82rem'
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Name Input */}
                                                    <div style={{ flex: '2 1 180px' }}>
                                                        <input
                                                            type="text"
                                                            placeholder="Nombre (Ej: Ryan Daniels)"
                                                            value={memberInputs[group.id]?.name || ''}
                                                            onChange={e => handleMemberInputChange(group.id, 'name', e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && handleQuickAddMember(team.id, group.id)}
                                                            style={{
                                                                width: '100%',
                                                                background: 'rgba(15, 23, 42, 0.8)',
                                                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                                                borderRadius: '8px',
                                                                padding: '0.45rem 0.75rem',
                                                                color: '#ffffff',
                                                                fontSize: '0.82rem'
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Discord Mention / ID */}
                                                    <div style={{ flex: '1.5 1 150px' }}>
                                                        <input
                                                            type="text"
                                                            placeholder="ID Discord / @tag"
                                                            value={memberInputs[group.id]?.discordId || ''}
                                                            onChange={e => handleMemberInputChange(group.id, 'discordId', e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && handleQuickAddMember(team.id, group.id)}
                                                            style={{
                                                                width: '100%',
                                                                background: 'rgba(15, 23, 42, 0.8)',
                                                                border: '1px solid rgba(88, 101, 242, 0.35)',
                                                                borderRadius: '8px',
                                                                padding: '0.45rem 0.75rem',
                                                                color: '#a5b4fc',
                                                                fontSize: '0.82rem'
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Badge / Detalle */}
                                                    <div style={{ flex: '1 1 110px' }}>
                                                        <input
                                                            type="text"
                                                            placeholder="Placa (Ej: 715)"
                                                            value={memberInputs[group.id]?.badge || ''}
                                                            onChange={e => handleMemberInputChange(group.id, 'badge', e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && handleQuickAddMember(team.id, group.id)}
                                                            style={{
                                                                width: '100%',
                                                                background: 'rgba(15, 23, 42, 0.8)',
                                                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                                                borderRadius: '8px',
                                                                padding: '0.45rem 0.75rem',
                                                                color: '#ffffff',
                                                                fontSize: '0.82rem'
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Add Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleQuickAddMember(team.id, group.id)}
                                                        style={{
                                                            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.3), rgba(202, 138, 4, 0.2))',
                                                            border: '1px solid rgba(234, 179, 8, 0.45)',
                                                            color: '#fef08a',
                                                            padding: '0.45rem 1rem',
                                                            borderRadius: '8px',
                                                            fontWeight: 700,
                                                            fontSize: '0.82rem',
                                                            cursor: 'pointer',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        + Añadir
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL: CONFIGURACIÓN WEBHOOK DE DISCORD                                    */}
            {/* ========================================================================= */}
            {showSettingsModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{
                        background: '#0f172a',
                        border: '1px solid rgba(234, 179, 8, 0.35)',
                        borderRadius: '18px',
                        padding: '2rem',
                        maxWidth: '560px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '1.5rem' }}>⚙️</span>
                                <h3 style={{ margin: 0, color: '#fef08a', fontSize: '1.25rem', fontWeight: 800 }}>
                                    Configuración del Webhook SEB
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowSettingsModal(false)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    URL del Webhook de Discord *
                                </label>
                                <input
                                    type="text"
                                    placeholder="https://discord.com/api/webhooks/..."
                                    value={webhookUrl}
                                    onChange={e => setWebhookUrl(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.5)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.9rem',
                                        color: '#ffffff',
                                        fontSize: '0.85rem'
                                    }}
                                />
                                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                                    Crea un Webhook en el canal de Discord deseado (Ajustes de Canal &gt; Integraciones &gt; Webhooks).
                                </span>
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Título Principal del Mensaje / Embed
                                </label>
                                <input
                                    type="text"
                                    placeholder="Miembros e indicativos."
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.5)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.9rem',
                                        color: '#ffffff',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Mención / Ping de Rol (Opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="@SEB o ID de Rol de Discord"
                                    value={rolePing}
                                    onChange={e => setRolePing(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.5)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.9rem',
                                        color: '#ffffff',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                        Nombre del Bot
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="SEB • Special Enforcement Bureau"
                                        value={botName}
                                        onChange={e => setBotName(e.target.value)}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(0, 0, 0, 0.5)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '10px',
                                            padding: '0.65rem 0.9rem',
                                            color: '#ffffff',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                        Avatar del Bot
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="URL de imagen o logo"
                                        value={botAvatar}
                                        onChange={e => setBotAvatar(e.target.value)}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(0, 0, 0, 0.5)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '10px',
                                            padding: '0.65rem 0.9rem',
                                            color: '#ffffff',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Banner / Imagen de Encabezado (Opcional)
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        placeholder="URL de imagen HTTPS"
                                        value={bannerUrl}
                                        onChange={e => setBannerUrl(e.target.value)}
                                        style={{
                                            flex: 1,
                                            background: 'rgba(0, 0, 0, 0.5)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '10px',
                                            padding: '0.65rem 0.9rem',
                                            color: '#ffffff',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                    <label style={{
                                        background: 'rgba(234, 179, 8, 0.2)',
                                        border: '1px solid rgba(234, 179, 8, 0.4)',
                                        color: '#fef08a',
                                        padding: '0.65rem 1rem',
                                        borderRadius: '10px',
                                        cursor: uploadingBanner ? 'not-allowed' : 'pointer',
                                        fontWeight: 700,
                                        fontSize: '0.82rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem'
                                    }}>
                                        <span>📁</span>
                                        <span>{uploadingBanner ? '...' : 'Subir'}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => e.target.files?.[0] && handleBannerUpload(e.target.files[0])}
                                            style={{ display: 'none' }}
                                        />
                                    </label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem' }}>
                                <input
                                    type="checkbox"
                                    id="webhook-seb-enabled"
                                    checked={enabled}
                                    onChange={e => setEnabled(e.target.checked)}
                                    style={{ width: '18px', height: '18px', accentColor: '#eab308' }}
                                />
                                <label htmlFor="webhook-seb-enabled" style={{ color: '#e2e8f0', fontSize: '0.88rem', fontWeight: 600 }}>
                                    Habilitar sincronización con Discord
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowSettingsModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    padding: '0.65rem 1.25rem',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                Cerrar
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    await handleSaveRoster();
                                    setShowSettingsModal(false);
                                }}
                                style={{
                                    background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                                    color: '#0f172a',
                                    border: 'none',
                                    padding: '0.65rem 1.4rem',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    fontWeight: 800
                                }}
                            >
                                Guardar Configuración
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL: AÑADIR / EDITAR EQUIPO                                            */}
            {/* ========================================================================= */}
            {showTeamModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{
                        background: '#0f172a',
                        border: '1px solid rgba(234, 179, 8, 0.35)',
                        borderRadius: '18px',
                        padding: '1.75rem',
                        maxWidth: '460px',
                        width: '100%',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
                    }}>
                        <h3 style={{ margin: '0 0 1.25rem 0', color: '#fef08a', fontSize: '1.2rem', fontWeight: 800 }}>
                            {editingTeam ? 'Editar Equipo' : 'Añadir Nuevo Equipo'}
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Nombre del Equipo *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: Equipo S.E.B. o Equipo T.R.T."
                                    value={teamForm.teamName}
                                    onChange={e => setTeamForm(prev => ({ ...prev, teamName: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.5)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.9rem',
                                        color: '#ffffff',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Icono / Emoji del Equipo
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        placeholder="Ej: 🦇 o 🦅"
                                        value={teamForm.teamIcon}
                                        onChange={e => setTeamForm(prev => ({ ...prev, teamIcon: e.target.value }))}
                                        style={{
                                            width: '80px',
                                            background: 'rgba(0, 0, 0, 0.5)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '10px',
                                            padding: '0.65rem 0.9rem',
                                            color: '#ffffff',
                                            fontSize: '1.1rem',
                                            textAlign: 'center'
                                        }}
                                    />
                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                        {['🦇', '🦅', '🛡️', '⚡', '🎯', '🐺'].map(em => (
                                            <button
                                                key={em}
                                                type="button"
                                                onClick={() => setTeamForm(prev => ({ ...prev, teamIcon: em }))}
                                                style={{
                                                    background: teamForm.teamIcon === em ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255,255,255,0.06)',
                                                    border: `1px solid ${teamForm.teamIcon === em ? '#eab308' : 'rgba(255,255,255,0.1)'}`,
                                                    borderRadius: '8px',
                                                    padding: '0.4rem 0.6rem',
                                                    fontSize: '1rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {em}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowTeamModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    padding: '0.6rem 1.2rem',
                                    borderRadius: '10px',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveTeam}
                                style={{
                                    background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                                    color: '#0f172a',
                                    border: 'none',
                                    padding: '0.6rem 1.3rem',
                                    borderRadius: '10px',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                Guardar Equipo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL: AÑADIR / EDITAR GRUPO                                             */}
            {/* ========================================================================= */}
            {showGroupModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{
                        background: '#0f172a',
                        border: '1px solid rgba(234, 179, 8, 0.35)',
                        borderRadius: '18px',
                        padding: '1.75rem',
                        maxWidth: '460px',
                        width: '100%',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
                    }}>
                        <h3 style={{ margin: '0 0 1.25rem 0', color: '#fef08a', fontSize: '1.2rem', fontWeight: 800 }}>
                            {editingGroup ? 'Editar Grupo' : 'Añadir Nuevo Grupo'}
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Nombre del Grupo *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: GRUPO SIERRA - 20 o GRUPO ROGER - 10"
                                    value={groupForm.name}
                                    onChange={e => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.5)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.9rem',
                                        color: '#ffffff',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Icono del Grupo (Opcional)
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        placeholder="Ej: 🦇 o 🦅"
                                        value={groupForm.icon}
                                        onChange={e => setGroupForm(prev => ({ ...prev, icon: e.target.value }))}
                                        style={{
                                            width: '80px',
                                            background: 'rgba(0, 0, 0, 0.5)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '10px',
                                            padding: '0.65rem 0.9rem',
                                            color: '#ffffff',
                                            fontSize: '1.1rem',
                                            textAlign: 'center'
                                        }}
                                    />
                                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                                        {['🦇', '🦅', '⭐', '⚡', '🎯', '📍'].map(em => (
                                            <button
                                                key={em}
                                                type="button"
                                                onClick={() => setGroupForm(prev => ({ ...prev, icon: em }))}
                                                style={{
                                                    background: groupForm.icon === em ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255,255,255,0.06)',
                                                    border: `1px solid ${groupForm.icon === em ? '#eab308' : 'rgba(255,255,255,0.1)'}`,
                                                    borderRadius: '8px',
                                                    padding: '0.4rem 0.6rem',
                                                    fontSize: '1rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {em}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowGroupModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    padding: '0.6rem 1.2rem',
                                    borderRadius: '10px',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveGroup}
                                style={{
                                    background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                                    color: '#0f172a',
                                    border: 'none',
                                    padding: '0.6rem 1.3rem',
                                    borderRadius: '10px',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                Guardar Grupo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL: EDITAR INTEGRANTE / AGENTE                                        */}
            {/* ========================================================================= */}
            {showEditMemberModal && editingMemberInfo && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{
                        background: '#0f172a',
                        border: '1px solid rgba(234, 179, 8, 0.35)',
                        borderRadius: '18px',
                        padding: '1.75rem',
                        maxWidth: '480px',
                        width: '100%',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
                    }}>
                        <h3 style={{ margin: '0 0 1.25rem 0', color: '#fef08a', fontSize: '1.2rem', fontWeight: 800 }}>
                            Editar Integrante SEB
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Indicativo / Callsign (Ej: SIERRA-20, ROGER-10)
                                </label>
                                <input
                                    type="text"
                                    value={editingMemberInfo.callsign}
                                    onChange={e => setEditingMemberInfo(prev => ({ ...prev, callsign: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.5)',
                                        border: '1px solid rgba(234, 179, 8, 0.4)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.9rem',
                                        color: '#fef08a',
                                        fontWeight: 700,
                                        fontSize: '0.88rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Nombre del Agente
                                </label>
                                <input
                                    type="text"
                                    value={editingMemberInfo.name}
                                    onChange={e => setEditingMemberInfo(prev => ({ ...prev, name: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.5)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.9rem',
                                        color: '#ffffff',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Mención de Discord / ID Snowflake
                                </label>
                                <input
                                    type="text"
                                    placeholder="1306619156052967471 o @nombre"
                                    value={editingMemberInfo.discordId}
                                    onChange={e => setEditingMemberInfo(prev => ({ ...prev, discordId: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.5)',
                                        border: '1px solid rgba(88, 101, 242, 0.4)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.9rem',
                                        color: '#a5b4fc',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Número de Placa / Información Extra
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: 715 o 713 | Mr.Kai_tv"
                                    value={editingMemberInfo.badge}
                                    onChange={e => setEditingMemberInfo(prev => ({ ...prev, badge: e.target.value }))}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(0, 0, 0, 0.5)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.9rem',
                                        color: '#ffffff',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.75rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowEditMemberModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    padding: '0.6rem 1.2rem',
                                    borderRadius: '10px',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveEditMember}
                                style={{
                                    background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                                    color: '#0f172a',
                                    border: 'none',
                                    padding: '0.6rem 1.3rem',
                                    borderRadius: '10px',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL: VISTA PREVIA SIMULADA DE DISCORD                                    */}
            {/* ========================================================================= */}
            {showPreviewModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.85)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1.5rem',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{
                        background: '#313338', // Exact Discord Theme Color
                        border: '1px solid #1e1f22',
                        borderRadius: '16px',
                        padding: '1.75rem',
                        maxWidth: '650px',
                        width: '100%',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
                        fontFamily: "'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif"
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #3f4147', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{ fontSize: '1.3rem' }}>👁️</span>
                                <h4 style={{ margin: 0, color: '#f2f3f5', fontSize: '1.05rem', fontWeight: 700 }}>
                                    Simulación del Mensaje en Discord
                                </h4>
                            </div>
                            <button
                                onClick={() => setShowPreviewModal(false)}
                                style={{ background: 'transparent', border: 'none', color: '#b5bac1', fontSize: '1.25rem', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Discord Message Container */}
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {/* Bot Avatar */}
                            <img
                                src={normalizeDiscordImageUrl(botAvatar, SCUB_LOGO_URL)}
                                alt="Bot Avatar"
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    flexShrink: 0
                                }}
                            />

                            <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Bot Username & Tag */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                    <span style={{ color: '#f2f3f5', fontWeight: 600, fontSize: '0.95rem' }}>
                                        {botName || 'SEB • Special Enforcement Bureau'}
                                    </span>
                                    <span style={{
                                        background: '#5865f2',
                                        color: '#ffffff',
                                        fontSize: '0.62rem',
                                        fontWeight: 700,
                                        borderRadius: '4px',
                                        padding: '1px 4px',
                                        textTransform: 'uppercase'
                                    }}>
                                        APP
                                    </span>
                                    <span style={{ color: '#949ba4', fontSize: '0.75rem' }}>
                                        Hoy a las {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                {rolePing && (
                                    <div style={{ color: '#c9cdfb', background: 'rgba(88, 101, 242, 0.15)', padding: '0 4px', borderRadius: '3px', display: 'inline-block', fontSize: '0.88rem', marginBottom: '0.5rem' }}>
                                        {rolePing.startsWith('@') ? rolePing : `@${rolePing}`}
                                    </div>
                                )}

                                {/* Discord Embed */}
                                <div style={{
                                    background: '#2b2d31',
                                    borderLeft: '4px solid #eab308',
                                    borderRadius: '4px',
                                    padding: '0.85rem 1rem',
                                    marginTop: '0.25rem'
                                }}>
                                    {/* Embed Title */}
                                    <div style={{ color: '#f2f3f5', fontWeight: 700, fontSize: '1rem', marginBottom: '0.65rem' }}>
                                        🦇 {title || 'Miembros e indicativos.'}
                                    </div>

                                    {/* Embed Description formatted */}
                                    <div style={{ color: '#dbdee1', fontSize: '0.88rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                        {buildSEBRosterDiscordMarkdown(rosterData)}
                                    </div>

                                    {/* Banner Preview if any */}
                                    {bannerUrl && (
                                        <div style={{ marginTop: '0.75rem' }}>
                                            <img
                                                src={normalizeDiscordImageUrl(bannerUrl)}
                                                alt="Banner"
                                                style={{ maxWidth: '100%', borderRadius: '4px', maxHeight: '200px', objectFit: 'cover' }}
                                            />
                                        </div>
                                    )}

                                    {/* Embed Footer */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.85rem', paddingTop: '0.5rem', borderTop: '1px solid #35373c' }}>
                                        <img
                                            src={normalizeDiscordImageUrl(botAvatar, SCUB_LOGO_URL)}
                                            alt="Footer Icon"
                                            style={{ width: '18px', height: '18px', borderRadius: '50%' }}
                                        />
                                        <span style={{ color: '#949ba4', fontSize: '0.75rem' }}>
                                            Special Enforcement Bureau • Tactical Callboard
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowPreviewModal(false)}
                                style={{
                                    background: '#5865f2',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '0.6rem 1.3rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 700
                                }}
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
