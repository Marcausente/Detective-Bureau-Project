import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { uploadImageToStorage } from '../utils/imageStorage';
import {
    SCUB_LOGO_URL,
    DEFAULT_COORDINATION_ROSTER_DATA,
    getCoordinationRosterConfig,
    saveCoordinationRosterConfig,
    sendCoordinationRosterToDiscord,
    formatMemberMention
} from '../utils/discordWebhook';
import '../index.css';

export default function CoordinationRosterDiscord() {
    const { t } = useLanguage();
    const { isLSSD } = useTheme();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);

    // Roster Config State
    const [rosterData, setRosterData] = useState(DEFAULT_COORDINATION_ROSTER_DATA);
    const [title, setTitle] = useState('SHERIFF CRIMINAL UNIT BUREAU');
    const [bannerUrl, setBannerUrl] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [rolePing, setRolePing] = useState('');
    const [botName, setBotName] = useState('SCUB • Sheriff Criminal Unit Bureau');
    const [botAvatar, setBotAvatar] = useState(SCUB_LOGO_URL);
    const [enabled, setEnabled] = useState(true);

    // UI State
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [newRankName, setNewRankName] = useState('');
    const [newRankIcon, setNewRankIcon] = useState('📌');
    const [showAddRankModal, setShowAddRankModal] = useState(false);
    
    // Edit Rank Modal State
    const [editingRank, setEditingRank] = useState(null); // { id, name, icon }
    const [showEditRankModal, setShowEditRankModal] = useState(false);

    // Edit Member Modal State
    const [editingMember, setEditingMember] = useState(null); // { rankId, memberIdx, name, discordId }
    const [showEditMemberModal, setShowEditMemberModal] = useState(false);

    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Temporary inputs per rank for adding member: { [rankId]: { name: '', discordId: '' } }
    const [memberInputs, setMemberInputs] = useState({});

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
            // Load latest saved roster from Supabase
            const config = await getCoordinationRosterConfig();
            setRosterData(config.rosterData || DEFAULT_COORDINATION_ROSTER_DATA);
            setTitle(config.title || 'SHERIFF CRIMINAL UNIT BUREAU');
            setBannerUrl(config.bannerUrl || '');
            setWebhookUrl(config.webhookUrl || '');
            setRolePing(config.rolePing || '');
            setBotName(config.botName || 'SCUB • Sheriff Criminal Unit Bureau');
            setBotAvatar(config.botAvatar || SCUB_LOGO_URL);
            setEnabled(config.enabled !== undefined ? config.enabled : true);
        } catch (err) {
            console.error('Error loading coordination roster:', err);
            showError('Error al cargar la plantilla: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Save Roster to Supabase
    const handleSaveRoster = async () => {
        try {
            setSubmitting(true);
            const res = await saveCoordinationRosterConfig({
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
                showSuccess('✅ Plantilla y miembros guardados correctamente en la base de datos.');
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
            showError('Configura primero una URL de Webhook válida para publicar en Discord.');
            return;
        }

        try {
            setPublishing(true);

            // Auto-save first
            await saveCoordinationRosterConfig({
                rosterData,
                webhookUrl,
                title,
                bannerUrl,
                rolePing,
                botName,
                botAvatar,
                enabled
            });

            const res = await sendCoordinationRosterToDiscord({
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
                showSuccess('🚀 ¡Plantilla de Coordinación enviada exitosamente a Discord!');
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
            const url = await uploadImageToStorage(file, 'coordination');
            setBannerUrl(url);
            showSuccess('Banner subido con éxito.');
        } catch (err) {
            showError('Error al subir banner: ' + err.message);
        } finally {
            setUploadingBanner(false);
        }
    };

    // Upload Bot Avatar Image
    const handleAvatarUpload = async (file) => {
        if (!file) return;
        try {
            setUploadingAvatar(true);
            const url = await uploadImageToStorage(file, 'coordination');
            setBotAvatar(url);
            showSuccess('Avatar del bot subido con éxito.');
        } catch (err) {
            showError('Error al subir avatar del bot: ' + err.message);
        } finally {
            setUploadingAvatar(false);
        }
    };

    // Add Member to a Rank
    const handleAddMember = (rankId) => {
        const current = memberInputs[rankId] || {};
        const name = (current.name || '').trim();
        const discordId = (current.discordId || '').trim();

        if (!name && !discordId) {
            showError('Escribe el nombre del agente o su ID de Discord para añadirlo.');
            return;
        }

        const newMember = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: name,
            discordId: discordId
        };

        const updated = rosterData.map(r => {
            if (r.id === rankId) {
                const members = r.members || [];
                return {
                    ...r,
                    members: [...members, newMember]
                };
            }
            return r;
        });

        setRosterData(updated);
        setMemberInputs(prev => ({
            ...prev,
            [rankId]: { name: '', discordId: '' }
        }));
    };

    // Open Edit Member Modal
    const handleOpenEditMember = (rankId, memberIdx, member) => {
        const name = member.name || (member.discordId && !/^\d{15,22}$/.test(member.discordId) ? member.discordId.replace(/^[<@!&>]+/, '') : '');
        const discordId = member.discordId && /^\d{15,22}$/.test(member.discordId) ? member.discordId : (member.discordId || '');

        setEditingMember({
            rankId,
            memberIdx,
            name: name,
            discordId: discordId
        });
        setShowEditMemberModal(true);
    };

    // Save Edited Member
    const handleSaveEditedMember = (e) => {
        e.preventDefault();
        if (!editingMember) return;

        const { rankId, memberIdx, name, discordId } = editingMember;
        const cleanName = (name || '').trim();
        const cleanDiscordId = (discordId || '').trim();

        if (!cleanName && !cleanDiscordId) {
            showError('El agente debe tener al menos un nombre o ID de Discord.');
            return;
        }

        const updated = rosterData.map(r => {
            if (r.id === rankId) {
                const members = [...(r.members || [])];
                if (members[memberIdx]) {
                    members[memberIdx] = {
                        ...members[memberIdx],
                        name: cleanName,
                        discordId: cleanDiscordId
                    };
                }
                return { ...r, members };
            }
            return r;
        });

        setRosterData(updated);
        setShowEditMemberModal(false);
        setEditingMember(null);
        showSuccess('Agente actualizado correctamente.');
    };

    // Remove Member
    const handleRemoveMember = (rankId, memberIdx) => {
        const updated = rosterData.map(r => {
            if (r.id === rankId) {
                const members = [...(r.members || [])];
                members.splice(memberIdx, 1);
                return { ...r, members };
            }
            return r;
        });
        setRosterData(updated);
    };

    // Move Member Up/Down
    const handleMoveMember = (rankId, memberIdx, direction) => {
        const updated = rosterData.map(r => {
            if (r.id === rankId) {
                const members = [...(r.members || [])];
                const targetIdx = memberIdx + direction;
                if (targetIdx >= 0 && targetIdx < members.length) {
                    const temp = members[memberIdx];
                    members[memberIdx] = members[targetIdx];
                    members[targetIdx] = temp;
                }
                return { ...r, members };
            }
            return r;
        });
        setRosterData(updated);
    };

    // Move Rank Up/Down
    const handleMoveRank = (rankIdx, direction) => {
        const targetIdx = rankIdx + direction;
        if (targetIdx >= 0 && targetIdx < rosterData.length) {
            const updated = [...rosterData];
            const temp = updated[rankIdx];
            updated[rankIdx] = updated[targetIdx];
            updated[targetIdx] = temp;
            setRosterData(updated);
        }
    };

    // Add New Rank
    const handleAddNewRank = (e) => {
        e.preventDefault();
        if (!newRankName.trim()) return;

        const newRank = {
            id: `rank_${Date.now()}`,
            name: newRankName.trim().toUpperCase(),
            icon: newRankIcon.trim() || '📌',
            members: []
        };

        setRosterData([...rosterData, newRank]);
        setNewRankName('');
        setNewRankIcon('📌');
        setShowAddRankModal(false);
        showSuccess(`Rango "${newRank.name}" añadido.`);
    };

    // Open Edit Rank Modal
    const handleOpenEditRank = (rank) => {
        setEditingRank({
            id: rank.id,
            name: rank.name,
            icon: rank.icon || '📌'
        });
        setShowEditRankModal(true);
    };

    // Save Edited Rank
    const handleSaveEditedRank = (e) => {
        e.preventDefault();
        if (!editingRank || !editingRank.name.trim()) return;

        const updated = rosterData.map(r => {
            if (r.id === editingRank.id) {
                return {
                    ...r,
                    name: editingRank.name.trim().toUpperCase(),
                    icon: editingRank.icon.trim() || '📌'
                };
            }
            return r;
        });

        setRosterData(updated);
        setShowEditRankModal(false);
        showSuccess(`Rango actualizado a "${editingRank.name.trim().toUpperCase()}".`);
        setEditingRank(null);
    };

    // Delete Rank
    const handleDeleteRank = (rankId, rankName) => {
        if (!window.confirm(`¿Seguro que deseas eliminar el rango "${rankName}" de la plantilla?`)) return;
        setRosterData(rosterData.filter(r => r.id !== rankId));
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                <span style={{ fontSize: '1.8rem', display: 'block', marginBottom: '0.5rem' }}>⏳</span>
                <span>Cargando organigrama y plantilla de Coordinación...</span>
            </div>
        );
    }

    return (
        <div style={{ marginTop: '0.5rem' }}>
            {/* Notifications */}
            {feedback && (
                <div style={{
                    padding: '0.85rem 1.25rem',
                    marginBottom: '1.25rem',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#34d399',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span>✨</span>
                    <span>{feedback}</span>
                </div>
            )}
            {errorMsg && (
                <div style={{
                    padding: '0.85rem 1.25rem',
                    marginBottom: '1.25rem',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span>⚠️</span>
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Top Toolbar */}
            <div className="coordination-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.4rem' }}>👥</span>
                            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#ffffff', fontWeight: 800 }}>
                                Plantilla & Organigrama para Discord
                            </h2>
                        </div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                            Configura los rangos y miembros por ID de Discord. La última lista se guarda automáticamente para que esté siempre sincronizada.
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => setShowAddRankModal(true)}
                            style={{
                                padding: '0.6rem 1rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: '#e2e8f0',
                                fontWeight: '700',
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>➕</span>
                            <span>Añadir Rango</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowSettingsModal(true)}
                            style={{
                                padding: '0.6rem 1rem',
                                borderRadius: '8px',
                                border: '1px solid rgba(88, 101, 242, 0.4)',
                                background: 'rgba(88, 101, 242, 0.15)',
                                color: '#818cf8',
                                fontWeight: '700',
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>⚙️</span>
                            <span>Webhook & Banner</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleSaveRoster}
                            disabled={submitting}
                            style={{
                                padding: '0.6rem 1.2rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#f59e0b',
                                color: '#000000',
                                fontWeight: '800',
                                fontSize: '0.82rem',
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                            }}
                        >
                            <span>💾</span>
                            <span>{submitting ? 'Guardando...' : 'Guardar Cambios'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handlePublishDiscord}
                            disabled={publishing}
                            style={{
                                padding: '0.6rem 1.3rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'linear-gradient(135deg, #5865F2, #4752C4)',
                                color: '#ffffff',
                                fontWeight: '800',
                                fontSize: '0.85rem',
                                cursor: publishing ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 4px 14px rgba(88, 101, 242, 0.4)'
                            }}
                        >
                            <span>🚀</span>
                            <span>{publishing ? 'Enviando...' : 'Publicar en Discord'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Layout: Left = Editor, Right = Discord Live Preview */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(350px, 1.2fr) minmax(320px, 1fr)',
                gap: '1.5rem',
                alignItems: 'start'
            }}>
                {/* LEFT: Ranks & Members Editor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {rosterData.map((rank, rankIdx) => {
                        const rankMembers = rank.members || [];
                        const currentInput = memberInputs[rank.id] || '';

                        return (
                            <div
                                key={rank.id}
                                className="coordination-card"
                                style={{
                                    padding: '1.25rem',
                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                    borderRadius: '12px'
                                }}
                            >
                                {/* Rank Header */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '0.85rem',
                                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                    paddingBottom: '0.6rem',
                                    flexWrap: 'wrap',
                                    gap: '8px'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEditRank(rank)}
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.06)',
                                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                                borderRadius: '8px',
                                                padding: '4px 8px',
                                                fontSize: '1.25rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                            title="Cambiar emoji o editar rango"
                                        >
                                            {rank.icon || '📌'}
                                        </button>
                                        <input
                                            type="text"
                                            value={rank.name}
                                            title="Haz clic para editar el nombre del rango directamente"
                                            onChange={(e) => {
                                                const updated = [...rosterData];
                                                updated[rankIdx].name = e.target.value.toUpperCase();
                                                setRosterData(updated);
                                            }}
                                            style={{
                                                background: 'rgba(0, 0, 0, 0.25)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '6px',
                                                padding: '4px 10px',
                                                color: '#f1f5f9',
                                                fontWeight: '800',
                                                fontSize: '0.95rem',
                                                letterSpacing: '0.04em',
                                                outline: 'none',
                                                minWidth: '180px',
                                                flex: 1
                                            }}
                                        />
                                        <span style={{ fontSize: '0.72rem', background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8', padding: '3px 8px', borderRadius: '6px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                            {rankMembers.length} {rankMembers.length === 1 ? 'miembro' : 'miembros'}
                                        </span>
                                    </div>

                                    {/* Rank Actions: Edit Modal, Reorder & Delete */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEditRank(rank)}
                                            style={{
                                                background: 'rgba(59, 130, 246, 0.15)',
                                                border: '1px solid rgba(59, 130, 246, 0.3)',
                                                color: '#60a5fa',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                padding: '4px 8px',
                                                fontSize: '0.78rem',
                                                fontWeight: '600',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                            title="Editar nombre y emoji en ventana emergente"
                                        >
                                            <span>✏️</span>
                                            <span>Editar</span>
                                        </button>
                                        <button
                                            type="button"
                                            disabled={rankIdx === 0}
                                            onClick={() => handleMoveRank(rankIdx, -1)}
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '6px',
                                                color: rankIdx === 0 ? '#475569' : '#94a3b8',
                                                cursor: rankIdx === 0 ? 'default' : 'pointer',
                                                padding: '4px 8px',
                                                fontSize: '0.75rem'
                                            }}
                                            title="Subir rango"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            type="button"
                                            disabled={rankIdx === rosterData.length - 1}
                                            onClick={() => handleMoveRank(rankIdx, 1)}
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                                borderRadius: '6px',
                                                color: rankIdx === rosterData.length - 1 ? '#475569' : '#94a3b8',
                                                cursor: rankIdx === rosterData.length - 1 ? 'default' : 'pointer',
                                                padding: '4px 8px',
                                                fontSize: '0.75rem'
                                            }}
                                            title="Bajar rango"
                                        >
                                            ▼
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteRank(rank.id, rank.name)}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.12)',
                                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                                color: '#f87171',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                padding: '4px 8px',
                                                fontSize: '0.75rem'
                                            }}
                                            title="Eliminar rango"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>

                                {/* Members List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '0.85rem' }}>
                                    {rankMembers.length === 0 ? (
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', padding: '4px 0' }}>
                                            • N/A (Sin agentes asignados a este rango)
                                        </div>
                                    ) : (
                                        rankMembers.map((member, mIdx) => {
                                            const memberName = member.name || (member.discordId && !/^\d{15,22}$/.test(member.discordId) ? member.discordId.replace(/^[<@!&>]+/, '') : '');
                                            const memberDiscordId = member.discordId || '';

                                            return (
                                                <div
                                                    key={member.id || mIdx}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        padding: '6px 12px',
                                                        background: 'rgba(255, 255, 255, 0.03)',
                                                        borderRadius: '8px',
                                                        border: '1px solid rgba(255, 255, 255, 0.06)',
                                                        gap: '8px'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                                                        <span style={{ color: '#5865F2', fontWeight: 'bold' }}>•</span>
                                                        <span style={{
                                                            fontSize: '0.85rem',
                                                            color: '#e2e8f0',
                                                            fontWeight: 600,
                                                            background: 'rgba(88, 101, 242, 0.15)',
                                                            padding: '2px 8px',
                                                            borderRadius: '5px',
                                                            border: '1px solid rgba(88, 101, 242, 0.25)'
                                                        }}>
                                                            {memberName ? (memberName.startsWith('@') ? memberName : `@${memberName}`) : (memberDiscordId ? `<@${memberDiscordId}>` : 'N/A')}
                                                        </span>
                                                        {memberDiscordId && /^\d{15,22}$/.test(memberDiscordId) && (
                                                            <span style={{
                                                                fontSize: '0.72rem',
                                                                color: '#94a3b8',
                                                                fontFamily: 'monospace',
                                                                background: 'rgba(0, 0, 0, 0.3)',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px'
                                                            }}>
                                                                ID: {memberDiscordId}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEditMember(rank.id, mIdx, member)}
                                                            style={{
                                                                background: 'rgba(59, 130, 246, 0.12)',
                                                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                                                color: '#60a5fa',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.72rem',
                                                                padding: '3px 6px'
                                                            }}
                                                            title="Editar nombre o ID del agente"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={mIdx === 0}
                                                            onClick={() => handleMoveMember(rank.id, mIdx, -1)}
                                                            style={{
                                                                background: 'rgba(255, 255, 255, 0.05)',
                                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                borderRadius: '4px',
                                                                color: mIdx === 0 ? '#334155' : '#94a3b8',
                                                                cursor: mIdx === 0 ? 'default' : 'pointer',
                                                                fontSize: '0.7rem',
                                                                padding: '3px 6px'
                                                            }}
                                                            title="Subir agente"
                                                        >
                                                            ▲
                                                        </button>
                                                        <button
                                                            type="button"
                                                            disabled={mIdx === rankMembers.length - 1}
                                                            onClick={() => handleMoveMember(rank.id, mIdx, 1)}
                                                            style={{
                                                                background: 'rgba(255, 255, 255, 0.05)',
                                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                                borderRadius: '4px',
                                                                color: mIdx === rankMembers.length - 1 ? '#334155' : '#94a3b8',
                                                                cursor: mIdx === rankMembers.length - 1 ? 'default' : 'pointer',
                                                                fontSize: '0.7rem',
                                                                padding: '3px 6px'
                                                            }}
                                                            title="Bajar agente"
                                                        >
                                                            ▼
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveMember(rank.id, mIdx)}
                                                            style={{
                                                                background: 'rgba(239, 68, 68, 0.12)',
                                                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                                                color: '#f87171',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.72rem',
                                                                padding: '3px 6px',
                                                                marginLeft: '2px'
                                                            }}
                                                            title="Quitar agente de este rango"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Add Member Form */}
                                <div style={{
                                    display: 'flex',
                                    gap: '8px',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    padding: '8px 10px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Nombre del agente (Ej: M. Kleiner | 701 | Marcausente)..."
                                        value={memberInputs[rank.id]?.name || ''}
                                        onChange={(e) => setMemberInputs({
                                            ...memberInputs,
                                            [rank.id]: {
                                                ...(memberInputs[rank.id] || {}),
                                                name: e.target.value
                                            }
                                        })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddMember(rank.id);
                                            }
                                        }}
                                        style={{ flex: 2, minWidth: '170px', padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                                    />

                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="ID Discord (Opcional, ej: 1306619...)"
                                        value={memberInputs[rank.id]?.discordId || ''}
                                        onChange={(e) => setMemberInputs({
                                            ...memberInputs,
                                            [rank.id]: {
                                                ...(memberInputs[rank.id] || {}),
                                                discordId: e.target.value
                                            }
                                        })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddMember(rank.id);
                                            }
                                        }}
                                        style={{ flex: 1.2, minWidth: '140px', padding: '0.45rem 0.65rem', fontSize: '0.8rem' }}
                                    />

                                    <button
                                        type="button"
                                        className="mac-btn mac-btn-primary"
                                        onClick={() => handleAddMember(rank.id)}
                                        style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                                    >
                                        + Añadir Agente
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* RIGHT: Live Discord Preview Card */}
                <div>
                    <div className="coordination-card" style={{ padding: '1.25rem', position: 'sticky', top: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '1rem' }}>👁️</span>
                                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f1f5f9' }}>Vista Previa en Discord</h4>
                            </div>
                            <span style={{ fontSize: '0.7rem', background: '#5865F2', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>DISCORD PREVIEW</span>
                        </div>

                        {/* Discord Window Mockup */}
                        <div style={{
                            background: '#313338',
                            borderRadius: '8px',
                            padding: '1rem',
                            fontFamily: '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
                            color: '#dbdee1',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
                        }}>
                            {/* Bot Header */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                                <img
                                    src={botAvatar || SCUB_LOGO_URL}
                                    alt="Bot Avatar"
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                                    onError={(e) => { e.target.src = '/logowebp/SCUB.webp'; }}
                                />
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontWeight: '600', color: '#f2f3f5', fontSize: '0.95rem' }}>
                                            {botName || 'SCUB • Sheriff Criminal Unit Bureau'}
                                        </span>
                                        <span style={{ background: '#5865F2', color: '#ffffff', fontSize: '0.62rem', padding: '1px 4px', borderRadius: '3px', fontWeight: '600' }}>
                                            APP
                                        </span>
                                        <span style={{ fontSize: '0.72rem', color: '#949ba4' }}>
                                            Hoy a las {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    {rolePing && (
                                        <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#c9cdfb', background: 'rgba(88, 101, 242, 0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                            @{rolePing.replace(/[<@&>]/g, '')}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Embed Box with Gold Border */}
                            <div style={{
                                background: '#2b2d31',
                                borderLeft: '4px solid #C5A059',
                                borderRadius: '4px',
                                padding: '0.85rem 1rem',
                                marginLeft: '52px'
                            }}>
                                {/* Top Title */}
                                <div style={{
                                    fontWeight: '800',
                                    fontSize: '1rem',
                                    color: '#f2f3f5',
                                    marginBottom: '12px',
                                    letterSpacing: '0.02em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                    <span>🔍</span>
                                    <span>{title || 'SHERIFF CRIMINAL UNIT BUREAU'}</span>
                                </div>

                                {/* Ranks & Members List */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.88rem' }}>
                                    {rosterData.map((rank) => {
                                        const rankMembers = rank.members || [];
                                        return (
                                            <div key={rank.id}>
                                                <div style={{
                                                    fontWeight: '700',
                                                    color: '#f2f3f5',
                                                    marginBottom: '4px',
                                                    textDecoration: 'underline',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    <span>{rank.icon || '📌'}</span>
                                                    <span>{rank.name}</span>
                                                </div>

                                                <div style={{ paddingLeft: '14px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    {rankMembers.length === 0 ? (
                                                        <div style={{ color: '#949ba4', fontSize: '0.82rem' }}>• N/A</div>
                                                    ) : (
                                                        rankMembers.map((m, idx) => {
                                                            const displayName = m.name 
                                                                ? (m.name.startsWith('@') ? m.name : `@${m.name}`) 
                                                                : (m.discordId ? (m.discordId.startsWith('<@') ? m.discordId : `@${m.discordId.replace(/[<@!&>]/g, '')}`) : 'N/A');

                                                            return (
                                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span style={{ color: '#949ba4' }}>•</span>
                                                                    <span style={{
                                                                        color: '#c9cdfb',
                                                                        background: 'rgba(88, 101, 242, 0.18)',
                                                                        padding: '1px 5px',
                                                                        borderRadius: '3px',
                                                                        fontSize: '0.82rem'
                                                                    }}>
                                                                        {displayName}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Banner Image Preview at Bottom */}
                                {bannerUrl ? (
                                    <div style={{ marginTop: '16px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        <img
                                            src={bannerUrl}
                                            alt="Banner de Coordinación"
                                            style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '280px', objectFit: 'cover' }}
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                    </div>
                                ) : (
                                    <div style={{
                                        marginTop: '16px',
                                        padding: '12px',
                                        borderRadius: '6px',
                                        background: 'rgba(197, 160, 89, 0.08)',
                                        border: '1px dashed rgba(197, 160, 89, 0.3)',
                                        textAlign: 'center',
                                        color: '#C5A059',
                                        fontSize: '0.75rem',
                                        fontWeight: '600'
                                    }}>
                                        [ Puedes subir una foto / banner de unidad en el botón "⚙️ Webhook & Banner" ]
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL 1: ADD NEW RANK */}
            {showAddRankModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content mac-modal-dialog" style={{ maxWidth: '420px', padding: 0 }}>
                        <div className="mac-window-titlebar">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowAddRankModal(false)} style={{ cursor: 'pointer' }}></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span style={{ marginLeft: '1rem', fontSize: '0.9rem', fontWeight: '600', color: '#f1f5f9' }}>
                                Añadir Nuevo Rango a la Plantilla
                            </span>
                        </div>

                        <form onSubmit={handleAddNewRank} style={{ padding: '1.5rem' }}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Nombre del Rango *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ej: SERGEANT / INSTRUCTOR / SARGENTO..."
                                    value={newRankName}
                                    onChange={e => setNewRankName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Icono / Emoji *</label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={newRankIcon}
                                        onChange={e => setNewRankIcon(e.target.value)}
                                        style={{ width: '70px', textAlign: 'center', fontSize: '1.2rem' }}
                                        required
                                    />
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {['⚜️', '⚡', '🕵️', '⭐', '🧬', '📋', '🎖️', '🔰', '🛡️', '🎯', '🦅'].map(emoji => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => setNewRankIcon(emoji)}
                                                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '4px', padding: '4px 6px', fontSize: '1rem', cursor: 'pointer' }}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" className="mac-btn mac-btn-secondary" onClick={() => setShowAddRankModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="mac-btn mac-btn-primary">
                                    Crear Rango
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: EDIT RANK */}
            {showEditRankModal && editingRank && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content mac-modal-dialog" style={{ maxWidth: '440px', padding: 0 }}>
                        <div className="mac-window-titlebar">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowEditRankModal(false)} style={{ cursor: 'pointer' }}></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span style={{ marginLeft: '1rem', fontSize: '0.9rem', fontWeight: '600', color: '#f1f5f9' }}>
                                ✏️ Editar Rango de la Plantilla
                            </span>
                        </div>

                        <form onSubmit={handleSaveEditedRank} style={{ padding: '1.5rem' }}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Nombre del Rango *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ej: COORDINADOR / DETECTIVE / SARGENTO..."
                                    value={editingRank.name}
                                    onChange={e => setEditingRank({ ...editingRank, name: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Icono / Emoji *</label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={editingRank.icon}
                                        onChange={e => setEditingRank({ ...editingRank, icon: e.target.value })}
                                        style={{ width: '70px', textAlign: 'center', fontSize: '1.3rem' }}
                                        required
                                    />
                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                        Escribe o elige un emoji de la lista:
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    {['⚜️', '⚡', '🕵️', '⭐', '🧬', '📋', '🎖️', '🔰', '🛡️', '🎯', '🦅', '💼', '👔', '🔍', '🚔', '⚖️', '🏅', '🔹'].map(emoji => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => setEditingRank({ ...editingRank, icon: emoji })}
                                            style={{
                                                background: editingRank.icon === emoji ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255,255,255,0.06)',
                                                border: editingRank.icon === emoji ? '1px solid #3b82f6' : '1px solid transparent',
                                                borderRadius: '6px',
                                                padding: '4px 7px',
                                                fontSize: '1.1rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" className="mac-btn mac-btn-secondary" onClick={() => setShowEditRankModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="mac-btn mac-btn-primary" style={{ background: '#3b82f6', borderColor: '#2563eb' }}>
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: EDIT MEMBER */}
            {showEditMemberModal && editingMember && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content mac-modal-dialog" style={{ maxWidth: '440px', padding: 0 }}>
                        <div className="mac-window-titlebar">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowEditMemberModal(false)} style={{ cursor: 'pointer' }}></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span style={{ marginLeft: '1rem', fontSize: '0.9rem', fontWeight: '600', color: '#f1f5f9' }}>
                                ✏️ Editar Agente de la Plantilla
                            </span>
                        </div>

                        <form onSubmit={handleSaveEditedMember} style={{ padding: '1.5rem' }}>
                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Nombre del Agente *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ej: M. Kleiner | 701 | Marcausente..."
                                    value={editingMember.name}
                                    onChange={e => setEditingMember({ ...editingMember, name: e.target.value })}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">ID de Discord (Opcional)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ej: 1306619156052967471"
                                    value={editingMember.discordId}
                                    onChange={e => setEditingMember({ ...editingMember, discordId: e.target.value })}
                                />
                                <span style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                                    Si introduces la ID numérica de Discord, el bot lo mencionará interactivamente.
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button type="button" className="mac-btn mac-btn-secondary" onClick={() => setShowEditMemberModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="mac-btn mac-btn-primary" style={{ background: '#3b82f6', borderColor: '#2563eb' }}>
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: WEBHOOK & BANNER SETTINGS */}
            {showSettingsModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content mac-modal-dialog" style={{ maxWidth: '600px', padding: 0 }}>
                        <div className="mac-window-titlebar">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowSettingsModal(false)} style={{ cursor: 'pointer' }}></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span style={{ marginLeft: '1rem', fontSize: '0.9rem', fontWeight: '600', color: '#f1f5f9' }}>
                                Ajustes de Webhook & Banner de Plantilla
                            </span>
                        </div>

                        <div style={{ padding: '1.5rem', maxHeight: '75vh', overflowY: 'auto' }}>
                            {/* Title */}
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label">Título del Encabezado</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="SHERIFF CRIMINAL UNIT BUREAU"
                                />
                            </div>

                            {/* Banner Photo Section */}
                            <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                <label className="form-label" style={{ fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                                    🖼️ Foto / Banner Inferior
                                </label>

                                {bannerUrl && (
                                    <div style={{ marginBottom: '10px', maxHeight: '120px', overflow: 'hidden', borderRadius: '6px' }}>
                                        <img src={bannerUrl} alt="Banner" style={{ width: '100%', height: 'auto', objectFit: 'cover' }} />
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="url"
                                        className="form-input"
                                        placeholder="Pega URL directa de la foto o banner..."
                                        value={bannerUrl}
                                        onChange={e => setBannerUrl(e.target.value)}
                                        style={{ flex: 1, fontSize: '0.8rem' }}
                                    />
                                    <label style={{
                                        padding: '0.45rem 0.8rem',
                                        borderRadius: '6px',
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        color: '#cbd5e1',
                                        fontSize: '0.78rem',
                                        cursor: uploadingBanner ? 'not-allowed' : 'pointer',
                                        fontWeight: '600',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            disabled={uploadingBanner}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleBannerUpload(file);
                                            }}
                                        />
                                        <span>{uploadingBanner ? '⏳ Subiendo...' : '📁 Subir Foto'}</span>
                                    </label>
                                </div>
                            </div>

                            {/* Bot Avatar Section with PC Upload */}
                            <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                                <label className="form-label" style={{ fontWeight: '700', marginBottom: '0.5rem', display: 'block' }}>
                                    🤖 Avatar del Bot de Discord
                                </label>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <img
                                        src={botAvatar || SCUB_LOGO_URL}
                                        alt="Bot Avatar"
                                        style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }}
                                        onError={(e) => { e.target.src = '/logowebp/SCUB.webp'; }}
                                    />
                                    <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <input
                                            type="url"
                                            className="form-input"
                                            placeholder="URL del avatar del bot..."
                                            value={botAvatar}
                                            onChange={e => setBotAvatar(e.target.value)}
                                            style={{ flex: 1, fontSize: '0.8rem' }}
                                        />
                                        <label style={{
                                            padding: '0.45rem 0.8rem',
                                            borderRadius: '6px',
                                            background: 'rgba(255, 255, 255, 0.08)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            color: '#cbd5e1',
                                            fontSize: '0.78rem',
                                            cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                                            fontWeight: '600',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                disabled={uploadingAvatar}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleAvatarUpload(file);
                                                }}
                                            />
                                            <span>{uploadingAvatar ? '⏳ Subiendo...' : '📁 Subir Avatar'}</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Webhook URL */}
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label">URL del Webhook de Discord *</label>
                                <input
                                    type="url"
                                    className="form-input"
                                    placeholder="https://discord.com/api/webhooks/..."
                                    value={webhookUrl}
                                    onChange={e => setWebhookUrl(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Role Ping */}
                            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label">Mención de Rol (Opcional)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ej: @Coordination o 1306619156052967471"
                                    value={rolePing}
                                    onChange={e => setRolePing(e.target.value)}
                                />
                            </div>

                            {/* Bot Name */}
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Nombre del Bot</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={botName}
                                    onChange={e => setBotName(e.target.value)}
                                    placeholder="SCUB • Sheriff Criminal Unit Bureau"
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    className="mac-btn mac-btn-primary"
                                    onClick={() => {
                                        handleSaveRoster();
                                        setShowSettingsModal(false);
                                    }}
                                >
                                    Guardar Ajustes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
