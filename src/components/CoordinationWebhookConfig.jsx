import { useState, useEffect } from 'react';
import {
    getDiscordWebhookConfig,
    saveDiscordWebhookConfig,
    testDiscordWebhook,
    getDiscordPracticesWebhookConfig,
    saveDiscordPracticesWebhookConfig,
    testDiscordPracticesWebhook,
    formatRoleMention,
    SCUB_LOGO_URL,
    DTP_LOGO_URL,
    DEFAULT_BOT_NAME,
    DEFAULT_HEADER_TEXT,
    DEFAULT_FOOTER_TEXT,
    DEFAULT_REMINDER_TEXT,
    DEFAULT_PRACTICES_BOT_NAME,
    DEFAULT_PRACTICES_HEADER_TEXT,
    DEFAULT_PRACTICES_FOOTER_TEXT,
    DEFAULT_PRACTICES_REMINDER_TEXT
} from '../utils/discordWebhook';
import { uploadImageToStorage } from '../utils/imageStorage';

const AVATAR_PRESETS = [
    { label: 'Logo SCUB', url: SCUB_LOGO_URL, icon: '🛡️' },
    { label: 'Logo DTP', url: DTP_LOGO_URL, icon: '🎯' },
    { label: 'Detective Bureau', url: 'https://i.postimg.cc/mD8V4y2N/lspd-badge.png', icon: '🔍' }
];

