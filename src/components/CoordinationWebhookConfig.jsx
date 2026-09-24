import { useState, useEffect } from 'react';
import { getDiscordWebhookConfig, saveDiscordWebhookConfig, testDiscordWebhook } from '../utils/discordWebhook';

function CoordinationWebhookConfig() {
    const [webhookUrl, setWebhookUrl] = useState('');
    const [enabled, setEnabled] = useState(false);
    const [rolePing, setRolePing] = useState('');
    const [pingPreset, setPingPreset] = useState('none'); // 'none' | 'everyone' | 'here' | 'custom'

    const [showUrl, setShowUrl] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

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
                rolePing: rolePing.trim()
            });

            setStatusMsg({
                type: 'success',
                text: 'Configuración de Discord Webhook guardada exitosamente.'
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
            await testDiscordWebhook(webhookUrl.trim(), rolePing.trim());
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
                        width: '46px',
                        height: '46px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #5865F2, #4752C4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        boxShadow: '0 6px 20px rgba(88, 101, 242, 0.4)',
                        flexShrink: 0
                    }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                        </svg>
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                Integración Webhook de Discord
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
                            Retransmite automáticamente cualquier comunicado o anuncio oficial publicado en el Dashboard directamente al canal de Discord de tu servidor.
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

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.5rem' }}>
                {/* Configuration Form Panel */}
                <div className="mac-profile-panel" style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                    borderRadius: '20px',
                    padding: '1.75rem',
                    backdropFilter: 'blur(20px)'
                }}>
                    <h3 style={{ margin: '0 0 1.25rem 0', color: '#ffffff', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5865F2" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        </svg>
                        Parámetros del Webhook
                    </h3>

                    <form onSubmit={handleSave}>
                        {/* Webhook URL Input */}
                        <div className="mac-form-group" style={{ marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <label className="mac-form-label" style={{ margin: 0, fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0' }}>
                                    URL del Webhook de Discord *
                                </label>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    Canal de Discord &gt; Editar Canal &gt; Integraciones &gt; Webhooks
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
                        <div className="mac-form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="mac-form-label" style={{ fontSize: '0.84rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                Mención / Ping de Notificación (Opcional)
                            </label>
                            
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
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
                                            padding: '0.4rem 0.85rem',
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
                                        placeholder="Ej: <@&1029384756> o @NombreRol"
                                        value={rolePing}
                                        onChange={(e) => setRolePing(e.target.value)}
                                        style={{ fontSize: '0.85rem' }}
                                    />
                                    <p style={{ margin: '0.3rem 0 0 0', color: '#64748b', fontSize: '0.75rem' }}>
                                        💡 Para mencionar un rol en Discord, usa el formato <code>&lt;@&amp;ID_DEL_ROL&gt;</code>.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Instructions Box */}
                        <div style={{
                            background: 'rgba(88, 101, 242, 0.07)',
                            border: '1px solid rgba(88, 101, 242, 0.2)',
                            borderRadius: '12px',
                            padding: '1rem',
                            marginBottom: '1.5rem',
                            fontSize: '0.8rem',
                            color: '#cbd5e1',
                            lineHeight: 1.5
                        }}>
                            <div style={{ fontWeight: 700, color: '#818cf8', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span>📖</span> ¿Cómo obtener la URL de Webhook en Discord?
                            </div>
                            <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#94a3b8' }}>
                                <li>En Discord, ve al canal donde desees recibir los anuncios y pulsa en la rueda dentada (<strong>Editar canal</strong>).</li>
                                <li>Ve a la pestaña <strong>Integraciones</strong> &gt; <strong>Webhooks</strong> &gt; <strong>Nuevo Webhook</strong>.</li>
                                <li>Asigna el nombre deseado (ej: <em>Detective Bureau Anuncios</em>) y pulsa en <strong>Copiar URL del Webhook</strong>.</li>
                                <li>Pégala en el campo superior, activa el servicio y pulsa en <strong>Guardar Cambios</strong>.</li>
                            </ol>
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
                            Previsualización en Discord
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#5865F2', fontWeight: 700 }}>
                            Canal de Texto #anuncios
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
                                src="https://i.postimg.cc/mD8V4y2N/lspd-badge.png"
                                alt="Bot Avatar"
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    backgroundColor: '#2b2d31',
                                    objectFit: 'contain'
                                }}
                                onError={(e) => { e.target.style.display = 'none'; }}
                            />
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ color: '#ffffff', fontWeight: 700, fontSize: '0.95rem' }}>
                                        Detective Bureau • Dashboard Announcements
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
                                        {rolePing} 📢 <strong>Nuevo Anuncio publicado en el Dashboard</strong>
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
                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
                                    👮
                                </div>
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
                                Se informa a toda la división que este viernes a las 20:00 se llevará a cabo una sesión de actualización en procedimientos balísticos e investigación en escena de crímenes.
                                {'\n\n'}
                                • Asistencia obligatoria para auxiliares y detectives.{'\n'}
                                • Traer equipamiento reglamentario completo.
                            </div>

                            {/* Footer */}
                            <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', color: '#949ba4', fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span>Detective Bureau • Portal de Anuncios del Dashboard</span>
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
