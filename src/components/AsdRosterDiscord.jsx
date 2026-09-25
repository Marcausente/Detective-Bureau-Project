import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { uploadImageToStorage } from '../utils/imageStorage';
import {
    SCUB_LOGO_URL,
    DEFAULT_ASD_ROSTER_DATA,
    getASDRosterConfig,
    saveASDRosterConfig,
    sendASDRosterToDiscord,
    formatMemberMention
} from '../utils/discordWebhook';
import '../index.css';

export default function AsdRosterDiscord() {
    const { t } = useLanguage();
    const { isLSSD } = useTheme();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);

    // Roster Config State
    const [rosterData, setRosterData] = useState(DEFAULT_ASD_ROSTER_DATA);
    const [title, setTitle] = useState('AIR SUPPORT DIVISION • DIVISION ROSTER');
    const [bannerUrl, setBannerUrl] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [rolePing, setRolePing] = useState('');
    const [botName, setBotName] = useState('ASD • Air Support Division');
    const [botAvatar, setBotAvatar] = useState(SCUB_LOGO_URL);
    const [enabled, setEnabled] = useState(true);

    // UI State
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [newRankName, setNewRankName] = useState('');
    const [newRankIcon, setNewRankIcon] = useState('🚁');
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
            // Load latest saved roster from Supabase / localStorage
            const config = await getASDRosterConfig();
            setRosterData(config.rosterData || DEFAULT_ASD_ROSTER_DATA);
            setTitle(config.title || 'AIR SUPPORT DIVISION • DIVISION ROSTER');
            setBannerUrl(config.bannerUrl || '');
            setWebhookUrl(config.webhookUrl || '');
            setRolePing(config.rolePing || '');
            setBotName(config.botName || 'ASD • Air Support Division');
            setBotAvatar(config.botAvatar || SCUB_LOGO_URL);
            setEnabled(config.enabled !== undefined ? config.enabled : true);
        } catch (err) {
            console.error('Error loading ASD roster:', err);
            showError('Error al cargar la plantilla: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Save Roster to Supabase
    const handleSaveRoster = async () => {
        try {
            setSubmitting(true);
            const res = await saveASDRosterConfig({
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
                showSuccess('✅ Plantilla de ASD y miembros guardados correctamente en la base de datos.');
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
            await saveASDRosterConfig({
                rosterData,
                webhookUrl,
                title,
                bannerUrl,
                rolePing,
                botName,
                botAvatar,
                enabled
            });

            const res = await sendASDRosterToDiscord({
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
                showSuccess('🚀 ¡Plantilla de ASD enviada exitosamente a Discord!');
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
            const url = await uploadImageToStorage(file, 'asd');
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
            const url = await uploadImageToStorage(file, 'asd');
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
        if (!name && !discordId) {
            showError('Escribe al menos el nombre o la ID de Discord.');
            return;
        }

        const updated = rosterData.map(r => {
            if (r.id === rankId) {
                const members = [...(r.members || [])];
                members[memberIdx] = {
                    ...members[memberIdx],
                    name: name.trim(),
                    discordId: discordId.trim()
                };
                return { ...r, members };
            }
            return r;
        });

        setRosterData(updated);
        setShowEditMemberModal(false);
        setEditingMember(null);
        showSuccess('Miembro actualizado correctamente.');
    };

    // Remove Member from Rank
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

    // Move Member Up/Down within rank
    const handleMoveMember = (rankId, memberIdx, direction) => {
        const targetRank = rosterData.find(r => r.id === rankId);
        if (!targetRank || !targetRank.members) return;

        const members = [...targetRank.members];
        const newIdx = memberIdx + direction;
        if (newIdx < 0 || newIdx >= members.length) return;

        const temp = members[memberIdx];
        members[memberIdx] = members[newIdx];
        members[newIdx] = temp;

        const updated = rosterData.map(r => r.id === rankId ? { ...r, members } : r);
        setRosterData(updated);
    };

    // Add New Custom Rank
    const handleAddRank = (e) => {
        e.preventDefault();
        if (!newRankName.trim()) return;

        const rankId = `rank_${Date.now()}`;
        const newRank = {
            id: rankId,
            name: newRankName.trim().toUpperCase(),
            icon: newRankIcon.trim() || '🚁',
            members: []
        };

        setRosterData([...rosterData, newRank]);
        setNewRankName('');
        setNewRankIcon('🚁');
        setShowAddRankModal(false);
        showSuccess('Rango añadido a la plantilla.');
    };

    // Open Edit Rank Modal
    const handleOpenEditRank = (rank) => {
        setEditingRank({
            id: rank.id,
            name: rank.name,
            icon: rank.icon || '🚁'
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
                    icon: editingRank.icon.trim() || '🚁'
                };
            }
            return r;
        });

        setRosterData(updated);
        setShowEditRankModal(false);
        setEditingRank(null);
        showSuccess('Rango actualizado correctamente.');
    };

    // Remove Rank
    const handleRemoveRank = (rankId, rankName) => {
        if (!window.confirm(`¿Eliminar el rango "${rankName}" y sus integrantes de la plantilla?`)) return;
        setRosterData(rosterData.filter(r => r.id !== rankId));
    };

    // Move Rank Up/Down
    const handleMoveRank = (rankIdx, direction) => {
        const newIdx = rankIdx + direction;
        if (newIdx < 0 || newIdx >= rosterData.length) return;

        const updated = [...rosterData];
        const temp = updated[rankIdx];
        updated[rankIdx] = updated[newIdx];
        updated[newIdx] = temp;
        setRosterData(updated);
    };

    // Save Config Modal
    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setShowSettingsModal(false);
        await handleSaveRoster();
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* Header / Submenu Bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem',
                background: 'rgba(15, 23, 42, 0.7)',
                padding: '1.25rem 1.5rem',
                borderRadius: '14px',
                border: '1px solid rgba(2, 132, 199, 0.3)'
            }}>
                <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', margin: '0 0 0.3rem 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🚁</span>
                        <span>Plantilla Roster Discord • ASD</span>
                    </h2>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem' }}>
                        Organiza y edita los rangos e integrantes de la división Air Support para transmitirlos automáticamente a Discord.
                    </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => setShowSettingsModal(true)}
                        className="btn-secondary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '0.6rem 1.1rem',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            borderRadius: '8px',
                            background: 'rgba(2, 132, 199, 0.15)',
                            borderColor: 'rgba(2, 132, 199, 0.4)',
                            color: '#38bdf8'
                        }}
                    >
                        <span>⚙️</span>
                        <span>Configurar Webhook</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleSaveRoster}
                        disabled={submitting}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '0.6rem 1.25rem',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            borderRadius: '8px',
                            background: '#0284c7',
                            border: '1px solid #0369a1',
                            color: '#ffffff',
                            cursor: submitting ? 'wait' : 'pointer'
                        }}
                    >
                        <span>💾</span>
                        <span>{submitting ? 'Guardando...' : 'Guardar Plantilla'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handlePublishDiscord}
                        disabled={publishing}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '0.6rem 1.35rem',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #5865F2, #4752C4)',
                            border: '1px solid #5865F2',
                            color: '#ffffff',
                            boxShadow: '0 4px 14px rgba(88, 101, 242, 0.4)',
                            cursor: publishing ? 'wait' : 'pointer'
                        }}
                    >
                        <span>🚀</span>
                        <span>{publishing ? 'Enviando a Discord...' : 'Publicar en Discord'}</span>
                    </button>
                </div>
            </div>

            {/* Notifications */}
            {feedback && (
                <div style={{
                    padding: '0.85rem 1.25rem',
                    borderRadius: '10px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#34d399',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span>{feedback}</span>
                </div>
            )}

            {errorMsg && (
                <div style={{
                    padding: '0.85rem 1.25rem',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <span>⚠️ {errorMsg}</span>
                </div>
            )}

            {/* Main Editor Grid (Left: Builder / Ranks, Right: Live Discord Preview) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
                gap: '1.75rem',
                alignItems: 'start'
            }}>
                {/* LEFT COLUMN: Ranks & Members Management */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(15, 23, 42, 0.6)',
                        padding: '0.85rem 1.25rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Estructura de Rangos ({rosterData.length})
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowAddRankModal(true)}
                            style={{
                                background: 'rgba(2, 132, 199, 0.2)',
                                border: '1px solid rgba(2, 132, 199, 0.5)',
                                color: '#38bdf8',
                                padding: '0.4rem 0.85rem',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}
                        >
                            <span>+</span>
                            <span>Añadir Rango</span>
                        </button>
                    </div>

                    {/* Rank Blocks */}
                    {rosterData.map((rank, rankIdx) => (
                        <div
                            key={rank.id || rankIdx}
                            style={{
                                background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)',
                                border: '1px solid rgba(2, 132, 199, 0.25)',
                                borderRadius: '12px',
                                padding: '1.25rem',
                                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)'
                            }}
                        >
                            {/* Rank Header */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                                paddingBottom: '0.75rem',
                                marginBottom: '1rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '1.25rem' }}>{rank.icon || '🚁'}</span>
                                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.5px' }}>
                                        {rank.name}
                                    </h3>
                                    <span style={{
                                        fontSize: '0.72rem',
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        color: '#94a3b8',
                                        padding: '2px 8px',
                                        borderRadius: '10px',
                                        fontWeight: 700
                                    }}>
                                        {(rank.members || []).length} agentes
                                    </span>
                                </div>

                                {/* Rank Controls (Move Up/Down, Edit, Delete) */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleMoveRank(rankIdx, -1)}
                                        disabled={rankIdx === 0}
                                        title="Subir rango"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            color: rankIdx === 0 ? '#475569' : '#cbd5e1',
                                            borderRadius: '5px',
                                            padding: '3px 8px',
                                            cursor: rankIdx === 0 ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        ▲
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleMoveRank(rankIdx, 1)}
                                        disabled={rankIdx === rosterData.length - 1}
                                        title="Bajar rango"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.1)',
                                            color: rankIdx === rosterData.length - 1 ? '#475569' : '#cbd5e1',
                                            borderRadius: '5px',
                                            padding: '3px 8px',
                                            cursor: rankIdx === rosterData.length - 1 ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        ▼
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenEditRank(rank)}
                                        title="Editar nombre e icono del rango"
                                        style={{
                                            background: 'rgba(2, 132, 199, 0.15)',
                                            border: '1px solid rgba(2, 132, 199, 0.4)',
                                            color: '#38bdf8',
                                            borderRadius: '5px',
                                            padding: '3px 8px',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ✏️ Editar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveRank(rank.id, rank.name)}
                                        title="Eliminar rango"
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.15)',
                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                            color: '#f87171',
                                            borderRadius: '5px',
                                            padding: '3px 8px',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Members List in Rank */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                                {(!rank.members || rank.members.length === 0) ? (
                                    <div style={{
                                        color: '#64748b',
                                        fontSize: '0.82rem',
                                        fontStyle: 'italic',
                                        padding: '0.5rem 0.75rem',
                                        background: 'rgba(0, 0, 0, 0.2)',
                                        borderRadius: '6px'
                                    }}>
                                        No hay miembros asignados a este rango.
                                    </div>
                                ) : (
                                    rank.members.map((member, memberIdx) => {
                                        const isSnowflake = member.discordId && /^\d{15,22}$/.test(member.discordId);
                                        return (
                                            <div
                                                key={member.id || memberIdx}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    background: 'rgba(15, 23, 42, 0.7)',
                                                    border: '1px solid rgba(255, 255, 255, 0.08)',
                                                    borderRadius: '8px',
                                                    padding: '0.55rem 0.85rem'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ color: '#38bdf8', fontSize: '0.9rem' }}>•</span>
                                                    
                                                    {/* Discord ID Badge */}
                                                    {member.discordId ? (
                                                        <span style={{
                                                            background: 'rgba(88, 101, 242, 0.2)',
                                                            color: '#818cf8',
                                                            border: '1px solid rgba(88, 101, 242, 0.4)',
                                                            borderRadius: '4px',
                                                            padding: '2px 7px',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 700,
                                                            fontFamily: 'monospace'
                                                        }}>
                                                            {isSnowflake ? `<@${member.discordId}>` : member.discordId}
                                                        </span>
                                                    ) : (
                                                        <span style={{ color: '#64748b', fontSize: '0.78rem' }}>Sin ID Discord</span>
                                                    )}

                                                    {/* Agent Name Tag */}
                                                    {member.name && (
                                                        <span style={{
                                                            color: '#f1f5f9',
                                                            fontSize: '0.88rem',
                                                            fontWeight: 600
                                                        }}>
                                                            {member.name}
                                                        </span>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveMember(rank.id, memberIdx, -1)}
                                                        disabled={memberIdx === 0}
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: memberIdx === 0 ? '#334155' : '#94a3b8',
                                                            cursor: memberIdx === 0 ? 'not-allowed' : 'pointer',
                                                            padding: '2px 4px'
                                                        }}
                                                    >
                                                        ▲
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleMoveMember(rank.id, memberIdx, 1)}
                                                        disabled={memberIdx === rank.members.length - 1}
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: memberIdx === rank.members.length - 1 ? '#334155' : '#94a3b8',
                                                            cursor: memberIdx === rank.members.length - 1 ? 'not-allowed' : 'pointer',
                                                            padding: '2px 4px'
                                                        }}
                                                    >
                                                        ▼
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditMember(rank.id, memberIdx, member)}
                                                        title="Editar agente"
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: '#38bdf8',
                                                            cursor: 'pointer',
                                                            padding: '2px 4px',
                                                            fontSize: '0.85rem'
                                                        }}
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveMember(rank.id, memberIdx)}
                                                        title="Eliminar agente de este rango"
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: '#ef4444',
                                                            cursor: 'pointer',
                                                            padding: '2px 4px',
                                                            fontSize: '0.85rem'
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Add Member Form for this Rank: Discord ID first, Name second */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1.1fr 1.3fr auto',
                                gap: '8px',
                                background: 'rgba(0, 0, 0, 0.35)',
                                padding: '0.65rem 0.75rem',
                                borderRadius: '8px',
                                border: '1px dashed rgba(2, 132, 199, 0.3)'
                            }}>
                                <input
                                    type="text"
                                    placeholder="ID de Discord (ej: 4892...)"
                                    value={memberInputs[rank.id]?.discordId || ''}
                                    onChange={(e) => setMemberInputs({
                                        ...memberInputs,
                                        [rank.id]: {
                                            ...(memberInputs[rank.id] || {}),
                                            discordId: e.target.value
                                        }
                                    })}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember(rank.id); }}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '6px',
                                        color: '#ffffff',
                                        padding: '0.45rem 0.65rem',
                                        fontSize: '0.82rem',
                                        fontFamily: 'monospace'
                                    }}
                                />

                                <input
                                    type="text"
                                    placeholder="Nombre del Agente (EJ: Matthew Kleiner)"
                                    value={memberInputs[rank.id]?.name || ''}
                                    onChange={(e) => setMemberInputs({
                                        ...memberInputs,
                                        [rank.id]: {
                                            ...(memberInputs[rank.id] || {}),
                                            name: e.target.value
                                        }
                                    })}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember(rank.id); }}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '6px',
                                        color: '#ffffff',
                                        padding: '0.45rem 0.65rem',
                                        fontSize: '0.82rem'
                                    }}
                                />

                                <button
                                    type="button"
                                    onClick={() => handleAddMember(rank.id)}
                                    style={{
                                        background: '#0284c7',
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        padding: '0.45rem 0.85rem',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    + Añadir
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* RIGHT COLUMN: Live Discord Preview */}
                <div style={{
                    position: 'sticky',
                    top: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'rgba(15, 23, 42, 0.6)',
                        padding: '0.85rem 1.25rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#5865F2', display: 'inline-block' }}></span>
                            <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase' }}>
                                Vista Previa en Discord
                            </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Live Embed</span>
                    </div>

                    {/* Discord Message Simulator */}
                    <div style={{
                        background: '#313338',
                        borderRadius: '12px',
                        padding: '1.25rem',
                        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        fontFamily: '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif'
                    }}>
                        {/* Bot Header Row */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '0.85rem' }}>
                            <img
                                src={botAvatar || SCUB_LOGO_URL}
                                alt="Bot Avatar"
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    background: '#1e1f22'
                                }}
                            />
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontWeight: 600, color: '#f2f3f5', fontSize: '0.95rem' }}>
                                        {botName || 'ASD • Air Support Division'}
                                    </span>
                                    <span style={{
                                        background: '#5865f2',
                                        color: '#ffffff',
                                        fontSize: '0.62rem',
                                        fontWeight: 700,
                                        padding: '1px 4px',
                                        borderRadius: '3px',
                                        textTransform: 'uppercase'
                                    }}>
                                        BOT
                                    </span>
                                    <span style={{ color: '#949ba4', fontSize: '0.72rem', marginLeft: '4px' }}>
                                        Hoy a las {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                {rolePing && (
                                    <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#c9cdfb', background: 'rgba(88, 101, 242, 0.15)', padding: '2px 6px', borderRadius: '3px', display: 'inline-block' }}>
                                        {rolePing}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Discord Embed Box */}
                        <div style={{
                            background: '#2b2d31',
                            borderLeft: '4px solid #0284c7', // ASD Cyan/Sky Blue
                            borderRadius: '4px',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            {/* Embed Title */}
                            <div style={{
                                fontSize: '1rem',
                                fontWeight: 700,
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                <span>🚁</span>
                                <span>{title || 'AIR SUPPORT DIVISION • DIVISION ROSTER'}</span>
                            </div>

                            {/* Embed Description (Ranks & Mentions) */}
                            <div style={{
                                fontSize: '0.88rem',
                                color: '#dbdee1',
                                lineHeight: 1.6,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '14px'
                            }}>
                                {rosterData.map((rank, idx) => (
                                    <div key={rank.id || idx}>
                                        <div style={{ fontWeight: 800, color: '#f2f3f5', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'underline' }}>
                                            <span>{rank.icon || '🚁'}</span>
                                            <span>{rank.name}</span>
                                        </div>
                                        <div style={{ marginTop: '4px', paddingLeft: '4px' }}>
                                            {(!rank.members || rank.members.length === 0) ? (
                                                <span style={{ color: '#949ba4', fontSize: '0.82rem' }}>• N/A</span>
                                            ) : (
                                                rank.members.map((m, mIdx) => (
                                                    <div key={m.id || mIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                        <span style={{ color: '#949ba4' }}>•</span>
                                                        <span style={{
                                                            background: 'rgba(88, 101, 242, 0.3)',
                                                            color: '#c9cdfb',
                                                            borderRadius: '3px',
                                                            padding: '0px 4px',
                                                            fontSize: '0.82rem',
                                                            fontWeight: 600
                                                        }}>
                                                            {formatMemberMention(m).replace(/^•\s*/, '')}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Embed Banner Image Preview */}
                            {bannerUrl && bannerUrl.trim().startsWith('http') && (
                                <div style={{ marginTop: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                    <img
                                        src={bannerUrl.trim()}
                                        alt="Roster Banner"
                                        style={{
                                            width: '100%',
                                            maxHeight: '220px',
                                            objectFit: 'cover',
                                            borderRadius: '4px',
                                            display: 'block'
                                        }}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                </div>
                            )}

                            {/* Embed Footer */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.72rem',
                                color: '#949ba4',
                                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                                paddingTop: '8px',
                                marginTop: '4px'
                            }}>
                                <span>ASD Roster System • Hoy a las {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL 1: Settings / Webhook Config Modal */}
            {showSettingsModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.5rem'
                }}>
                    <div style={{
                        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                        border: '1px solid rgba(2, 132, 199, 0.35)',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '620px',
                        padding: '1.75rem 2rem',
                        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>⚙️</span>
                                <span>Configuración Webhook • ASD</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowSettingsModal(false)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    URL del Webhook de Discord (Canal ASD) *
                                </label>
                                <input
                                    type="url"
                                    required
                                    placeholder="https://discord.com/api/webhooks/..."
                                    value={webhookUrl}
                                    onChange={(e) => setWebhookUrl(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        padding: '0.65rem 0.85rem',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Título del Embed
                                </label>
                                <input
                                    type="text"
                                    placeholder="AIR SUPPORT DIVISION • DIVISION ROSTER"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        padding: '0.65rem 0.85rem',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Mención de Rol o Grupo (Opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="@everyone, @ASD, o ID de Rol de Discord"
                                    value={rolePing}
                                    onChange={(e) => setRolePing(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        padding: '0.65rem 0.85rem',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                        Nombre del Bot
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="ASD • Air Support Division"
                                        value={botName}
                                        onChange={(e) => setBotName(e.target.value)}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.9)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            color: '#ffffff',
                                            padding: '0.65rem 0.85rem',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                        Avatar del Bot
                                    </label>
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <input
                                            type="url"
                                            placeholder="URL del Avatar"
                                            value={botAvatar}
                                            onChange={(e) => setBotAvatar(e.target.value)}
                                            style={{
                                                flex: 1,
                                                background: 'rgba(15, 23, 42, 0.9)',
                                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                                borderRadius: '8px',
                                                color: '#ffffff',
                                                padding: '0.65rem 0.85rem',
                                                fontSize: '0.85rem'
                                            }}
                                        />
                                        <label
                                            style={{
                                                background: 'rgba(2, 132, 199, 0.2)',
                                                border: '1px solid rgba(2, 132, 199, 0.5)',
                                                borderRadius: '8px',
                                                color: '#38bdf8',
                                                padding: '0.65rem 0.75rem',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                cursor: uploadingAvatar ? 'wait' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            {uploadingAvatar ? '...' : 'Subir'}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                disabled={uploadingAvatar}
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) handleAvatarUpload(e.target.files[0]);
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Banner Image Input & Upload */}
                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Banner / Imagen de Cabecera para Discord
                                </label>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="url"
                                        placeholder="https://i.imgur.com/... o subir archivo"
                                        value={bannerUrl}
                                        onChange={(e) => setBannerUrl(e.target.value)}
                                        style={{
                                            flex: 1,
                                            background: 'rgba(15, 23, 42, 0.9)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            color: '#ffffff',
                                            padding: '0.65rem 0.85rem',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                    <label
                                        style={{
                                            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: '#ffffff',
                                            padding: '0.65rem 1rem',
                                            fontSize: '0.82rem',
                                            fontWeight: 700,
                                            cursor: uploadingBanner ? 'wait' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}
                                    >
                                        <span>📁</span>
                                        <span>{uploadingBanner ? 'Subiendo...' : 'Subir Foto'}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            disabled={uploadingBanner}
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) handleBannerUpload(e.target.files[0]);
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '1rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowSettingsModal(false)}
                                    className="btn-secondary"
                                    style={{ padding: '0.6rem 1.25rem', borderRadius: '8px' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        background: '#0284c7',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        padding: '0.6rem 1.5rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Guardar Configuración
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: Add New Rank Modal */}
            {showAddRankModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.5rem'
                }}>
                    <div style={{
                        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                        border: '1px solid rgba(2, 132, 199, 0.35)',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '480px',
                        padding: '1.75rem 2rem',
                        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                                Añadir Rango a la Plantilla ASD
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowAddRankModal(false)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleAddRank} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Nombre del Rango *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: PILOTO DE COMBATE, TFO..."
                                    value={newRankName}
                                    onChange={(e) => setNewRankName(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        padding: '0.65rem 0.85rem',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Icono / Emoji (Opcional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="🚁, 🦅, ⭐, 🎖️..."
                                    value={newRankIcon}
                                    onChange={(e) => setNewRankIcon(e.target.value)}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        padding: '0.65rem 0.85rem',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddRankModal(false)}
                                    className="btn-secondary"
                                    style={{ padding: '0.55rem 1.15rem', borderRadius: '8px' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        background: '#0284c7',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        padding: '0.55rem 1.35rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Añadir Rango
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: Edit Rank Modal */}
            {showEditRankModal && editingRank && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.5rem'
                }}>
                    <div style={{
                        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                        border: '1px solid rgba(2, 132, 199, 0.35)',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '480px',
                        padding: '1.75rem 2rem',
                        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                                Editar Rango de la Plantilla
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowEditRankModal(false)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveEditedRank} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Nombre del Rango *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editingRank.name}
                                    onChange={(e) => setEditingRank({ ...editingRank, name: e.target.value })}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        padding: '0.65rem 0.85rem',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Icono / Emoji
                                </label>
                                <input
                                    type="text"
                                    value={editingRank.icon}
                                    onChange={(e) => setEditingRank({ ...editingRank, icon: e.target.value })}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        padding: '0.65rem 0.85rem',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowEditRankModal(false)}
                                    className="btn-secondary"
                                    style={{ padding: '0.55rem 1.15rem', borderRadius: '8px' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        background: '#0284c7',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        padding: '0.55rem 1.35rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: Edit Member Modal */}
            {showEditMemberModal && editingMember && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(6px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.5rem'
                }}>
                    <div style={{
                        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                        border: '1px solid rgba(2, 132, 199, 0.35)',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '480px',
                        padding: '1.75rem 2rem',
                        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.75rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc' }}>
                                Editar Agente
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowEditMemberModal(false)}
                                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveEditedMember} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    ID de Discord (Mención en Discord)
                                </label>
                                <input
                                    type="text"
                                    placeholder="48928374928..."
                                    value={editingMember.discordId}
                                    onChange={(e) => setEditingMember({ ...editingMember, discordId: e.target.value })}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        padding: '0.65rem 0.85rem',
                                        fontSize: '0.85rem',
                                        fontFamily: 'monospace'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                                    Nombre del Agente (EJ: Matthew Kleiner)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Nombre del Agente"
                                    value={editingMember.name}
                                    onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        padding: '0.65rem 0.85rem',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowEditMemberModal(false)}
                                    className="btn-secondary"
                                    style={{ padding: '0.55rem 1.15rem', borderRadius: '8px' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        background: '#0284c7',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        fontWeight: 700,
                                        padding: '0.55rem 1.35rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Guardar Agente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