function CoordinationWebhookConfig() {
    const [subTab, setSubTab] = useState('announcements'); // 'announcements' | 'practices'

    // Announcements States
    const [annUrl, setAnnUrl] = useState('');
    const [annEnabled, setAnnEnabled] = useState(false);
    const [annPing, setAnnPing] = useState('');
    const [annPingPreset, setAnnPingPreset] = useState('none');
    const [annBotName, setAnnBotName] = useState(DEFAULT_BOT_NAME);
    const [annBotAvatar, setAnnBotAvatar] = useState(SCUB_LOGO_URL);
    const [annFooter, setAnnFooter] = useState(DEFAULT_FOOTER_TEXT);
    const [annHeader, setAnnHeader] = useState(DEFAULT_HEADER_TEXT);
    const [annReminder, setAnnReminder] = useState(DEFAULT_REMINDER_TEXT);

    // Practices States
    const [pracUrl, setPracUrl] = useState('');
    const [pracEnabled, setPracEnabled] = useState(false);
    const [pracPing, setPracPing] = useState('');
    const [pracPingPreset, setPracPingPreset] = useState('none');
    const [pracBotName, setPracBotName] = useState(DEFAULT_PRACTICES_BOT_NAME);
    const [pracBotAvatar, setPracBotAvatar] = useState(DTP_LOGO_URL);
    const [pracFooter, setPracFooter] = useState(DEFAULT_PRACTICES_FOOTER_TEXT);
    const [pracHeader, setPracHeader] = useState(DEFAULT_PRACTICES_HEADER_TEXT);
    const [pracReminder, setPracReminder] = useState(DEFAULT_PRACTICES_REMINDER_TEXT);

    const [showUrl, setShowUrl] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const [statusMsg, setStatusMsg] = useState(null);

    useEffect(() => {
        loadAllConfigs();
    }, []);

    const loadAllConfigs = async () => {
        try {
            setLoading(true);
            const [annCfg, pracCfg] = await Promise.all([
                getDiscordWebhookConfig(),
                getDiscordPracticesWebhookConfig()
            ]);

            // Set Announcements
            setAnnUrl(annCfg.webhookUrl || '');
            setAnnEnabled(!!annCfg.enabled);
            setAnnPing(annCfg.rolePing || '');
            setAnnBotName(annCfg.botName || DEFAULT_BOT_NAME);
            setAnnBotAvatar(annCfg.botAvatar || SCUB_LOGO_URL);
            setAnnFooter(annCfg.footerText || DEFAULT_FOOTER_TEXT);
            setAnnHeader(annCfg.customHeader || DEFAULT_HEADER_TEXT);
            setAnnReminder(annCfg.reminderText !== undefined ? annCfg.reminderText : DEFAULT_REMINDER_TEXT);

            const aPing = (annCfg.rolePing || '').trim();
            if (!aPing) setAnnPingPreset('none');
            else if (aPing === '@everyone') setAnnPingPreset('everyone');
            else if (aPing === '@here') setAnnPingPreset('here');
            else setAnnPingPreset('custom');

            // Set Practices
            setPracUrl(pracCfg.webhookUrl || '');
            setPracEnabled(!!pracCfg.enabled);
            setPracPing(pracCfg.rolePing || '');
            setPracBotName(pracCfg.botName || DEFAULT_PRACTICES_BOT_NAME);
            setPracBotAvatar(pracCfg.botAvatar || DTP_LOGO_URL);
            setPracFooter(pracCfg.footerText || DEFAULT_PRACTICES_FOOTER_TEXT);
            setPracHeader(pracCfg.customHeader || DEFAULT_PRACTICES_HEADER_TEXT);
            setPracReminder(pracCfg.reminderText !== undefined ? pracCfg.reminderText : DEFAULT_PRACTICES_REMINDER_TEXT);

            const pPing = (pracCfg.rolePing || '').trim();
            if (!pPing) setPracPingPreset('none');
            else if (pPing === '@everyone') setPracPingPreset('everyone');
            else if (pPing === '@here') setPracPingPreset('here');
            else setPracPingPreset('custom');

        } catch (err) {
            console.error('Error loading discord webhook configs:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePingPresetChange = (preset, isAnn = true) => {
        if (isAnn) {
            setAnnPingPreset(preset);
            if (preset === 'none') setAnnPing('');
            else if (preset === 'everyone') setAnnPing('@everyone');
            else if (preset === 'here') setAnnPing('@here');
        } else {
            setPracPingPreset(preset);
            if (preset === 'none') setPracPing('');
            else if (preset === 'everyone') setPracPing('@everyone');
            else if (preset === 'here') setPracPing('@here');
        }
    };

    const handleAvatarUpload = async (e, isAnn = true) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingAvatar(true);
        setStatusMsg(null);
        try {
            const publicUrl = await uploadImageToStorage(file, 'system');
            if (publicUrl) {
                if (isAnn) setAnnBotAvatar(publicUrl);
                else setPracBotAvatar(publicUrl);

                setStatusMsg({
                    type: 'success',
                    text: 'Avatar personalizado subido con éxito al almacenamiento.'
                });
                setTimeout(() => setStatusMsg(null), 3500);
            }
        } catch (err) {
            setStatusMsg({
                type: 'error',
                text: `Error al subir avatar: ${err.message}`
            });
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        setSaving(true);
        setStatusMsg(null);

        try {
            if (subTab === 'announcements') {
                if (annEnabled && (!annUrl.trim() || !annUrl.trim().startsWith('https://'))) {
                    throw new Error('Debes introducir una URL de webhook válida para habilitar el servicio de Anuncios.');
                }

                await saveDiscordWebhookConfig({
                    webhookUrl: annUrl.trim(),
                    enabled: annEnabled,
                    rolePing: annPing.trim(),
                    botName: annBotName.trim() || DEFAULT_BOT_NAME,
                    botAvatar: annBotAvatar.trim() || SCUB_LOGO_URL,
                    footerText: annFooter.trim() || DEFAULT_FOOTER_TEXT,
                    customHeader: annHeader.trim() || DEFAULT_HEADER_TEXT,
                    reminderText: annReminder.trim()
                });

                setStatusMsg({
                    type: 'success',
                    text: 'Configuración de Webhook de Anuncios guardada exitosamente.'
                });
            } else {
                if (pracEnabled && (!pracUrl.trim() || !pracUrl.trim().startsWith('https://'))) {
                    throw new Error('Debes introducir una URL de webhook válida para habilitar el servicio de Prácticas.');
                }

                await saveDiscordPracticesWebhookConfig({
                    webhookUrl: pracUrl.trim(),
                    enabled: pracEnabled,
                    rolePing: pracPing.trim(),
                    botName: pracBotName.trim() || DEFAULT_PRACTICES_BOT_NAME,
                    botAvatar: pracBotAvatar.trim() || DTP_LOGO_URL,
                    footerText: pracFooter.trim() || DEFAULT_PRACTICES_FOOTER_TEXT,
                    customHeader: pracHeader.trim() || DEFAULT_PRACTICES_HEADER_TEXT,
                    reminderText: pracReminder.trim()
                });

                setStatusMsg({
                    type: 'success',
                    text: 'Configuración de Webhook de Prácticas (DTP) guardada exitosamente.'
                });
            }
            setTimeout(() => setStatusMsg(null), 4000);
        } catch (err) {
            setStatusMsg({
                type: 'error',
                text: err.message || 'Error al guardar la configuración.'
            });
        } finally {
            setSaving(false);
        }
    };

    const handleTestWebhook = async () => {
        const isAnn = subTab === 'announcements';
        const targetUrl = isAnn ? annUrl.trim() : pracUrl.trim();

        if (!targetUrl || !targetUrl.startsWith('https://')) {
            setStatusMsg({
                type: 'error',
                text: 'Introduce una URL de webhook de Discord válida antes de probar.'
            });
            return;
        }

        setTesting(true);
        setStatusMsg(null);

        try {
            if (isAnn) {
                await testDiscordWebhook({
                    webhookUrl: annUrl.trim(),
                    rolePing: annPing.trim(),
                    botName: annBotName.trim() || DEFAULT_BOT_NAME,
                    botAvatar: annBotAvatar.trim() || SCUB_LOGO_URL,
                    footerText: annFooter.trim() || DEFAULT_FOOTER_TEXT,
                    customHeader: annHeader.trim() || DEFAULT_HEADER_TEXT,
                    reminderText: annReminder.trim()
                });
            } else {
                await testDiscordPracticesWebhook({
                    webhookUrl: pracUrl.trim(),
                    rolePing: pracPing.trim(),
                    botName: pracBotName.trim() || DEFAULT_PRACTICES_BOT_NAME,
                    botAvatar: pracBotAvatar.trim() || DTP_LOGO_URL,
                    footerText: pracFooter.trim() || DEFAULT_PRACTICES_FOOTER_TEXT,
                    customHeader: pracHeader.trim() || DEFAULT_PRACTICES_HEADER_TEXT,
                    reminderText: pracReminder.trim()
                });
            }

            setStatusMsg({
                type: 'success',
                text: '¡Mensaje de prueba enviado con éxito a Discord! Revisa el canal configurado.'
            });
            setTimeout(() => setStatusMsg(null), 6000);
        } catch (err) {
            setStatusMsg({
                type: 'error',
                text: `Error al probar el webhook: ${err.message}`
            });
        } finally {
            setTesting(false);
        }
    };

    const currentUrl = subTab === 'announcements' ? annUrl : pracUrl;
    const currentEnabled = subTab === 'announcements' ? annEnabled : pracEnabled;
    const isUrlConfigured = !!currentUrl && currentUrl.trim().startsWith('https://');

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                <div className="mac-status-dot" style={{ backgroundColor: '#5865F2', margin: '0 auto 1rem auto', width: '12px', height: '12px' }}></div>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>Cargando configuración de Webhooks...</div>
            </div>
        );
    }

    return (
        <div style={{ width: '100%' }}>
            {/* Top Sub-tabs Switcher for Announcements vs Practices */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                background: 'rgba(15, 23, 42, 0.65)',
                padding: '0.35rem',
                borderRadius: '14px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                width: 'fit-content',
                marginBottom: '1.5rem',
                flexWrap: 'wrap'
            }}>
                <button
                    type="button"
                    onClick={() => setSubTab('announcements')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.55rem 1.25rem',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        border: subTab === 'announcements' ? '1px solid rgba(88, 101, 242, 0.5)' : '1px solid transparent',
                        background: subTab === 'announcements' ? 'rgba(88, 101, 242, 0.25)' : 'transparent',
                        color: subTab === 'announcements' ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <span>📢</span>
                    <span>Anuncios del Dashboard</span>
                    {annEnabled && annUrl && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', marginLeft: '4px' }}></span>
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => setSubTab('practices')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.55rem 1.25rem',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        border: subTab === 'practices' ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid transparent',
                        background: subTab === 'practices' ? 'rgba(245, 158, 11, 0.25)' : 'transparent',
                        color: subTab === 'practices' ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <span>🎯</span>
                    <span>Prácticas & Formación (DTP)</span>
                    {pracEnabled && pracUrl && (
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', marginLeft: '4px' }}></span>
                    )}
                </button>
            </div>

            {/* Status Header Bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.75rem',
                background: isUrlConfigured && currentEnabled
                    ? (subTab === 'announcements'
                        ? 'linear-gradient(135deg, rgba(88, 101, 242, 0.15), rgba(15, 23, 42, 0.85))'
                        : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(15, 23, 42, 0.85))')
                    : 'rgba(15, 23, 42, 0.75)',
                border: isUrlConfigured && currentEnabled
                    ? (subTab === 'announcements' ? '1px solid rgba(88, 101, 242, 0.35)' : '1px solid rgba(245, 158, 11, 0.35)')
                    : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '18px',
                marginBottom: '1.75rem',
                boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
                backdropFilter: 'blur(20px)',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        flexShrink: 0
                    }}>
                        <img
                            src={subTab === 'announcements' ? (annBotAvatar || SCUB_LOGO_URL) : (pracBotAvatar || DTP_LOGO_URL)}
                            alt="Avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            onError={(e) => { e.target.src = subTab === 'announcements' ? '/logowebp/SCUB.webp' : '/logowebp/DTP logo.webp'; }}
                        />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                {subTab === 'announcements' ? 'Webhook para Anuncios Oficiales' : 'Webhook para Prácticas e Instrucción DTP'}
                            </h3>
                            <span style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                background: isUrlConfigured && currentEnabled ? 'rgba(16, 185, 129, 0.2)' : !isUrlConfigured ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                color: isUrlConfigured && currentEnabled ? '#34d399' : !isUrlConfigured ? '#f87171' : '#fbbf24',
                                border: isUrlConfigured && currentEnabled ? '1px solid rgba(16, 185, 129, 0.4)' : !isUrlConfigured ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}>
                                <span style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: isUrlConfigured && currentEnabled ? '#10b981' : !isUrlConfigured ? '#ef4444' : '#f59e0b',
                                    boxShadow: isUrlConfigured && currentEnabled ? '0 0 8px #10b981' : 'none'
                                }}></span>
                                {isUrlConfigured && currentEnabled ? 'Servicio Activo' : !isUrlConfigured ? 'Sin Configurar' : 'Desactivado'}
                            </span>
                        </div>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.84rem' }}>
                            {subTab === 'announcements'
                                ? 'Retransmite automáticamente los comunicados publicados en el Dashboard al canal de Discord.'
                                : 'Convoca y notifica automáticamente las prácticas programadas en el apartado de Formación a Discord.'}
                        </p>
                    </div>
                </div>

                {/* Quick Toggle Switch */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.04)',
                    padding: '0.5rem 1rem',
                    borderRadius: '14px',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: currentEnabled ? '#ffffff' : '#94a3b8' }}>
                        {currentEnabled ? 'Envío Automático Activado' : 'Envío Desactivado'}
                    </span>
                    <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', margin: 0, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={currentEnabled}
                            onChange={(e) => {
                                if (subTab === 'announcements') setAnnEnabled(e.target.checked);
                                else setPracEnabled(e.target.checked);
                            }}
                            style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: currentEnabled ? (subTab === 'announcements' ? '#5865F2' : '#f59e0b') : 'rgba(255, 255, 255, 0.15)',
                            transition: '0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            borderRadius: '34px',
                            boxShadow: currentEnabled ? (subTab === 'announcements' ? '0 0 14px rgba(88, 101, 242, 0.5)' : '0 0 14px rgba(245, 158, 11, 0.5)') : 'none'
                        }}>
                            <span style={{
                                position: 'absolute',
                                height: '20px',
                                width: '20px',
                                left: currentEnabled ? '24px' : '3px',
                                bottom: '3px',
                                backgroundColor: '#ffffff',
                                transition: '0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                borderRadius: '50%',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                            }} />
                        </span>
                    </label>
                </div>
            </div>

            {/* Notification alert */}
            {statusMsg && (
                <div style={{
                    padding: '0.9rem 1.25rem',
                    borderRadius: '12px',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: statusMsg.type === 'success' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                    color: statusMsg.type === 'success' ? '#34d399' : '#f87171',
                    animation: 'fadeIn 0.25s ease'
                }}>
                    <span style={{ fontSize: '1.1rem' }}>{statusMsg.type === 'success' ? '✅' : '⚠️'}</span>
                    <span>{statusMsg.text}</span>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1.05fr)', gap: '1.5rem' }}>
                {/* Configuration Form Panel */}
                <div className="mac-profile-panel" style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                    borderRadius: '20px',
                    padding: '1.75rem',
                    backdropFilter: 'blur(20px)'
                }}>
                    <form onSubmit={handleSave}>
                        {/* SECTION A: WEBHOOK CONNECTION */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: subTab === 'announcements' ? '#60a5fa' : '#fbbf24', fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>🔗</span> Canal & Conexión de Discord ({subTab === 'announcements' ? 'Anuncios' : 'Prácticas'})
                            </h4>

                            {/* Webhook URL Input */}
                            <div className="mac-form-group" style={{ marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                    <label className="mac-form-label" style={{ margin: 0, fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0' }}>
                                        URL del Webhook de Discord *
                                    </label>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        Canal &gt; Editar &gt; Integraciones
                                    </span>
                                </div>

                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input
                                        type={showUrl ? 'text' : 'password'}
                                        className="mac-form-input"
                                        placeholder="https://discord.com/api/webhooks/..."
                                        value={subTab === 'announcements' ? annUrl : pracUrl}
                                        onChange={(e) => {
                                            if (subTab === 'announcements') setAnnUrl(e.target.value);
                                            else setPracUrl(e.target.value);
                                        }}
                                        style={{
                                            fontFamily: showUrl ? 'monospace' : 'inherit',
                                            fontSize: '0.85rem',
                                            paddingRight: '5.5rem'
                                        }}
                                    />
                                    <div style={{ position: 'absolute', right: '8px', display: 'flex', gap: '4px' }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowUrl(!showUrl)}
                                            className="mac-btn mac-btn-secondary"
                                            style={{ padding: '4px 8px', fontSize: '0.72rem', borderRadius: '6px' }}
                                            title={showUrl ? 'Ocultar URL' : 'Mostrar URL'}
                                        >
                                            {showUrl ? '🙈 Ocultar' : '👁️ Ver'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Mention / Ping Role Selector */}
                            <div className="mac-form-group" style={{ margin: 0 }}>
                                <label className="mac-form-label" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    Mención de Rol / Ping (Opcional)
                                </label>
                                
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                                    {[
                                        { id: 'none', label: 'Sin mención' },
                                        { id: 'everyone', label: '@everyone' },
                                        { id: 'here', label: '@here' },
                                        { id: 'custom', label: 'ID de Rol' }
                                    ].map(preset => {
                                        const activePreset = subTab === 'announcements' ? annPingPreset : pracPingPreset;
                                        return (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => handlePingPresetChange(preset.id, subTab === 'announcements')}
                                                style={{
                                                    padding: '0.35rem 0.75rem',
                                                    borderRadius: '8px',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 700,
                                                    border: activePreset === preset.id ? '1px solid rgba(88, 101, 242, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                    background: activePreset === preset.id ? 'rgba(88, 101, 242, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                                                    color: activePreset === preset.id ? '#ffffff' : '#94a3b8',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                {preset.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {((subTab === 'announcements' && annPingPreset === 'custom') || (subTab === 'practices' && pracPingPreset === 'custom')) && (
                                    <div>
                                        <input
                                            type="text"
                                            className="mac-form-input"
                                            placeholder="Pega la ID del rol (ej: 1306619156052967471 o <@&1306619156052967471>)"
                                            value={subTab === 'announcements' ? annPing : pracPing}
                                            onChange={(e) => {
                                                if (subTab === 'announcements') setAnnPing(e.target.value);
                                                else setPracPing(e.target.value);
                                            }}
                                            style={{ fontSize: '0.85rem' }}
                                        />
                                        <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.74rem' }}>
                                            💡 Puedes pegar la ID numérica del rol directamente; el sistema la formateará automáticamente para que mencione al rol en Discord.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SECTION B: BOT IDENTITY & BRANDING */}
                        <div style={{ paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: '#fbbf24', fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>🤖</span> Identidad Visual del Bot
                            </h4>

                            {/* Bot Username */}
                            <div className="mac-form-group" style={{ marginBottom: '1rem' }}>
                                <label className="mac-form-label" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    Nombre del Usuario / Bot en Discord
                                </label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    placeholder={subTab === 'announcements' ? 'Ej: SCUB • Sheriff Criminal Unit Bureau' : 'Ej: DTP • Detective Training Program'}
                                    value={subTab === 'announcements' ? annBotName : pracBotName}
                                    onChange={(e) => {
                                        if (subTab === 'announcements') setAnnBotName(e.target.value);
                                        else setPracBotName(e.target.value);
                                    }}
                                    style={{ fontSize: '0.88rem' }}
                                />
                            </div>

                            {/* Bot Avatar URL & Presets */}
                            <div className="mac-form-group" style={{ marginBottom: '1rem' }}>
                                <label className="mac-form-label" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    Imagen de Perfil / Logo (URL o subir archivo)
                                </label>

                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.6rem' }}>
                                    <div style={{
                                        width: '44px',
                                        height: '44px',
                                        borderRadius: '12px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        flexShrink: 0
                                    }}>
                                        <img
                                            src={subTab === 'announcements' ? (annBotAvatar || SCUB_LOGO_URL) : (pracBotAvatar || DTP_LOGO_URL)}
                                            alt="Preview avatar"
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                            onError={(e) => { e.target.src = subTab === 'announcements' ? '/logowebp/SCUB.webp' : '/logowebp/DTP logo.webp'; }}
                                        />
                                    </div>

                                    <input
                                        type="text"
                                        className="mac-form-input"
                                        placeholder="https://... o selecciona un preset"
                                        value={subTab === 'announcements' ? annBotAvatar : pracBotAvatar}
                                        onChange={(e) => {
                                            if (subTab === 'announcements') setAnnBotAvatar(e.target.value);
                                            else setPracBotAvatar(e.target.value);
                                        }}
                                        style={{ fontSize: '0.82rem', flex: 1 }}
                                    />

                                    <label htmlFor={`webhook-avatar-file-${subTab}`} className="mac-btn mac-btn-secondary" style={{ cursor: 'pointer', padding: '0.55rem 0.9rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                        <span>{uploadingAvatar ? 'Subiendo...' : '📁 Subir'}</span>
                                    </label>
                                    <input
                                        id={`webhook-avatar-file-${subTab}`}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleAvatarUpload(e, subTab === 'announcements')}
                                        style={{ display: 'none' }}
                                        disabled={uploadingAvatar}
                                    />
                                </div>

                                {/* Avatar Presets */}
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    {AVATAR_PRESETS.map((preset, idx) => {
                                        const currentAvatar = subTab === 'announcements' ? annBotAvatar : pracBotAvatar;
                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    if (subTab === 'announcements') setAnnBotAvatar(preset.url);
                                                    else setPracBotAvatar(preset.url);
                                                }}
                                                style={{
                                                    padding: '0.3rem 0.65rem',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    border: currentAvatar === preset.url ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                    background: currentAvatar === preset.url ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                                                    color: currentAvatar === preset.url ? '#fbbf24' : '#94a3b8',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {preset.icon} {preset.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* SECTION C: EMBED TEXTS & NOTIFICATION HEADERS */}
                        <div style={{ paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: '#a78bfa', fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>📝</span> Textos de Notificación y Formato
                            </h4>

                            {/* Header announcement text */}
                            <div className="mac-form-group" style={{ marginBottom: '1rem' }}>
                                <label className="mac-form-label" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    Texto de Alerta / Cabecera (Junto a la mención)
                                </label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    placeholder={subTab === 'announcements' ? 'Ej: Nueva publicación en la BBDD de la SCUB' : 'Ej: Convocatoria de Práctica / Instrucción Oficial'}
                                    value={subTab === 'announcements' ? annHeader : pracHeader}
                                    onChange={(e) => {
                                        if (subTab === 'announcements') setAnnHeader(e.target.value);
                                        else setPracHeader(e.target.value);
                                    }}
                                    style={{ fontSize: '0.88rem' }}
                                />
                            </div>

                            {/* Reminder text */}
                            <div className="mac-form-group" style={{ marginBottom: '1rem' }}>
                                <label className="mac-form-label" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    Texto Recordatorio al final (En cursiva)
                                </label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    placeholder={subTab === 'announcements' ? 'Ej: Confirmad lectura en la propia Base de Datos.' : 'Ej: Confirmad asistencia inscribiéndoos en el apartado de Formación.'}
                                    value={subTab === 'announcements' ? annReminder : pracReminder}
                                    onChange={(e) => {
                                        if (subTab === 'announcements') setAnnReminder(e.target.value);
                                        else setPracReminder(e.target.value);
                                    }}
                                    style={{ fontSize: '0.88rem' }}
                                />
                            </div>

                            {/* Footer text */}
                            <div className="mac-form-group" style={{ margin: 0 }}>
                                <label className="mac-form-label" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    Texto del Pie de Página (Footer)
                                </label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    placeholder={subTab === 'announcements' ? 'Ej: SCUB • Sheriff Criminal Unit Bureau' : 'Ej: DTP • Detective Training Program'}
                                    value={subTab === 'announcements' ? annFooter : pracFooter}
                                    onChange={(e) => {
                                        if (subTab === 'announcements') setAnnFooter(e.target.value);
                                        else setPracFooter(e.target.value);
                                    }}
                                    style={{ fontSize: '0.88rem' }}
                                />
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={handleTestWebhook}
                                disabled={testing || !isUrlConfigured}
                                className="mac-btn mac-btn-secondary"
                                style={{
                                    padding: '0.65rem 1.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.85rem'
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="5 3 19 12 5 21 5 3"/>
                                </svg>
                                <span>{testing ? 'Enviando Prueba...' : `Probar Webhook ${subTab === 'announcements' ? 'Anuncios' : 'Prácticas'}`}</span>
                            </button>

                            <button
                                type="submit"
                                disabled={saving}
                                className="mac-btn mac-btn-primary"
                                style={{
                                    padding: '0.65rem 1.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.85rem',
                                    background: subTab === 'announcements' ? 'linear-gradient(135deg, #5865F2, #404EED)' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                                    borderColor: subTab === 'announcements' ? '#5865F2' : '#f59e0b',
                                    boxShadow: subTab === 'announcements' ? '0 4px 14px rgba(88, 101, 242, 0.4)' : '0 4px 14px rgba(245, 158, 11, 0.4)'
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                <span>{saving ? 'Guardando...' : `Guardar Configuración ${subTab === 'announcements' ? 'Anuncios' : 'Prácticas'}`}</span>
                            </button>
                        </div>
                    </form>
                </div>

                {/* Discord Embed Live Preview */}
                <div>
                    <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Previsualización en Vivo de Discord
                        </span>
                        <span style={{ fontSize: '0.75rem', color: subTab === 'announcements' ? '#5865F2' : '#fbbf24', fontWeight: 700 }}>
                            {subTab === 'announcements' ? '#tablón-anuncios' : '#convocatorias-prácticas'}
                        </span>
                    </div>

                    {/* Discord Message Mockup */}
                    <div style={{
                        background: '#313338',
                        borderRadius: '16px',
                        padding: '1.25rem',
                        color: '#dbdee1',
                        fontFamily: 'gg sans, "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
                        border: '1px solid rgba(0, 0, 0, 0.2)',
                        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)'
                    }}>
                        {/* Bot Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '0.75rem' }}>
                            <img
                                src={subTab === 'announcements' ? (annBotAvatar || SCUB_LOGO_URL) : (pracBotAvatar || DTP_LOGO_URL)}
                                alt="Bot Avatar"
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    backgroundColor: '#2b2d31',
                                    objectFit: 'contain',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                                }}
                                onError={(e) => { e.target.src = subTab === 'announcements' ? '/logowebp/SCUB.webp' : '/logowebp/DTP logo.webp'; }}
                            />
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem' }}>
                                        {subTab === 'announcements' ? (annBotName || DEFAULT_BOT_NAME) : (pracBotName || DEFAULT_PRACTICES_BOT_NAME)}
                                    </span>
                                    <span style={{
                                        background: '#5865f2',
                                        color: '#ffffff',
                                        fontSize: '0.62rem',
                                        fontWeight: 800,
                                        padding: '1px 5px',
                                        borderRadius: '4px',
                                        textTransform: 'uppercase'
                                    }}>
                                        APP
                                    </span>
                                    <span style={{ color: '#949ba4', fontSize: '0.75rem', marginLeft: '4px' }}>
                                        Hoy a las {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>

                                {((subTab === 'announcements' && annPing) || (subTab === 'practices' && pracPing)) && (
                                    <div style={{ marginTop: '4px', color: '#c9cdfb', background: 'rgba(88, 101, 242, 0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', fontSize: '0.85rem', fontWeight: 600 }}>
                                        {formatRoleMention(subTab === 'announcements' ? annPing : pracPing)} {subTab === 'announcements' ? '📢' : '🎯'} <strong>{subTab === 'announcements' ? (annHeader || DEFAULT_HEADER_TEXT) : (pracHeader || DEFAULT_PRACTICES_HEADER_TEXT)}</strong>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Embed Card */}
                        <div style={{
                            marginLeft: '52px',
                            background: '#2b2d31',
                            borderLeft: `4px solid ${subTab === 'announcements' ? '#3b82f6' : '#f59e0b'}`,
                            borderRadius: '4px',
                            padding: '0.75rem 1rem',
                            maxWidth: '100%',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}>
                            {/* Author */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <img
                                    src={subTab === 'announcements' ? (annBotAvatar || SCUB_LOGO_URL) : (pracBotAvatar || DTP_LOGO_URL)}
                                    alt="Author avatar"
                                    style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'contain' }}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                                <span style={{ color: '#f2f3f5', fontSize: '0.8rem', fontWeight: 700 }}>
                                    {subTab === 'announcements' ? '[Capitán] Marcus Campbell' : '[Sargento] James Miller (#104)'}
                                </span>
                            </div>

                            {/* Title */}
                            <div style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>
                                {subTab === 'announcements'
                                    ? '📢 Convocatoria de Instrucción Táctica y Balística'
                                    : '🎯 [CONVOCATORIA PRÁCTICA] Instrucción de Tiro & Balística de Combate'}
                            </div>

                            {/* Body */}
                            <div style={{ color: '#dbdee1', fontSize: '0.85rem', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                                {subTab === 'announcements' ? (
                                    <>
                                        Se informa a toda la unidad que este viernes a las 20:00 se llevará a cabo una sesión de actualización en procedimientos balísticos e investigación en escena de crímenes.
                                        {'\n\n'}
                                        • Asistencia obligatoria para auxiliares y detectives.{'\n'}
                                        • Traer equipamiento reglamentario completo.
                                    </>
                                ) : (
                                    <>
                                        Se convoca a todos los aspirantes y detectives a la sesión de instrucción técnica en campo de tiro y análisis de calibres de arma de fuego.
                                    </>
                                )}

                                {subTab === 'practices' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.8rem', background: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px' }}>
                                        <div>
                                            <div style={{ fontSize: '0.72rem', color: '#949ba4', fontWeight: 700 }}>📅 Fecha & Hora</div>
                                            <div style={{ fontSize: '0.82rem', color: '#ffffff', fontWeight: 600 }}>Viernes 26/09 • 20:00</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.72rem', color: '#949ba4', fontWeight: 700 }}>👮 Instructor Principal</div>
                                            <div style={{ fontSize: '0.82rem', color: '#ffffff', fontWeight: 600 }}>James Miller (#104)</div>
                                        </div>
                                    </div>
                                )}

                                {((subTab === 'announcements' && annReminder) || (subTab === 'practices' && pracReminder)) && (
                                    <div style={{ marginTop: '0.75rem' }}>
                                        <em style={{ color: '#949ba4' }}>{subTab === 'announcements' ? annReminder : pracReminder}</em>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', color: '#949ba4', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <img src={subTab === 'announcements' ? (annBotAvatar || SCUB_LOGO_URL) : (pracBotAvatar || DTP_LOGO_URL)} style={{ width: '14px', height: '14px', borderRadius: '50%' }} alt="" />
                                    <span>{subTab === 'announcements' ? (annFooter || DEFAULT_FOOTER_TEXT) : (pracFooter || DEFAULT_PRACTICES_FOOTER_TEXT)}</span>
                                </div>
                                <span>{new Date().toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CoordinationWebhookConfig;
