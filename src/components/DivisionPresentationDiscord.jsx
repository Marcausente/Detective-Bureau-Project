import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { uploadImageToStorage } from '../utils/imageStorage';
import {
    SCUB_LOGO_URL,
    IA_LOGO_URL,
    DEFAULT_DIVISION_PRESENTATIONS,
    getDivisionPresentationConfig,
    saveDivisionPresentationConfig,
    testDivisionPresentationWebhook,
    sendDivisionPresentationToDiscord,
    normalizeDiscordImageUrl
} from '../utils/discordWebhook';
import '../index.css';

const DIVISION_OPTIONS = [
    { key: 'coordination', label: 'Coordinación', icon: '⚜️', color: '#C5A059' },
    { key: 'seb', label: 'SEB', icon: '🦇', color: '#EAB308' },
    { key: 'asd', label: 'ASD', icon: '🚁', color: '#0284C7' },
    { key: 'ia', label: 'Asuntos Internos (IA)', icon: '⚖️', color: '#E11D48' }
];

export default function DivisionPresentationDiscord({ division = 'coordination', standalone = false }) {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const { isLSSD, branding } = useTheme();

    const selectedDivision = division || 'coordination';
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [testing, setTesting] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);

    // Form fields
    const [webhookUrl, setWebhookUrl] = useState('');
    const [enabled, setEnabled] = useState(true);
    const [rolePing, setRolePing] = useState('');
    const [botName, setBotName] = useState('');
    const [botAvatar, setBotAvatar] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [color, setColor] = useState('#C5A059');
    const [footer, setFooter] = useState('');

    // UI state
    const [showWebhookUrl, setShowWebhookUrl] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [showConfirmPublishModal, setShowConfirmPublishModal] = useState(false);
    const fileInputRef = useRef(null);
    const avatarInputRef = useRef(null);
    const textareaRef = useRef(null);

    // Load data on mount or when division prop changes
    useEffect(() => {
        loadData(selectedDivision);
    }, [selectedDivision]);

    const showSuccess = (msg) => {
        setFeedback(msg);
        setErrorMsg(null);
        setTimeout(() => setFeedback(null), 5000);
    };

    const showError = (msg) => {
        setErrorMsg(msg);
        setFeedback(null);
        setTimeout(() => setErrorMsg(null), 7000);
    };

    const loadData = async (divKey) => {
        setLoading(true);
        try {
            const config = await getDivisionPresentationConfig(divKey);
            setWebhookUrl(config.webhookUrl || '');
            setEnabled(config.enabled !== undefined ? config.enabled : true);
            setRolePing(config.rolePing || '');
            setBotName(config.botName || '');
            setBotAvatar(config.botAvatar || '');
            setTitle(config.title || '');
            setDescription(config.description || '');
            setImageUrl(config.imageUrl || '');
            setColor(config.color || '#C5A059');
            setFooter(config.footer || '');
        } catch (err) {
            console.error('Error loading division presentation:', err);
            showError('Error al cargar la configuración: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Save configuration
    const handleSave = async () => {
        try {
            setSaving(true);
            const res = await saveDivisionPresentationConfig(selectedDivision, {
                webhookUrl,
                enabled,
                rolePing,
                botName,
                botAvatar,
                title,
                description,
                imageUrl,
                color,
                footer
            });

            if (res.success) {
                showSuccess('✅ Configuración de la presentación guardada con éxito.');
            } else {
                showError('Error al guardar: ' + (res.error || 'Desconocido'));
            }
        } catch (err) {
            showError('Error al guardar: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Test webhook
    const handleTestWebhook = async () => {
        if (!webhookUrl || !webhookUrl.trim().startsWith('https://')) {
            showError('Introduce primero una URL válida de Webhook de Discord (https://...)');
            return;
        }

        try {
            setTesting(true);
            await testDivisionPresentationWebhook(selectedDivision, {
                webhookUrl,
                enabled,
                rolePing,
                botName,
                botAvatar,
                color
            });
            showSuccess('🧪 ¡Mensaje de prueba enviado con éxito al canal de Discord!');
        } catch (err) {
            showError('Error en la prueba de Discord: ' + err.message);
        } finally {
            setTesting(false);
        }
    };

    // Publish presentation
    const handlePublish = async () => {
        if (!webhookUrl || !webhookUrl.trim().startsWith('https://')) {
            showError('Configura y guarda una URL de Webhook de Discord antes de publicar.');
            return;
        }

        try {
            setPublishing(true);
            setShowConfirmPublishModal(false);

            // Auto-save first
            await saveDivisionPresentationConfig(selectedDivision, {
                webhookUrl,
                enabled,
                rolePing,
                botName,
                botAvatar,
                title,
                description,
                imageUrl,
                color,
                footer
            });

            const res = await sendDivisionPresentationToDiscord(selectedDivision, {
                webhookUrl,
                enabled: true,
                rolePing,
                botName,
                botAvatar,
                title,
                description,
                imageUrl,
                color,
                footer
            }, true);

            if (res.success) {
                showSuccess('🚀 ¡Presentación de la división publicada en Discord con éxito!');
            } else {
                showError('Error al publicar en Discord: ' + (res.error || 'Desconocido'));
            }
        } catch (err) {
            showError('Error al publicar: ' + err.message);
        } finally {
            setPublishing(false);
        }
    };

    // Handle Image Upload for presentation photo
    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploadingImage(true);
            const publicUrl = await uploadImageToStorage(file, 'branding');
            if (publicUrl) {
                setImageUrl(publicUrl);
                showSuccess('📸 Fotografía de presentación subida correctamente.');
            }
        } catch (err) {
            showError('Error al subir la imagen: ' + err.message);
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Handle Bot Avatar Upload
    const handleAvatarUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploadingAvatar(true);
            const publicUrl = await uploadImageToStorage(file, 'avatars');
            if (publicUrl) {
                setBotAvatar(publicUrl);
                showSuccess('🤖 Avatar del Bot actualizado.');
            }
        } catch (err) {
            showError('Error al subir el avatar: ' + err.message);
        } finally {
            setUploadingAvatar(false);
            if (avatarInputRef.current) avatarInputRef.current.value = '';
        }
    };

    // Insert markdown helper into description
    const insertMarkdown = (prefix, suffix = '') => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selected = text.substring(start, end);

        const replacement = `${prefix}${selected || 'texto'}${suffix}`;
        const newText = text.substring(0, start) + replacement + text.substring(end);
        setDescription(newText);

        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 5));
        }, 50);
    };

    // Load default template for current division
    const handleLoadDefaultTemplate = () => {
        const defaultData = DEFAULT_DIVISION_PRESENTATIONS[selectedDivision];
        if (defaultData) {
            setTitle(defaultData.title);
            setDescription(defaultData.description);
            setColor(defaultData.color);
            setBotName(defaultData.botName);
            setBotAvatar(defaultData.botAvatar);
            setFooter(defaultData.footer);
            showSuccess(`Plantilla predeterminada de ${defaultData.divisionName} cargada.`);
        }
    };

    // Load SCUB Example (from user screenshot)
    const handleLoadScubExample = () => {
        const scubData = DEFAULT_DIVISION_PRESENTATIONS.coordination;
        setTitle(scubData.title);
        setDescription(scubData.description);
        setColor('#C5A059');
        setBotName('Sheriff Criminal Unit Bureau');
        setBotAvatar(SCUB_LOGO_URL);
        setFooter("Los Santos County Sheriff's Department • División de Investigaciones");
        showSuccess('Ejemplo oficial de SCUB cargado en el editor.');
    };

    // Discord message formatted description preview renderer
    const renderDiscordMarkdown = (text) => {
        if (!text) return <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin descripción...</span>;

        const lines = text.split('\n');
        return lines.map((line, index) => {
            const trimmed = line.trim();

            if (!trimmed) {
                return <div key={index} style={{ height: '0.65rem' }}></div>;
            }

            // Quote block: starts with >
            if (trimmed.startsWith('>')) {
                const quoteText = line.replace(/^\s*>\s?/, '');
                return (
                    <div
                        key={index}
                        style={{
                            display: 'flex',
                            borderLeft: '4px solid #4e5058',
                            paddingLeft: '10px',
                            margin: '3px 0',
                            color: '#dbdee1',
                            fontSize: '0.92rem'
                        }}
                    >
                        <span>{formatInlineMarkdown(quoteText)}</span>
                    </div>
                );
            }

            // Bullet list item
            if (trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                    <div key={index} style={{ display: 'flex', gap: '0.4rem', margin: '2px 0 2px 8px', color: '#dbdee1' }}>
                        <span>•</span>
                        <span>{formatInlineMarkdown(trimmed.replace(/^([•\-\*]\s?)/, ''))}</span>
                    </div>
                );
            }

            // Regular paragraph
            return (
                <div key={index} style={{ margin: '4px 0', color: '#dbdee1', lineHeight: '1.45' }}>
                    {formatInlineMarkdown(line)}
                </div>
            );
        });
    };

    // Helper for bold and italic markdown
    const formatInlineMarkdown = (str) => {
        if (!str) return '';

        // Simple tokenizer for bold (**text**) and italic (*text*)
        const parts = [];
        let remaining = str;

        // Replace bold **...**
        const boldRegex = /\*\*(.*?)\*\*/g;
        let lastIdx = 0;
        let match;

        while ((match = boldRegex.exec(str)) !== null) {
            if (match.index > lastIdx) {
                parts.push(renderItalics(str.substring(lastIdx, match.index)));
            }
            parts.push(<strong key={`b-${match.index}`} style={{ fontWeight: 700, color: '#ffffff' }}>{match[1]}</strong>);
            lastIdx = match.index + match[0].length;
        }

        if (lastIdx < str.length) {
            parts.push(renderItalics(str.substring(lastIdx)));
        }

        return parts.length > 0 ? parts : str;
    };

    const renderItalics = (str) => {
        const italicRegex = /\*(.*?)\*/g;
        const parts = [];
        let lastIdx = 0;
        let match;

        while ((match = italicRegex.exec(str)) !== null) {
            if (match.index > lastIdx) {
                parts.push(str.substring(lastIdx, match.index));
            }
            parts.push(<em key={`i-${match.index}`} style={{ fontStyle: 'italic', color: '#e2e8f0' }}>{match[1]}</em>);
            lastIdx = match.index + match[0].length;
        }

        if (lastIdx < str.length) {
            parts.push(str.substring(lastIdx));
        }

        return parts.length > 0 ? parts : str;
    };

    const baseMeta = DIVISION_OPTIONS.find(d => d.key === selectedDivision) || DIVISION_OPTIONS[0];
    const currentDivMeta = {
        ...baseMeta,
        label: selectedDivision === 'coordination'
            ? (branding?.coordination_nav_label || 'Coordinación')
            : (selectedDivision === 'seb' ? (branding?.seb_nav_label || 'SEB')
            : (selectedDivision === 'asd' ? (branding?.asd_nav_label || 'ASD')
            : (selectedDivision === 'ia' ? (branding?.ia_nav_label || 'Asuntos Internos') : baseMeta.label)))
    };

    return (
        <div style={{ maxWidth: '1440px', margin: '0 auto', paddingBottom: '3rem' }}>
            {/* Standalone Back Button (for /internal-affairs/presentacion) */}
            {standalone && (
                <div style={{ marginBottom: '1.5rem' }}>
                    <button
                        type="button"
                        onClick={() => navigate('/internal-affairs')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'rgba(15, 23, 42, 0.75)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            color: '#94a3b8',
                            borderRadius: '10px',
                            padding: '0.55rem 1.1rem',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <span>←</span>
                        <span>{language === 'es' ? 'Volver a Asuntos Internos' : 'Back to Internal Affairs'}</span>
                    </button>
                </div>
            )}

            {/* Header Banner */}
            <div style={{
                background: `linear-gradient(135deg, ${currentDivMeta.color}22 0%, rgba(15, 23, 42, 0.95) 100%)`,
                border: `1px solid ${currentDivMeta.color}44`,
                borderRadius: '20px',
                padding: '2rem 2.5rem',
                marginBottom: '1.75rem',
                boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', position: 'relative', zIndex: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '16px',
                            background: `linear-gradient(135deg, ${currentDivMeta.color}33, rgba(15, 23, 42, 0.6))`,
                            border: `1px solid ${currentDivMeta.color}66`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.85rem',
                            boxShadow: `0 8px 24px ${currentDivMeta.color}33`
                        }}>
                            {currentDivMeta.icon}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                                <span style={{
                                    display: 'inline-block',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    backgroundColor: enabled && webhookUrl ? '#22c55e' : '#ef4444',
                                    boxShadow: enabled && webhookUrl ? '0 0 10px #22c55e' : '0 0 8px #ef4444'
                                }}></span>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: currentDivMeta.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    WEBHOOK DE PRESENTACIÓN INSTITUCIONAL
                                </span>
                            </div>
                            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                                PRESENTACIÓN • {currentDivMeta.label.toUpperCase()}
                            </h1>
                            <p style={{ margin: 0, fontSize: '0.86rem', color: '#94a3b8' }}>
                                Emisión del comunicado oficial de la división hacia Discord con formato enriquecido, cita de unidades, requisitos y fotografía.
                            </p>
                        </div>
                    </div>

                    {/* Division Institutional Badge (Locked to this section) */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: `${currentDivMeta.color}18`,
                        border: `1px solid ${currentDivMeta.color}44`,
                        padding: '0.65rem 1.25rem',
                        borderRadius: '14px',
                        boxShadow: `0 4px 16px ${currentDivMeta.color}22`
                    }}>
                        <span style={{ fontSize: '1.4rem' }}>{currentDivMeta.icon}</span>
                        <div>
                            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: currentDivMeta.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Canal Oficial
                            </div>
                            <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#ffffff' }}>
                                {currentDivMeta.label}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notifications / Feedback */}
            {feedback && (
                <div style={{
                    padding: '0.9rem 1.25rem',
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid rgba(34, 197, 94, 0.4)',
                    color: '#86efac',
                    borderRadius: '12px',
                    marginBottom: '1.5rem',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 16px rgba(34, 197, 94, 0.15)'
                }}>
                    <span>{feedback}</span>
                    <button type="button" onClick={() => setFeedback(null)} style={{ background: 'transparent', border: 'none', color: '#86efac', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                </div>
            )}

            {errorMsg && (
                <div style={{
                    padding: '0.9rem 1.25rem',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                    borderRadius: '12px',
                    marginBottom: '1.5rem',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 16px rgba(239, 68, 68, 0.15)'
                }}>
                    <span>{errorMsg}</span>
                    <button type="button" onClick={() => setErrorMsg(null)} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                </div>
            )}

            {/* Main 2-Column Grid: Left = Editor, Right = Discord Mockup Preview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.75rem', alignItems: 'start' }}>
                
                {/* LEFT COLUMN: EDITOR */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* 1. Webhook Settings Box */}
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '18px',
                        padding: '1.5rem',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{ fontSize: '1.25rem' }}>⚙️</span>
                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                                    Configuración de Conexión Discord
                                </h3>
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 600 }}>
                                <input
                                    type="checkbox"
                                    checked={enabled}
                                    onChange={(e) => setEnabled(e.target.checked)}
                                    style={{ width: '16px', height: '16px', accentColor: currentDivMeta.color }}
                                />
                                <span>Webhook Activo</span>
                            </label>
                        </div>

                        {/* Webhook URL Input */}
                        <div style={{ marginBottom: '1.1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    URL del Webhook de Discord
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setShowWebhookUrl(!showWebhookUrl)}
                                    style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                >
                                    {showWebhookUrl ? 'Ocultar' : 'Mostrar'}
                                </button>
                            </div>
                            <input
                                type={showWebhookUrl ? 'text' : 'password'}
                                value={webhookUrl}
                                onChange={(e) => setWebhookUrl(e.target.value)}
                                placeholder="https://discord.com/api/webhooks/..."
                                style={{
                                    width: '100%',
                                    background: 'rgba(2, 6, 23, 0.65)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    borderRadius: '10px',
                                    padding: '0.65rem 0.85rem',
                                    color: '#f8fafc',
                                    fontSize: '0.86rem',
                                    boxSizing: 'border-box',
                                    outline: 'none'
                                }}
                            />
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.3rem' }}>
                                Canal de Discord donde se difundirá la presentación institucional.
                            </div>
                        </div>

                        {/* Role Ping & Bot Identity Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                                    Mención de Rol (Opcional)
                                </label>
                                <input
                                    type="text"
                                    value={rolePing}
                                    onChange={(e) => setRolePing(e.target.value)}
                                    placeholder="<@&ROLE_ID> o @everyone"
                                    style={{
                                        width: '100%',
                                        background: 'rgba(2, 6, 23, 0.65)',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.85rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                        boxSizing: 'border-box',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                                    Nombre del Bot
                                </label>
                                <input
                                    type="text"
                                    value={botName}
                                    onChange={(e) => setBotName(e.target.value)}
                                    placeholder="Ej: Sheriff Criminal Unit Bureau"
                                    style={{
                                        width: '100%',
                                        background: 'rgba(2, 6, 23, 0.65)',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.85rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                        boxSizing: 'border-box',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Bot Avatar URL + Quick Presets + Upload */}
                        <div style={{ marginBottom: '0.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                                Avatar del Bot
                            </label>
                            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                                <img
                                    src={normalizeDiscordImageUrl(botAvatar, SCUB_LOGO_URL)}
                                    alt="Bot Avatar"
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }}
                                    onError={(e) => { e.target.src = SCUB_LOGO_URL; }}
                                />
                                <input
                                    type="text"
                                    value={botAvatar}
                                    onChange={(e) => setBotAvatar(e.target.value)}
                                    placeholder="https://... logo o avatar"
                                    style={{
                                        flex: 1,
                                        background: 'rgba(2, 6, 23, 0.65)',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: '10px',
                                        padding: '0.6rem 0.85rem',
                                        color: '#f8fafc',
                                        fontSize: '0.82rem',
                                        outline: 'none'
                                    }}
                                />
                                <input
                                    type="file"
                                    ref={avatarInputRef}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handleAvatarUpload}
                                />
                                <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    disabled={uploadingAvatar}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#e2e8f0',
                                        borderRadius: '10px',
                                        padding: '0.6rem 0.9rem',
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {uploadingAvatar ? 'Subiendo...' : 'Subir'}
                                </button>
                            </div>

                            {/* Preset Buttons for Bot Avatar */}
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={() => setBotAvatar(selectedDivision === 'ia' ? IA_LOGO_URL : SCUB_LOGO_URL)}
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: '6px', padding: '0.25rem 0.6rem', fontSize: '0.72rem', cursor: 'pointer' }}
                                >
                                    {selectedDivision === 'ia' ? '⚖️ Logo Oficial IA' : `🛡️ Logo Oficial ${currentDivMeta.label}`}
                                </button>
                            </div>
                        </div>

                        {/* Test Webhook Button */}
                        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={handleTestWebhook}
                                disabled={testing || !webhookUrl}
                                style={{
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    border: '1px solid rgba(56, 189, 248, 0.4)',
                                    color: '#38bdf8',
                                    borderRadius: '10px',
                                    padding: '0.55rem 1.15rem',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    cursor: testing || !webhookUrl ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    opacity: testing || !webhookUrl ? 0.6 : 1
                                }}
                            >
                                <span>{testing ? '⏳' : '🧪'}</span>
                                <span>{testing ? 'Comprobando...' : 'Probar Conexión Webhook'}</span>
                            </button>
                        </div>
                    </div>

                    {/* 2. Content & Embed Settings */}
                    <div style={{
                        background: 'rgba(15, 23, 42, 0.75)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '18px',
                        padding: '1.5rem',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{ fontSize: '1.25rem' }}>📝</span>
                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                                    Contenido de la Presentación
                                </h3>
                            </div>

                            {/* Template Buttons */}
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    onClick={handleLoadDefaultTemplate}
                                    style={{
                                        background: `${currentDivMeta.color}15`,
                                        border: `1px solid ${currentDivMeta.color}44`,
                                        color: currentDivMeta.color,
                                        borderRadius: '8px',
                                        padding: '0.35rem 0.75rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                    }}
                                    title={`Restaura la plantilla oficial recomendada de ${currentDivMeta.label}`}
                                >
                                    🔄 Restaurar Plantilla de {currentDivMeta.label}
                                </button>
                                {selectedDivision === 'coordination' && (
                                    <button
                                        type="button"
                                        onClick={handleLoadScubExample}
                                        style={{
                                            background: 'rgba(197, 160, 89, 0.15)',
                                            border: '1px solid rgba(197, 160, 89, 0.4)',
                                            color: '#C5A059',
                                            borderRadius: '8px',
                                            padding: '0.35rem 0.75rem',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                        title="Carga exactamente el ejemplo del Sheriff Criminal Unit Bureau de la imagen"
                                    >
                                        ✨ Ejemplo de la foto (SCUB)
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Title and Color Picker Row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.15rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                                    Título de la Presentación
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Ej: 🕵️ SHERIFF CRIMINAL UNIT BUREAU"
                                    style={{
                                        width: '100%',
                                        background: 'rgba(2, 6, 23, 0.65)',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.85rem',
                                        color: '#f8fafc',
                                        fontSize: '0.9rem',
                                        fontWeight: 700,
                                        boxSizing: 'border-box',
                                        outline: 'none'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                                    Color de la Franja
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        style={{
                                            width: '38px',
                                            height: '38px',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            background: 'transparent',
                                            cursor: 'pointer',
                                            padding: 0
                                        }}
                                    />
                                    <input
                                        type="text"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        style={{
                                            flex: 1,
                                            background: 'rgba(2, 6, 23, 0.65)',
                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                            borderRadius: '8px',
                                            padding: '0.55rem 0.7rem',
                                            color: '#f8fafc',
                                            fontSize: '0.82rem',
                                            fontWeight: 600,
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Formatting Toolbar */}
                        <div style={{
                            display: 'flex',
                            gap: '0.4rem',
                            marginBottom: '0.6rem',
                            background: 'rgba(2, 6, 23, 0.5)',
                            padding: '0.35rem 0.5rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            flexWrap: 'wrap',
                            alignItems: 'center'
                        }}>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, marginRight: '0.3rem', textTransform: 'uppercase' }}>
                                Formato:
                            </span>
                            <button
                                type="button"
                                onClick={() => insertMarkdown('**', '**')}
                                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#f8fafc', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem' }}
                                title="Negrita (**texto**)"
                            >
                                B
                            </button>
                            <button
                                type="button"
                                onClick={() => insertMarkdown('*', '*')}
                                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#f8fafc', fontStyle: 'italic', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem' }}
                                title="Cursiva (*texto*)"
                            >
                                I
                            </button>
                            <button
                                type="button"
                                onClick={() => insertMarkdown('> ')}
                                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#38bdf8', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem' }}
                                title="Cita (> bloque)"
                            >
                                &gt; Cita
                            </button>
                            <button
                                type="button"
                                onClick={() => insertMarkdown('• ')}
                                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#f8fafc', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem' }}
                                title="Elemento de lista (• item)"
                            >
                                • Lista
                            </button>
                            <button
                                type="button"
                                onClick={() => insertMarkdown('🔎 ')}
                                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#f8fafc', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem' }}
                                title="Encabezado / Sección"
                            >
                                🔎 Sección
                            </button>
                        </div>

                        {/* Description Textarea */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <textarea
                                ref={textareaRef}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={14}
                                placeholder="Escribe aquí el texto institucional de la división... Puedes utilizar párrafos, listas con • y citas con >."
                                style={{
                                    width: '100%',
                                    background: 'rgba(2, 6, 23, 0.75)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    borderRadius: '10px',
                                    padding: '0.85rem',
                                    color: '#f8fafc',
                                    fontSize: '0.88rem',
                                    lineHeight: '1.5',
                                    boxSizing: 'border-box',
                                    outline: 'none',
                                    resize: 'vertical',
                                    fontFamily: 'inherit'
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem' }}>
                                <span>Admite formato Discord Markdown (párrafos, citas con <code>&gt;</code>, negrita <code>**</code>, cursiva <code>*</code>).</span>
                                <span>{description.length} caracteres</span>
                            </div>
                        </div>

                        {/* 3. Photo / Image of Presentation */}
                        <div style={{
                            background: 'rgba(2, 6, 23, 0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '12px',
                            padding: '1.15rem',
                            marginBottom: '1.25rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.1rem' }}>🖼️</span>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase' }}>
                                        Fotografía de la Presentación
                                    </label>
                                </div>
                                {imageUrl && (
                                    <button
                                        type="button"
                                        onClick={() => setImageUrl('')}
                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Quitar foto
                                    </button>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    value={imageUrl}
                                    onChange={(e) => setImageUrl(e.target.value)}
                                    placeholder="https://... URL directa de la foto o sube una imagen"
                                    style={{
                                        flex: 1,
                                        background: 'rgba(15, 23, 42, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.12)',
                                        borderRadius: '10px',
                                        padding: '0.65rem 0.85rem',
                                        color: '#f8fafc',
                                        fontSize: '0.84rem',
                                        outline: 'none'
                                    }}
                                />
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={handlePhotoUpload}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingImage}
                                    style={{
                                        background: `linear-gradient(135deg, ${currentDivMeta.color}33, ${currentDivMeta.color}15)`,
                                        border: `1px solid ${currentDivMeta.color}66`,
                                        color: currentDivMeta.color,
                                        borderRadius: '10px',
                                        padding: '0.65rem 1.1rem',
                                        fontSize: '0.84rem',
                                        fontWeight: 700,
                                        cursor: uploadingImage ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <span>{uploadingImage ? '⏳' : '📁'}</span>
                                    <span>{uploadingImage ? 'Subiendo...' : 'Añadir Foto'}</span>
                                </button>
                            </div>

                            {/* Image Thumbnail Preview */}
                            {imageUrl && (
                                <div style={{ marginTop: '0.75rem', position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '140px' }}>
                                    <img
                                        src={imageUrl}
                                        alt="Preview presentación"
                                        style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }}
                                    />
                                    <div style={{ position: 'absolute', bottom: 6, right: 8, background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', color: '#94a3b8' }}>
                                        Foto adjunta al embed
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer text */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
                                Pie del Embed (Footer Opcional)
                            </label>
                            <input
                                type="text"
                                value={footer}
                                onChange={(e) => setFooter(e.target.value)}
                                placeholder="Ej: Los Santos County Sheriff's Department • División Oficial"
                                style={{
                                    width: '100%',
                                    background: 'rgba(2, 6, 23, 0.65)',
                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                    borderRadius: '10px',
                                    padding: '0.65rem 0.85rem',
                                    color: '#f8fafc',
                                    fontSize: '0.85rem',
                                    boxSizing: 'border-box',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {/* Action Buttons: Save & Publish */}
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                style={{
                                    flex: 1,
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    color: '#f8fafc',
                                    borderRadius: '12px',
                                    padding: '0.85rem 1.25rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 700,
                                    cursor: saving ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span>{saving ? '⏳' : '💾'}</span>
                                <span>{saving ? 'Guardando...' : 'Guardar Configuración'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowConfirmPublishModal(true)}
                                disabled={publishing || !webhookUrl}
                                style={{
                                    flex: 1.3,
                                    background: `linear-gradient(135deg, ${currentDivMeta.color} 0%, ${currentDivMeta.color}cc 100%)`,
                                    border: 'none',
                                    color: '#0f172a',
                                    borderRadius: '12px',
                                    padding: '0.85rem 1.25rem',
                                    fontSize: '0.92rem',
                                    fontWeight: 800,
                                    cursor: publishing || !webhookUrl ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    boxShadow: `0 6px 20px ${currentDivMeta.color}44`,
                                    opacity: publishing || !webhookUrl ? 0.6 : 1,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span>{publishing ? '⏳' : '🚀'}</span>
                                <span>{publishing ? 'Publicando...' : 'Publicar en Discord'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: DISCORD LIVE PREVIEW MOCKUP */}
                <div style={{ position: 'sticky', top: '1.5rem' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '0.75rem',
                        padding: '0 0.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>👁️</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Vista Previa de Discord (Simulación Real)
                            </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Canal #presentacion-division
                        </span>
                    </div>

                    {/* Discord Desktop Canvas Container */}
                    <div style={{
                        background: '#313338',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '1.5rem',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        fontFamily: "'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif"
                    }}>
                        {/* Discord Message Row */}
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            {/* Bot Avatar */}
                            <img
                                src={normalizeDiscordImageUrl(botAvatar, SCUB_LOGO_URL)}
                                alt="Bot"
                                style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    flexShrink: 0
                                }}
                                onError={(e) => { e.target.src = SCUB_LOGO_URL; }}
                            />

                            {/* Message Body */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                {/* User header: Name, BOT badge, timestamp */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.98rem', color: '#f2f3f5' }}>
                                        {botName || currentDivMeta.label}
                                    </span>
                                    <span style={{
                                        background: '#5865F2',
                                        color: '#ffffff',
                                        fontSize: '0.62rem',
                                        fontWeight: 800,
                                        padding: '0.1rem 0.35rem',
                                        borderRadius: '3px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em'
                                    }}>
                                        APP
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#949ba4', marginLeft: '0.3rem' }}>
                                        Hoy a las 15:04
                                    </span>
                                </div>

                                {/* Role Ping Mention (if present) */}
                                {rolePing && (
                                    <div style={{
                                        display: 'inline-block',
                                        background: 'rgba(88, 101, 242, 0.25)',
                                        color: '#c9cdfb',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        padding: '0.1rem 0.4rem',
                                        borderRadius: '3px',
                                        marginBottom: '0.5rem'
                                    }}>
                                        {rolePing}
                                    </div>
                                )}

                                {/* DISCORD EMBED CONTAINER */}
                                <div style={{
                                    background: '#2b2d31',
                                    borderLeft: `4px solid ${color || currentDivMeta.color}`,
                                    borderRadius: '4px',
                                    padding: '0.9rem 1.1rem',
                                    maxWidth: '520px',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)'
                                }}>
                                    {/* Embed Title */}
                                    {title && (
                                        <div style={{
                                            fontWeight: 800,
                                            fontSize: '1rem',
                                            color: '#ffffff',
                                            marginBottom: '0.6rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem'
                                        }}>
                                            <span>{title}</span>
                                        </div>
                                    )}

                                    {/* Embed Description (Markdown rendered) */}
                                    <div style={{
                                        fontSize: '0.88rem',
                                        color: '#dbdee1',
                                        lineHeight: '1.45',
                                        marginBottom: imageUrl ? '0.75rem' : '0.2rem',
                                        wordBreak: 'break-word'
                                    }}>
                                        {renderDiscordMarkdown(description)}
                                    </div>

                                    {/* Embed Attached Image / Photo (bottom) */}
                                    {imageUrl && (
                                        <div style={{
                                            marginTop: '0.75rem',
                                            borderRadius: '6px',
                                            overflow: 'hidden',
                                            maxHeight: '340px'
                                        }}>
                                            <img
                                                src={imageUrl}
                                                alt="Attached presentation photo"
                                                style={{
                                                    width: '100%',
                                                    maxHeight: '340px',
                                                    objectFit: 'cover',
                                                    borderRadius: '6px',
                                                    display: 'block'
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Embed Footer */}
                                    {(footer || true) && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.4rem',
                                            marginTop: '0.75rem',
                                            paddingTop: '0.5rem',
                                            borderTop: '1px solid rgba(255,255,255,0.05)',
                                            fontSize: '0.72rem',
                                            color: '#949ba4'
                                        }}>
                                            <span>{footer || "Los Santos County Sheriff's Department • División Oficial"}</span>
                                            <span>•</span>
                                            <span>Hoy a las 15:04</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preview Helper Tip */}
                    <div style={{
                        marginTop: '0.85rem',
                        padding: '0.75rem 1rem',
                        background: 'rgba(15, 23, 42, 0.55)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        color: '#94a3b8',
                        fontSize: '0.78rem'
                    }}>
                        <span>💡</span>
                        <span>
                            Cualquier cambio de texto, color o foto que realices en el panel izquierdo se reflejará instantáneamente en esta vista previa antes de emitir a Discord.
                        </span>
                    </div>
                </div>
            </div>

            {/* CONFIRMATION PUBLISH MODAL */}
            {showConfirmPublishModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0, 0, 0, 0.82)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: '#0f172a',
                        border: `1px solid ${currentDivMeta.color}66`,
                        borderRadius: '18px',
                        padding: '2rem',
                        maxWidth: '520px',
                        width: '100%',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '12px',
                                background: `${currentDivMeta.color}22`,
                                border: `1px solid ${currentDivMeta.color}44`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.5rem'
                            }}>
                                🚀
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                                    Confirmar Publicación en Discord
                                </h3>
                                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                                    División: {currentDivMeta.label}
                                </p>
                            </div>
                        </div>

                        <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
                            ¿Deseas emitir la presentación oficial de <strong>{currentDivMeta.label}</strong> al canal configurado en Discord?
                            El mensaje incluirá el título, texto estructurado y la fotografía seleccionada.
                        </p>

                        <div style={{
                            background: 'rgba(2, 6, 23, 0.6)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '10px',
                            padding: '0.75rem 1rem',
                            marginBottom: '1.5rem',
                            fontSize: '0.82rem',
                            color: '#94a3b8'
                        }}>
                            <div><strong>Título:</strong> {title || '—'}</div>
                            <div><strong>Foto adjunta:</strong> {imageUrl ? '✅ Sí (incluida)' : '❌ Ninguna foto seleccionada'}</div>
                            <div><strong>Mención:</strong> {rolePing || 'Ninguna'}</div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setShowConfirmPublishModal(false)}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: '#cbd5e1',
                                    borderRadius: '10px',
                                    padding: '0.65rem 1.25rem',
                                    fontSize: '0.88rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handlePublish}
                                style={{
                                    background: `linear-gradient(135deg, ${currentDivMeta.color} 0%, ${currentDivMeta.color}cc 100%)`,
                                    border: 'none',
                                    color: '#0f172a',
                                    borderRadius: '10px',
                                    padding: '0.65rem 1.4rem',
                                    fontSize: '0.88rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                }}
                            >
                                Confirmar y Publicar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
