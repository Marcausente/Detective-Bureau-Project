import { useState, useEffect } from 'react';
import {
    getDiscordWebhookConfig,
    saveDiscordWebhookConfig,
    testDiscordWebhook,
    getDiscordEventsWebhookConfig,
    saveDiscordEventsWebhookConfig,
    testDiscordEventsWebhook,
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
    DEFAULT_EVENTS_BOT_NAME,
    DEFAULT_EVENTS_HEADER_TEXT,
    DEFAULT_EVENTS_FOOTER_TEXT,
    DEFAULT_EVENTS_REMINDER_TEXT,
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
    const [subTab, setSubTab] = useState('announcements'); // 'announcements' | 'events' | 'practices'

    // 1. Announcements States
    const [annUrl, setAnnUrl] = useState('');
    const [annEnabled, setAnnEnabled] = useState(false);
    const [annPing, setAnnPing] = useState('');
    const [annPingPreset, setAnnPingPreset] = useState('none');
    const [annBotName, setAnnBotName] = useState(DEFAULT_BOT_NAME);
    const [annBotAvatar, setAnnBotAvatar] = useState(SCUB_LOGO_URL);
    const [annFooter, setAnnFooter] = useState(DEFAULT_FOOTER_TEXT);
    const [annHeader, setAnnHeader] = useState(DEFAULT_HEADER_TEXT);
    const [annReminder, setAnnReminder] = useState(DEFAULT_REMINDER_TEXT);

    // 2. Calendar Events States
    const [eventUrl, setEventUrl] = useState('');
    const [eventEnabled, setEventEnabled] = useState(false);
    const [eventPing, setEventPing] = useState('');
    const [eventPingPreset, setEventPingPreset] = useState('none');
    const [eventBotName, setEventBotName] = useState(DEFAULT_EVENTS_BOT_NAME);
    const [eventBotAvatar, setEventBotAvatar] = useState(SCUB_LOGO_URL);
    const [eventFooter, setEventFooter] = useState(DEFAULT_EVENTS_FOOTER_TEXT);
    const [eventHeader, setEventHeader] = useState(DEFAULT_EVENTS_HEADER_TEXT);
    const [eventReminder, setEventReminder] = useState(DEFAULT_EVENTS_REMINDER_TEXT);

    // 3. Practices (DTP) States
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
            const [annCfg, evCfg, pracCfg] = await Promise.all([
                getDiscordWebhookConfig(),
                getDiscordEventsWebhookConfig(),
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

            // Set Events
            setEventUrl(evCfg.webhookUrl || '');
            setEventEnabled(!!evCfg.enabled);
            setEventPing(evCfg.rolePing || '');
            setEventBotName(evCfg.botName || DEFAULT_EVENTS_BOT_NAME);
            setEventBotAvatar(evCfg.botAvatar || SCUB_LOGO_URL);
            setEventFooter(evCfg.footerText || DEFAULT_EVENTS_FOOTER_TEXT);
            setEventHeader(evCfg.customHeader || DEFAULT_EVENTS_HEADER_TEXT);
            setEventReminder(evCfg.reminderText !== undefined ? evCfg.reminderText : DEFAULT_EVENTS_REMINDER_TEXT);

            const ePing = (evCfg.rolePing || '').trim();
            if (!ePing) setEventPingPreset('none');
            else if (ePing === '@everyone') setEventPingPreset('everyone');
            else if (ePing === '@here') setEventPingPreset('here');
            else setEventPingPreset('custom');

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

    const handlePingPresetChange = (preset, targetTab = subTab) => {
        if (targetTab === 'announcements') {
            setAnnPingPreset(preset);
            if (preset === 'none') setAnnPing('');
            else if (preset === 'everyone') setAnnPing('@everyone');
            else if (preset === 'here') setAnnPing('@here');
        } else if (targetTab === 'events') {
            setEventPingPreset(preset);
            if (preset === 'none') setEventPing('');
            else if (preset === 'everyone') setEventPing('@everyone');
            else if (preset === 'here') setEventPing('@here');
        } else {
            setPracPingPreset(preset);
            if (preset === 'none') setPracPing('');
            else if (preset === 'everyone') setPracPing('@everyone');
            else if (preset === 'here') setPracPing('@here');
        }
    };

    const handleAvatarUpload = async (e, targetTab = subTab) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingAvatar(true);
        setStatusMsg(null);
        try {
            const publicUrl = await uploadImageToStorage(file, 'system');
            if (publicUrl) {
                if (targetTab === 'announcements') setAnnBotAvatar(publicUrl);
                else if (targetTab === 'events') setEventBotAvatar(publicUrl);
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
            } else if (subTab === 'events') {
                if (eventEnabled && (!eventUrl.trim() || !eventUrl.trim().startsWith('https://'))) {
                    throw new Error('Debes introducir una URL de webhook válida para habilitar el servicio de Eventos.');
                }

                await saveDiscordEventsWebhookConfig({
                    webhookUrl: eventUrl.trim(),
                    enabled: eventEnabled,
                    rolePing: eventPing.trim(),
                    botName: eventBotName.trim() || DEFAULT_EVENTS_BOT_NAME,
                    botAvatar: eventBotAvatar.trim() || SCUB_LOGO_URL,
                    footerText: eventFooter.trim() || DEFAULT_EVENTS_FOOTER_TEXT,
                    customHeader: eventHeader.trim() || DEFAULT_EVENTS_HEADER_TEXT,
                    reminderText: eventReminder.trim()
                });

                setStatusMsg({
                    type: 'success',
                    text: 'Configuración de Webhook de Eventos guardada exitosamente.'
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
        let targetUrl = '';
        if (subTab === 'announcements') targetUrl = annUrl.trim();
        else if (subTab === 'events') targetUrl = eventUrl.trim();
        else targetUrl = pracUrl.trim();

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
            if (subTab === 'announcements') {
                await testDiscordWebhook({
                    webhookUrl: annUrl.trim(),
                    rolePing: annPing.trim(),
                    botName: annBotName.trim() || DEFAULT_BOT_NAME,
                    botAvatar: annBotAvatar.trim() || SCUB_LOGO_URL,
                    footerText: annFooter.trim() || DEFAULT_FOOTER_TEXT,
                    customHeader: annHeader.trim() || DEFAULT_HEADER_TEXT,
                    reminderText: annReminder.trim()
                });
            } else if (subTab === 'events') {
                await testDiscordEventsWebhook({
                    webhookUrl: eventUrl.trim(),
                    rolePing: eventPing.trim(),
                    botName: eventBotName.trim() || DEFAULT_EVENTS_BOT_NAME,
                    botAvatar: eventBotAvatar.trim() || SCUB_LOGO_URL,
                    footerText: eventFooter.trim() || DEFAULT_EVENTS_FOOTER_TEXT,
                    customHeader: eventHeader.trim() || DEFAULT_EVENTS_HEADER_TEXT,
                    reminderText: eventReminder.trim()
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

    // Current Active Tab Values
    const currentUrl = subTab === 'announcements' ? annUrl : subTab === 'events' ? eventUrl : pracUrl;
    const currentEnabled = subTab === 'announcements' ? annEnabled : subTab === 'events' ? eventEnabled : pracEnabled;
    const currentPing = subTab === 'announcements' ? annPing : subTab === 'events' ? eventPing : pracPing;
    const currentPingPreset = subTab === 'announcements' ? annPingPreset : subTab === 'events' ? eventPingPreset : pracPingPreset;
    const currentBotName = subTab === 'announcements' ? annBotName : subTab === 'events' ? eventBotName : pracBotName;
    const currentBotAvatar = subTab === 'announcements' ? annBotAvatar : subTab === 'events' ? eventBotAvatar : pracBotAvatar;
    const currentFooter = subTab === 'announcements' ? annFooter : subTab === 'events' ? eventFooter : pracFooter;
    const currentHeader = subTab === 'announcements' ? annHeader : subTab === 'events' ? eventHeader : pracHeader;
    const currentReminder = subTab === 'announcements' ? annReminder : subTab === 'events' ? eventReminder : pracReminder;

    const isUrlConfigured = !!currentUrl && currentUrl.trim().startsWith('https://');

    // Theme color accent for each tab
    const tabAccentColor = subTab === 'announcements' ? '#5865F2' : subTab === 'events' ? '#10B981' : '#F59E0B';
    const tabBadgeBg = subTab === 'announcements' ? 'rgba(88, 101, 242, 0.25)' : subTab === 'events' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)';
    const tabBorder = subTab === 'announcements' ? 'rgba(88, 101, 242, 0.4)' : subTab === 'events' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)';

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
            {/* Top Sub-tabs Switcher: Announcements vs Events vs Practices */}
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
                    onClick={() => setSubTab('events')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.55rem 1.25rem',
                        borderRadius: '10px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        border: subTab === 'events' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid transparent',
                        background: subTab === 'events' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                        color: subTab === 'events' ? '#ffffff' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    <span>📅</span>
                    <span>Eventos del Calendario</span>
                    {eventEnabled && eventUrl && (
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
                    ? `linear-gradient(135deg, ${tabBadgeBg}, rgba(15, 23, 42, 0.85))`
                    : 'rgba(15, 23, 42, 0.75)',
                border: isUrlConfigured && currentEnabled
                    ? `1px solid ${tabBorder}`
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
                            src={currentBotAvatar || SCUB_LOGO_URL}
                            alt="Avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            onError={(e) => { e.target.src = '/logowebp/SCUB.webp'; }}
                        />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                {subTab === 'announcements' ? 'Webhook para Anuncios Oficiales (Tablón)' : subTab === 'events' ? 'Webhook para Eventos y Operativos del Calendario' : 'Webhook para Prácticas e Instrucción DTP'}
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
                                : subTab === 'events'
                                ? 'Avisa y publica automáticamente convocatorias de reuniones y eventos programados en el Calendario.'
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
                                else if (subTab === 'events') setEventEnabled(e.target.checked);
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
                            backgroundColor: currentEnabled ? tabAccentColor : 'rgba(255,255,255,0.15)',
                            transition: '0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            borderRadius: '34px'
                        }}>
                            <span style={{
                                position: 'absolute',
                                content: '""',
                                height: '20px',
                                width: '20px',
                                left: currentEnabled ? '24px' : '3px',
                                bottom: '3px',
                                backgroundColor: 'white',
                                transition: '0.25s cubic-bezier(0.4, 0, 0.2, 1)',
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
                    animation: 'fadeIn 0.2s ease-in-out'
                }}>
                    <span>{statusMsg.type === 'success' ? '✅' : '⚠️'}</span>
                    <span>{statusMsg.text}</span>
                </div>
            )}

            {/* Main Configuration Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '1.75rem', alignItems: 'start' }}>
                {/* Left Column: Form Settings */}
                <form onSubmit={handleSave} className="mac-glass-card" style={{ padding: '1.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.85rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>⚙️</span>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#ffffff', fontWeight: 800 }}>
                            {subTab === 'announcements' ? 'Parámetros del Webhook de Anuncios' : subTab === 'events' ? 'Parámetros del Webhook de Eventos' : 'Parámetros del Webhook de Prácticas (DTP)'}
                        </h4>
                    </div>

                    {/* Webhook URL */}
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <label className="form-label" style={{ margin: 0, fontWeight: 700, color: '#e2e8f0', fontSize: '0.84rem' }}>
                                URL del Webhook de Discord <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowUrl(!showUrl)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#38bdf8',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    padding: 0
                                }}
                            >
                                {showUrl ? 'Ocultar URL' : 'Mostrar URL'}
                            </button>
                        </div>
                        <input
                            type={showUrl ? 'text' : 'password'}
                            className="form-input"
                            value={currentUrl}
                            onChange={(e) => {
                                if (subTab === 'announcements') setAnnUrl(e.target.value);
                                else if (subTab === 'events') setEventUrl(e.target.value);
                                else setPracUrl(e.target.value);
                            }}
                            placeholder="https://discord.com/api/webhooks/1234567890/abcde..."
                            style={{ fontFamily: showUrl ? 'monospace' : 'inherit', fontSize: '0.85rem' }}
                        />
                        <span style={{ fontSize: '0.74rem', color: '#64748b', display: 'block', marginTop: '0.35rem' }}>
                            Canal de Discord &gt; Ajustes del Canal &gt; Integraciones &gt; Webhooks &gt; Copiar URL.
                        </span>
                    </div>

                    {/* Role Ping Selector & Custom formatting */}
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                        <label className="form-label" style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.84rem' }}>
                            Mención de Rol / Notificación
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                            {[
                                { id: 'none', label: 'Sin mención' },
                                { id: 'everyone', label: '@everyone' },
                                { id: 'here', label: '@here' },
                                { id: 'custom', label: 'ID de Rol' }
                            ].map(preset => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => handlePingPresetChange(preset.id)}
                                    style={{
                                        padding: '0.35rem 0.85rem',
                                        borderRadius: '8px',
                                        fontSize: '0.76rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        border: currentPingPreset === preset.id ? `1px solid ${tabAccentColor}` : '1px solid rgba(255,255,255,0.1)',
                                        background: currentPingPreset === preset.id ? tabBadgeBg : 'rgba(255,255,255,0.03)',
                                        color: currentPingPreset === preset.id ? '#ffffff' : '#94a3b8',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        <input
                            type="text"
                            className="form-input"
                            value={currentPing}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (subTab === 'announcements') {
                                    setAnnPing(val);
                                    if (val === '@everyone') setAnnPingPreset('everyone');
                                    else if (val === '@here') setAnnPingPreset('here');
                                    else if (!val) setAnnPingPreset('none');
                                    else setAnnPingPreset('custom');
                                } else if (subTab === 'events') {
                                    setEventPing(val);
                                    if (val === '@everyone') setEventPingPreset('everyone');
                                    else if (val === '@here') setEventPingPreset('here');
                                    else if (!val) setEventPingPreset('none');
                                    else setEventPingPreset('custom');
                                } else {
                                    setPracPing(val);
                                    if (val === '@everyone') setPracPingPreset('everyone');
                                    else if (val === '@here') setPracPingPreset('here');
                                    else if (!val) setPracPingPreset('none');
                                    else setPracPingPreset('custom');
                                }
                            }}
                            placeholder="Ej: 1306619156052967471 o @everyone"
                            style={{ fontSize: '0.85rem' }}
                        />
                        {currentPing && (
                            <span style={{ fontSize: '0.74rem', color: '#10b981', display: 'block', marginTop: '0.35rem' }}>
                                Formato detectado: <strong style={{ color: '#34d399' }}>{formatRoleMention(currentPing)}</strong> (Notificará con ping directo al rol en Discord)
                            </span>
                        )}
                    </div>

                    {/* Bot Name & Avatar URL Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.84rem' }}>
                                Nombre del Bot
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={currentBotName}
                                onChange={(e) => {
                                    if (subTab === 'announcements') setAnnBotName(e.target.value);
                                    else if (subTab === 'events') setEventBotName(e.target.value);
                                    else setPracBotName(e.target.value);
                                }}
                                placeholder={subTab === 'announcements' ? DEFAULT_BOT_NAME : subTab === 'events' ? DEFAULT_EVENTS_BOT_NAME : DEFAULT_PRACTICES_BOT_NAME}
                                style={{ fontSize: '0.85rem' }}
                            />
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.84rem' }}>
                                URL del Avatar / Logo
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={currentBotAvatar}
                                onChange={(e) => {
                                    if (subTab === 'announcements') setAnnBotAvatar(e.target.value);
                                    else if (subTab === 'events') setEventBotAvatar(e.target.value);
                                    else setPracBotAvatar(e.target.value);
                                }}
                                placeholder="https://..."
                                style={{ fontSize: '0.85rem' }}
                            />
                        </div>
                    </div>

                    {/* Avatar Preset Badges & File Upload */}
                    <div style={{ marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', padding: '0.85rem', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.5rem' }}>
                            Logos Oficiales Rápidos:
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {AVATAR_PRESETS.map((p, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        if (subTab === 'announcements') setAnnBotAvatar(p.url);
                                        else if (subTab === 'events') setEventBotAvatar(p.url);
                                        else setPracBotAvatar(p.url);
                                    }}
                                    style={{
                                        padding: '0.3rem 0.65rem',
                                        borderRadius: '8px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        background: currentBotAvatar === p.url ? tabBadgeBg : 'rgba(255, 255, 255, 0.05)',
                                        border: currentBotAvatar === p.url ? `1px solid ${tabAccentColor}` : '1px solid rgba(255, 255, 255, 0.1)',
                                        color: currentBotAvatar === p.url ? '#ffffff' : '#cbd5e1',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    <span>{p.icon}</span>
                                    <span>{p.label}</span>
                                </button>
                            ))}

                            {/* Upload Custom Image Button */}
                            <label style={{
                                padding: '0.3rem 0.75rem',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                background: 'rgba(56, 189, 248, 0.15)',
                                border: '1px solid rgba(56, 189, 248, 0.35)',
                                color: '#38bdf8',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                margin: 0
                            }}>
                                <span>📤</span>
                                <span>{uploadingAvatar ? 'Subiendo...' : 'Subir Imagen Local'}</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarUpload}
                                    disabled={uploadingAvatar}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Custom Header & Footer Texts */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.84rem' }}>
                                Cabecera del Mensaje
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={currentHeader}
                                onChange={(e) => {
                                    if (subTab === 'announcements') setAnnHeader(e.target.value);
                                    else if (subTab === 'events') setEventHeader(e.target.value);
                                    else setPracHeader(e.target.value);
                                }}
                                placeholder={subTab === 'announcements' ? DEFAULT_HEADER_TEXT : subTab === 'events' ? DEFAULT_EVENTS_HEADER_TEXT : DEFAULT_PRACTICES_HEADER_TEXT}
                                style={{ fontSize: '0.85rem' }}
                            />
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.84rem' }}>
                                Pie de Página del Embed
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={currentFooter}
                                onChange={(e) => {
                                    if (subTab === 'announcements') setAnnFooter(e.target.value);
                                    else if (subTab === 'events') setEventFooter(e.target.value);
                                    else setPracFooter(e.target.value);
                                }}
                                placeholder={subTab === 'announcements' ? DEFAULT_FOOTER_TEXT : subTab === 'events' ? DEFAULT_EVENTS_FOOTER_TEXT : DEFAULT_PRACTICES_FOOTER_TEXT}
                                style={{ fontSize: '0.85rem' }}
                            />
                        </div>
                    </div>

                    {/* Reminder text */}
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label" style={{ fontWeight: 700, color: '#e2e8f0', fontSize: '0.84rem' }}>
                            Texto de Recordatorio al final del mensaje
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            value={currentReminder}
                            onChange={(e) => {
                                if (subTab === 'announcements') setAnnReminder(e.target.value);
                                else if (subTab === 'events') setEventReminder(e.target.value);
                                else setPracReminder(e.target.value);
                            }}
                            placeholder={subTab === 'announcements' ? DEFAULT_REMINDER_TEXT : subTab === 'events' ? DEFAULT_EVENTS_REMINDER_TEXT : DEFAULT_PRACTICES_REMINDER_TEXT}
                            style={{ fontSize: '0.85rem' }}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.25rem' }}>
                        <button
                            type="button"
                            className="mac-btn mac-btn-secondary"
                            onClick={handleTestWebhook}
                            disabled={testing || !isUrlConfigured}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                opacity: !isUrlConfigured ? 0.5 : 1
                            }}
                        >
                            <span>{testing ? '⏳' : '🔔'}</span>
                            <span>{testing ? 'Enviando Prueba...' : 'Enviar Mensaje de Prueba'}</span>
                        </button>

                        <button
                            type="submit"
                            className="mac-btn mac-btn-primary"
                            disabled={saving}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: tabAccentColor
                            }}
                        >
                            <span>{saving ? '⏳' : '💾'}</span>
                            <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
                        </button>
                    </div>
                </form>

                {/* Right Column: Interactive Discord Live Preview */}
                <div className="mac-glass-card" style={{ padding: '1.75rem', background: '#313338', border: '1px solid #1e1f22' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>👁️</span>
                            <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#dbdee1', fontWeight: 700 }}>
                                Vista Previa en Vivo (Discord)
                            </h4>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: '#949ba4', fontWeight: 600, background: '#2b2d31', padding: '2px 8px', borderRadius: '6px' }}>
                            #tablon-avisos
                        </span>
                    </div>

                    {/* Discord Message Layout */}
                    <div style={{ display: 'flex', gap: '1rem', fontFamily: '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
                        {/* Avatar */}
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', background: '#1e1f22', flexShrink: 0 }}>
                            <img
                                src={currentBotAvatar || SCUB_LOGO_URL}
                                alt="Bot Avatar"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.target.src = '/logowebp/SCUB.webp'; }}
                            />
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Bot Name and App Badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
                                <span style={{ color: '#f2f3f5', fontWeight: 600, fontSize: '0.95rem' }}>
                                    {currentBotName || (subTab === 'announcements' ? DEFAULT_BOT_NAME : subTab === 'events' ? DEFAULT_EVENTS_BOT_NAME : DEFAULT_PRACTICES_BOT_NAME)}
                                </span>
                                <span style={{
                                    backgroundColor: '#5865F2',
                                    color: '#ffffff',
                                    fontSize: '0.625rem',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    fontWeight: 600,
                                    lineHeight: '1.2'
                                }}>
                                    APP
                                </span>
                                <span style={{ color: '#949ba4', fontSize: '0.72rem', marginLeft: '0.25rem' }}>
                                    Hoy a las 20:00
                                </span>
                            </div>

                            {/* Role Ping Header */}
                            {currentPing && (
                                <div style={{ color: '#dbdee1', fontSize: '0.92rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                                    <span style={{ background: 'rgba(88, 101, 242, 0.3)', color: '#c9cdfb', padding: '0 4px', borderRadius: '3px', fontWeight: 500, fontSize: '0.85rem' }}>
                                        {formatRoleMention(currentPing)}
                                    </span>
                                    <strong style={{ color: '#ffffff' }}>
                                        {currentHeader || (subTab === 'announcements' ? DEFAULT_HEADER_TEXT : subTab === 'events' ? DEFAULT_EVENTS_HEADER_TEXT : DEFAULT_PRACTICES_HEADER_TEXT)}
                                    </strong>
                                </div>
                            )}

                            {/* Embed Card */}
                            <div style={{
                                backgroundColor: '#2b2d31',
                                borderLeft: `4px solid ${tabAccentColor}`,
                                borderRadius: '4px',
                                padding: '0.85rem 1rem',
                                maxWidth: '520px',
                                boxShadow: '0 1px 0 rgba(4,4,5,0.2),0 1.5px 0 rgba(6,6,7,0.05),0 2px 0 rgba(4,4,5,0.05)'
                            }}>
                                {/* Embed Author */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', overflow: 'hidden', background: '#1e1f22' }}>
                                        <img src={currentBotAvatar || SCUB_LOGO_URL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <span style={{ color: '#f2f3f5', fontSize: '0.8rem', fontWeight: 600 }}>
                                        {subTab === 'announcements' ? '[Teniente] Matthew Kleiner' : subTab === 'events' ? '[Teniente] Matthew Kleiner' : '[Sargento] James Miller (#104)'}
                                    </span>
                                </div>

                                {/* Embed Title */}
                                <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.5rem' }}>
                                    {subTab === 'announcements'
                                        ? '📢 Revisión de Informes y Casos de la Unidad'
                                        : subTab === 'events'
                                        ? '📅 [EVENTO / OPERATIVO] Briefing General de Seguridad'
                                        : '🎯 [PRÁCTICA DTP] Instrucción de Tiro & Balística de Combate'}
                                </div>

                                {/* Embed Description */}
                                <div style={{ color: '#dbdee1', fontSize: '0.84rem', lineHeight: '1.4', whiteSpace: 'pre-line', marginBottom: '0.75rem' }}>
                                    {subTab === 'announcements' ? (
                                        <>
                                            A partir de este momento, la revisión de informes será realizada por el personal asignado a cada división.
                                            {currentReminder && <div style={{ marginTop: '0.5rem', fontStyle: 'italic', color: '#949ba4' }}>{currentReminder}</div>}
                                        </>
                                    ) : subTab === 'events' ? (
                                        <>
                                            Reunión operativa y coordinación táctica en sala de juntas para el despliegue del fin de semana.
                                            {currentReminder && <div style={{ marginTop: '0.5rem', fontStyle: 'italic', color: '#949ba4' }}>{currentReminder}</div>}
                                        </>
                                    ) : (
                                        <>
                                            Se convoca a los aspirantes e instructores a la sesión práctica en campo de tiro.
                                            {currentReminder && <div style={{ marginTop: '0.5rem', fontStyle: 'italic', color: '#949ba4' }}>{currentReminder}</div>}
                                        </>
                                    )}
                                </div>

                                {/* Embed Fields (For Events & Practices) */}
                                {subTab === 'events' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.6rem', fontSize: '0.8rem' }}>
                                        <div>
                                            <div style={{ color: '#949ba4', fontWeight: 600 }}>📅 Fecha y Hora</div>
                                            <div style={{ color: '#f2f3f5' }}>Sábado 27/09/2026 • 21:30</div>
                                        </div>
                                        <div>
                                            <div style={{ color: '#949ba4', fontWeight: 600 }}>👤 Organizado por</div>
                                            <div style={{ color: '#f2f3f5' }}>[Teniente] Matthew Kleiner</div>
                                        </div>
                                    </div>
                                )}

                                {subTab === 'practices' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.6rem', fontSize: '0.8rem' }}>
                                        <div>
                                            <div style={{ color: '#949ba4', fontWeight: 600 }}>📅 Fecha & Hora</div>
                                            <div style={{ color: '#f2f3f5' }}>Viernes 26/09/2026 • 20:00</div>
                                        </div>
                                        <div>
                                            <div style={{ color: '#949ba4', fontWeight: 600 }}>👮 Instructor Principal</div>
                                            <div style={{ color: '#f2f3f5' }}>James Miller (#104)</div>
                                        </div>
                                    </div>
                                )}

                                {/* Embed Footer */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.5rem', fontSize: '0.72rem', color: '#949ba4' }}>
                                    <img src={currentBotAvatar || SCUB_LOGO_URL} alt="" style={{ width: '14px', height: '14px', borderRadius: '50%' }} />
                                    <span>{currentFooter || (subTab === 'announcements' ? DEFAULT_FOOTER_TEXT : subTab === 'events' ? DEFAULT_EVENTS_FOOTER_TEXT : DEFAULT_PRACTICES_FOOTER_TEXT)}</span>
                                    <span>•</span>
                                    <span>Hoy a las 20:00</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CoordinationWebhookConfig;
