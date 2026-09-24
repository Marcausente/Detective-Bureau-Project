import { useState, useEffect } from 'react';
import {
    getDiscordWebhookConfig,
    saveDiscordWebhookConfig,
    testDiscordWebhook,
    SCUB_LOGO_URL,
    DEFAULT_BOT_NAME,
    DEFAULT_HEADER_TEXT,
    DEFAULT_FOOTER_TEXT,
    DEFAULT_REMINDER_TEXT
} from '../utils/discordWebhook';
import { uploadImageToStorage } from '../utils/imageStorage';

const AVATAR_PRESETS = [
    { label: 'Logo SCUB', url: SCUB_LOGO_URL, icon: '🛡️' },
    { label: 'Detective Bureau', url: 'https://i.postimg.cc/mD8V4y2N/lspd-badge.png', icon: '🔍' }
];

function CoordinationWebhookConfig() {
    const [webhookUrl, setWebhookUrl] = useState('');
    const [enabled, setEnabled] = useState(false);
    const [rolePing, setRolePing] = useState('');
    const [pingPreset, setPingPreset] = useState('none'); // 'none' | 'everyone' | 'here' | 'custom'

    // Identity Customization States
    const [botName, setBotName] = useState(DEFAULT_BOT_NAME);
    const [botAvatar, setBotAvatar] = useState(SCUB_LOGO_URL);
    const [footerText, setFooterText] = useState(DEFAULT_FOOTER_TEXT);
    const [customHeader, setCustomHeader] = useState(DEFAULT_HEADER_TEXT);
    const [reminderText, setReminderText] = useState(DEFAULT_REMINDER_TEXT);

    const [showUrl, setShowUrl] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const [statusMsg, setStatusMsg] = useState(null); // { type: 'success' | 'error', text: string }

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const cfg = await getDiscordWebhookConfig();
            setWebhookUrl(cfg.webhookUrl || '');
            setEnabled(!!cfg.enabled);
            setRolePing(cfg.rolePing || '');
            setBotName(cfg.botName || DEFAULT_BOT_NAME);
            setBotAvatar(cfg.botAvatar || SCUB_LOGO_URL);
            setFooterText(cfg.footerText || DEFAULT_FOOTER_TEXT);
            setCustomHeader(cfg.customHeader || DEFAULT_HEADER_TEXT);
            setReminderText(cfg.reminderText !== undefined ? cfg.reminderText : DEFAULT_REMINDER_TEXT);

            const ping = (cfg.rolePing || '').trim();
            if (!ping) {
                setPingPreset('none');
            } else if (ping === '@everyone') {
                setPingPreset('everyone');
            } else if (ping === '@here') {
                setPingPreset('here');
            } else {
                setPingPreset('custom');
            }
        } catch (err) {
            console.error('Error loading discord webhook config:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePresetChange = (preset) => {
        setPingPreset(preset);
        if (preset === 'none') {
            setRolePing('');
        } else if (preset === 'everyone') {
            setRolePing('@everyone');
        } else if (preset === 'here') {
            setRolePing('@here');
        }
    };

    const handleAvatarUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingAvatar(true);
        setStatusMsg(null);
        try {
            const publicUrl = await uploadImageToStorage(file, 'system');
            if (publicUrl) {
                setBotAvatar(publicUrl);
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
            if (enabled && (!webhookUrl.trim() || !webhookUrl.trim().startsWith('https://'))) {
                throw new Error('Debes introducir una URL de webhook válida (comenzando con https://) para habilitar el servicio.');
            }

            await saveDiscordWebhookConfig({
                webhookUrl: webhookUrl.trim(),
                enabled,
                rolePing: rolePing.trim(),
                botName: botName.trim() || DEFAULT_BOT_NAME,
                botAvatar: botAvatar.trim() || SCUB_LOGO_URL,
                footerText: footerText.trim() || DEFAULT_FOOTER_TEXT,
                customHeader: customHeader.trim() || DEFAULT_HEADER_TEXT,
                reminderText: reminderText.trim()
            });

            setStatusMsg({
                type: 'success',
                text: 'Configuración de Discord Webhook e Identidad guardadas exitosamente.'
            });
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
        if (!webhookUrl.trim() || !webhookUrl.trim().startsWith('https://')) {
            setStatusMsg({
                type: 'error',
                text: 'Introduce una URL de webhook de Discord válida antes de probar.'
            });
            return;
        }

        setTesting(true);
        setStatusMsg(null);

        try {
            await testDiscordWebhook({
                webhookUrl: webhookUrl.trim(),
                rolePing: rolePing.trim(),
                botName: botName.trim() || DEFAULT_BOT_NAME,
                botAvatar: botAvatar.trim() || SCUB_LOGO_URL,
                footerText: footerText.trim() || DEFAULT_FOOTER_TEXT,
                customHeader: customHeader.trim() || DEFAULT_HEADER_TEXT,
                reminderText: reminderText.trim()
            });
            setStatusMsg({
                type: 'success',
                text: '¡Mensaje de prueba enviado con éxito a Discord con la identidad configurada!'
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

    const isUrlConfigured = !!webhookUrl && webhookUrl.trim().startsWith('https://');

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
            {/* Status Header Bar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem 1.75rem',
                background: isUrlConfigured && enabled
                    ? 'linear-gradient(135deg, rgba(88, 101, 242, 0.15), rgba(15, 23, 42, 0.85))'
                    : 'rgba(15, 23, 42, 0.75)',
                border: isUrlConfigured && enabled ? '1px solid rgba(88, 101, 242, 0.35)' : '1px solid rgba(255, 255, 255, 0.08)',
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
                            src={botAvatar || SCUB_LOGO_URL}
                            alt="Avatar"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            onError={(e) => { e.target.src = '/logowebp/SCUB.webp'; }}
                        />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                Integración Webhook & Identidad Discord
                            </h3>
                            <span style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                background: isUrlConfigured && enabled ? 'rgba(16, 185, 129, 0.2)' : !isUrlConfigured ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                color: isUrlConfigured && enabled ? '#34d399' : !isUrlConfigured ? '#f87171' : '#fbbf24',
                                border: isUrlConfigured && enabled ? '1px solid rgba(16, 185, 129, 0.4)' : !isUrlConfigured ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}>
                                <span style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: isUrlConfigured && enabled ? '#10b981' : !isUrlConfigured ? '#ef4444' : '#f59e0b',
                                    boxShadow: isUrlConfigured && enabled ? '0 0 8px #10b981' : 'none'
                                }}></span>
                                {isUrlConfigured && enabled ? 'Servicio Activo' : !isUrlConfigured ? 'Sin Configurar' : 'Desactivado'}
                            </span>
                        </div>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#94a3b8', fontSize: '0.84rem' }}>
                            Personaliza el nombre de bot, imagen de perfil, avisos y pie de página que se enviarán a tu servidor de Discord.
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
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: enabled ? '#ffffff' : '#94a3b8' }}>
                        {enabled ? 'Envío Automático Activado' : 'Envío Desactivado'}
                    </span>
                    <label style={{ position: 'relative', display: 'inline-block', width: '48px', height: '26px', margin: 0, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) => setEnabled(e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: enabled ? '#5865F2' : 'rgba(255, 255, 255, 0.15)',
                            transition: '0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            borderRadius: '34px',
                            boxShadow: enabled ? '0 0 14px rgba(88, 101, 242, 0.5)' : 'none'
                        }}>
                            <span style={{
                                position: 'absolute',
                                height: '20px',
                                width: '20px',
                                left: enabled ? '24px' : '3px',
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
                            <h4 style={{ margin: '0 0 1rem 0', color: '#60a5fa', fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>🔗</span> Conexión del Webhook
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
                                        value={webhookUrl}
                                        onChange={(e) => setWebhookUrl(e.target.value)}
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
                                        { id: 'custom', label: 'Rol Personalizado' }
                                    ].map(preset => (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => handlePresetChange(preset.id)}
                                            style={{
                                                padding: '0.35rem 0.75rem',
                                                borderRadius: '8px',
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                border: pingPreset === preset.id ? '1px solid rgba(88, 101, 242, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                background: pingPreset === preset.id ? 'rgba(88, 101, 242, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                                                color: pingPreset === preset.id ? '#ffffff' : '#94a3b8',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>

                                {pingPreset === 'custom' && (
                                    <div>
                                        <input
                                            type="text"
                                            className="mac-form-input"
                                            placeholder="Ej: <@&1306619156052967471>"
                                            value={rolePing}
                                            onChange={(e) => setRolePing(e.target.value)}
                                            style={{ fontSize: '0.85rem' }}
                                        />
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
                                    placeholder="Ej: SCUB • Sheriff Criminal Unit Bureau"
                                    value={botName}
                                    onChange={(e) => setBotName(e.target.value)}
                                    style={{ fontSize: '0.88rem' }}
                                />
                            </div>

                            {/* Bot Avatar URL & Presets */}
                            <div className="mac-form-group" style={{ marginBottom: '1rem' }}>
                                <label className="mac-form-label" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    Imagen de Perfil / Logo (URL pública o subir archivo)
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
                                            src={botAvatar || SCUB_LOGO_URL}
                                            alt="Preview avatar"
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                            onError={(e) => { e.target.src = '/logowebp/SCUB.webp'; }}
                                        />
                                    </div>

                                    <input
                                        type="text"
                                        className="mac-form-input"
                                        placeholder="https://... o selecciona un preset"
                                        value={botAvatar}
                                        onChange={(e) => setBotAvatar(e.target.value)}
                                        style={{ fontSize: '0.82rem', flex: 1 }}
                                    />

                                    <label htmlFor="webhook-avatar-file" className="mac-btn mac-btn-secondary" style={{ cursor: 'pointer', padding: '0.55rem 0.9rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                        <span>{uploadingAvatar ? 'Subiendo...' : '📁 Subir'}</span>
                                    </label>
                                    <input
                                        id="webhook-avatar-file"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarUpload}
                                        style={{ display: 'none' }}
                                        disabled={uploadingAvatar}
                                    />
                                </div>

                                {/* Avatar Presets */}
                                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    {AVATAR_PRESETS.map((preset, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setBotAvatar(preset.url)}
                                            style={{
                                                padding: '0.3rem 0.65rem',
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                border: botAvatar === preset.url ? '1px solid rgba(245, 158, 11, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                background: botAvatar === preset.url ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                                                color: botAvatar === preset.url ? '#fbbf24' : '#94a3b8',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {preset.icon} {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* SECTION C: EMBED TEXTS & NOTIFICATION HEADERS */}
                        <div style={{ paddingTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1.5rem' }}>
                            <h4 style={{ margin: '0 0 1rem 0', color: '#a78bfa', fontSize: '0.95rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>📝</span> Textos de Notificación y Embed
                            </h4>

                            {/* Header announcement text */}
                            <div className="mac-form-group" style={{ marginBottom: '1rem' }}>
                                <label className="mac-form-label" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    Texto de Alerta / Cabecera (Junto a la mención)
                                </label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    placeholder="Ej: Nueva publicación en la BBDD de la SCUB"
                                    value={customHeader}
                                    onChange={(e) => setCustomHeader(e.target.value)}
                                    style={{ fontSize: '0.88rem' }}
                                />
                            </div>

                            {/* Reminder text */}
                            <div className="mac-form-group" style={{ marginBottom: '1rem' }}>
                                <label className="mac-form-label" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    Texto Recordatorio al final del Anuncio (En cursiva)
                                </label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    placeholder="Ej: Confirmad lectura en la propia Base de Datos."
                                    value={reminderText}
                                    onChange={(e) => setReminderText(e.target.value)}
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
                                    placeholder="Ej: SCUB • Sheriff Criminal Unit Bureau"
                                    value={footerText}
                                    onChange={(e) => setFooterText(e.target.value)}
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
                                <span>{testing ? 'Enviando Prueba...' : 'Probar Webhook'}</span>
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
                                    background: 'linear-gradient(135deg, #5865F2, #404EED)',
                                    borderColor: '#5865F2',
                                    boxShadow: '0 4px 14px rgba(88, 101, 242, 0.4)'
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
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
                        <span style={{ fontSize: '0.75rem', color: '#5865F2', fontWeight: 700 }}>
                            #tablón
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
                                src={botAvatar || SCUB_LOGO_URL}
                                alt="Bot Avatar"
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    backgroundColor: '#2b2d31',
                                    objectFit: 'contain',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                                }}
                                onError={(e) => { e.target.src = '/logowebp/SCUB.webp'; }}
                            />
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem' }}>
                                        {botName || DEFAULT_BOT_NAME}
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

                                {rolePing && (
                                    <div style={{ marginTop: '4px', color: '#c9cdfb', background: 'rgba(88, 101, 242, 0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', fontSize: '0.85rem', fontWeight: 600 }}>
                                        {rolePing} 📢 <strong>{customHeader || DEFAULT_HEADER_TEXT}</strong>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Embed Card */}
                        <div style={{
                            marginLeft: '52px',
                            background: '#2b2d31',
                            borderLeft: '4px solid #3b82f6',
                            borderRadius: '4px',
                            padding: '0.75rem 1rem',
                            maxWidth: '100%',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}>
                            {/* Author */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <img
                                    src={botAvatar || SCUB_LOGO_URL}
                                    alt="Author avatar"
                                    style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'contain' }}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                />
                                <span style={{ color: '#f2f3f5', fontSize: '0.8rem', fontWeight: 700 }}>
                                    [Capitán] Marcus Campbell
                                </span>
                            </div>

                            {/* Title */}
                            <div style={{ color: '#ffffff', fontSize: '1rem', fontWeight: 700, marginBottom: '8px' }}>
                                📢 Convocatoria de Instrucción Táctica y Balística
                            </div>

                            {/* Body */}
                            <div style={{ color: '#dbdee1', fontSize: '0.85rem', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                                Se informa a toda la unidad que este viernes a las 20:00 se llevará a cabo una sesión de actualización en procedimientos balísticos e investigación en escena de crímenes.
                                {'\n\n'}
                                • Asistencia obligatoria para auxiliares y detectives.{'\n'}
                                • Traer equipamiento reglamentario completo.
                                {reminderText && (
                                    <>
                                        {'\n\n'}
                                        <em style={{ color: '#949ba4' }}>{reminderText}</em>
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', color: '#949ba4', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <img src={botAvatar || SCUB_LOGO_URL} style={{ width: '14px', height: '14px', borderRadius: '50%' }} alt="" />
                                    <span>{footerText || DEFAULT_FOOTER_TEXT}</span>
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
