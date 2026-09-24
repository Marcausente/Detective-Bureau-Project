import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { uploadImageToStorage } from '../utils/imageStorage';
import {
    IA_SANCTION_TYPES,
    IA_LOGO_URL,
    DEFAULT_IA_BOT_NAME,
    DEFAULT_IA_FOOTER_TEXT,
    getDiscordIASanctionsWebhookConfig,
    saveDiscordIASanctionsWebhookConfig,
    getIASanctionBanners,
    saveIASanctionBanners,
    testIASanctionsDiscordWebhook,
    sendIASanctionToDiscord
} from '../utils/discordWebhook';
import '../index.css';

export default function IAPublicacionFaltas() {
    const navigate = useNavigate();
    const { isLSSD } = useTheme();
    const { language } = useLanguage();

    const [user, setUser] = useState(null);
    const [activeTab, setActiveTab] = useState('publish'); // 'publish', 'banners', 'webhook'
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [feedbackNotice, setFeedbackNotice] = useState(null);
    const [feedbackError, setFeedbackError] = useState(null);

    // Officers list for autocomplete
    const [officers, setOfficers] = useState([]);

    // Publications history
    const [publications, setPublications] = useState([]);
    const [historySearch, setHistorySearch] = useState('');
    const [historyFilter, setHistoryFilter] = useState('all');

    // Webhook Configuration State
    const [webhookConfig, setWebhookConfig] = useState({
        webhookUrl: '',
        enabled: false,
        rolePing: '',
        botName: DEFAULT_IA_BOT_NAME,
        botAvatar: '',
        footerText: DEFAULT_IA_FOOTER_TEXT,
        customHeader: 'MOTIVO: {motivo}',
        reminderText: ''
    });
    const [testingWebhook, setTestingWebhook] = useState(false);

    // Banners State (5 types)
    const [banners, setBanners] = useState({
        leves_sargentos: '',
        leves_ia: '',
        medias: '',
        graves: '',
        despido: ''
    });
    const [uploadingBannerFor, setUploadingBannerFor] = useState(null);

    // Form State for New Publication
    const [formData, setFormData] = useState({
        sanctionType: 'leves_ia',
        officerName: '',
        officerBadge: '',
        officerRank: '',
        reason: '',
        sanctionApplied: '',
        sanctionerName: '',
        sanctionDate: new Date().toISOString().split('T')[0],
        evidenceUrl: '',
        notes: '',
        customBannerUrl: '',
        sendToDiscord: true
    });

    useEffect(() => {
        loadInitialData();
    }, []);

    const showSuccess = (msg) => {
        setFeedbackNotice(msg);
        setFeedbackError(null);
        setTimeout(() => setFeedbackNotice(null), 4500);
    };

    const showError = (msg) => {
        setFeedbackError(msg);
        setFeedbackNotice(null);
        setTimeout(() => setFeedbackError(null), 6000);
    };

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) {
                navigate('/');
                return;
            }

            const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('id', authUser.id)
                .single();

            setUser(userData);

            // Auto-fill sanctioner name with current user
            if (userData) {
                const authorRank = userData.rango ? `[${userData.rango}]` : '';
                const authorName = [userData.nombre, userData.apellido].filter(Boolean).join(' ');
                const authorBadge = userData.no_placa ? `(#${userData.no_placa})` : '';
                const defaultSanctioner = `${authorRank} ${authorName} ${authorBadge}`.trim();
                setFormData(prev => ({
                    ...prev,
                    sanctionerName: prev.sanctionerName || defaultSanctioner
                }));
            }

            // Load registered officers/users for picker
            const { data: officersData } = await supabase
                .from('users')
                .select('id, nombre, apellido, no_placa, rango, rol')
                .order('nombre', { ascending: true });
            setOfficers(officersData || []);

            // Load Webhook Config
            const loadedWebhook = await getDiscordIASanctionsWebhookConfig();
            setWebhookConfig(loadedWebhook);

            // Load Banners
            const loadedBanners = await getIASanctionBanners();
            setBanners(loadedBanners);

            // Load Publications History
            await fetchPublications();
        } catch (err) {
            console.error('Error loading initial IA sanctions data:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchPublications = async () => {
        try {
            const { data, error } = await supabase.rpc('get_ia_published_sanctions');
            if (!error && data) {
                setPublications(data);
            } else {
                // Fallback to table direct select
                const { data: tableData } = await supabase
                    .from('ia_published_sanctions')
                    .select('*')
                    .order('created_at', { ascending: false });
                setPublications(tableData || []);
            }
        } catch (err) {
            console.warn('Could not fetch publications history:', err);
        }
    };

    // Handle Officer Selection from Dropdown
    const handleSelectOfficer = (e) => {
        const officerId = e.target.value;
        if (!officerId) return;
        const selected = officers.find(o => String(o.id) === String(officerId));
        if (selected) {
            setFormData(prev => ({
                ...prev,
                officerName: `${selected.nombre || ''} ${selected.apellido || ''}`.trim(),
                officerBadge: selected.no_placa || '',
                officerRank: selected.rango || selected.rol || ''
            }));
        }
    };

    // Handle Submit New Sanction Publication
    const handleSubmitPublication = async (e) => {
        e.preventDefault();
        if (!formData.reason.trim()) {
            showError('Debe ingresar el motivo de la falta o infracción.');
            return;
        }

        try {
            setSubmitting(true);

            const activeBanner = formData.customBannerUrl || banners[formData.sanctionType] || '';

            // 1. Save in Database
            const { data: createdId, error: dbError } = await supabase.rpc('create_ia_published_sanction', {
                p_sanction_type: formData.sanctionType,
                p_officer_name: '',
                p_officer_badge: '',
                p_officer_rank: '',
                p_reason: formData.reason.trim(),
                p_sanction_applied: '',
                p_sanctioner_name: '',
                p_sanction_date: formData.sanctionDate || new Date().toISOString().split('T')[0],
                p_evidence_url: '',
                p_notes: '',
                p_banner_url: activeBanner,
                p_discord_sent: formData.sendToDiscord
            });

            if (dbError) {
                console.warn('Database save warning:', dbError);
            }

            // 2. Send to Discord if enabled
            let discordResult = null;
            if (formData.sendToDiscord) {
                discordResult = await sendIASanctionToDiscord({
                    sanctionType: formData.sanctionType,
                    reason: formData.reason.trim(),
                    sanctionDate: formData.sanctionDate,
                    customBannerUrl: activeBanner,
                    author: user,
                    forceSend: false
                });

                if (discordResult && !discordResult.success && !discordResult.skipped) {
                    showError(`Guardado en base de datos, pero falló el envío a Discord: ${discordResult.error}`);
                } else if (discordResult && discordResult.skipped) {
                    showSuccess('Falta registrada con éxito (Webhook de Discord deshabilitado en ajustes).');
                } else {
                    showSuccess('✅ ¡Falta publicada exitosamente en Discord!');
                }
            } else {
                showSuccess('Falta registrada correctamente en el historial interno.');
            }

            // Reset form
            setFormData(prev => ({
                ...prev,
                reason: '',
                customBannerUrl: ''
            }));

            fetchPublications();
        } catch (err) {
            console.error('Error publishing sanction:', err);
            showError('Error al procesar la publicación: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Handle Banner File Upload
    const handleBannerFileUpload = async (typeId, file) => {
        if (!file) return;
        try {
            setUploadingBannerFor(typeId);
            const publicUrl = await uploadImageToStorage(file, 'ia_banners');
            setBanners(prev => ({ ...prev, [typeId]: publicUrl }));
            showSuccess(`Banner para "${IA_SANCTION_TYPES[typeId]?.name}" subido con éxito.`);
        } catch (err) {
            console.error('Error uploading banner:', err);
            showError('Error al subir el banner: ' + err.message);
        } finally {
            setUploadingBannerFor(null);
        }
    };

    // Handle Save All Banners
    const handleSaveBanners = async () => {
        try {
            setSubmitting(true);
            const res = await saveIASanctionBanners(banners);
            if (res.success) {
                showSuccess('✅ Banners de sanciones guardados correctamente en la base de datos.');
            } else {
                showError('Error al guardar banners: ' + (res.error || 'Desconocido'));
            }
        } catch (err) {
            showError('Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Handle Save Webhook Config
    const handleSaveWebhookConfig = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);
            const res = await saveDiscordIASanctionsWebhookConfig(webhookConfig);
            if (res.success) {
                showSuccess('✅ Configuración del Webhook de Sanciones IA guardada correctamente.');
            } else {
                showError('Error al guardar configuración: ' + (res.error || 'Desconocido'));
            }
        } catch (err) {
            showError('Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Handle Test Webhook
    const handleTestWebhook = async () => {
        try {
            setTestingWebhook(true);
            const res = await testIASanctionsDiscordWebhook(webhookConfig, formData.sanctionType || 'leves_ia');
            if (res.success) {
                showSuccess('✅ Mensaje de prueba enviado con éxito a Discord. Revisa el canal configurado.');
            } else {
                showError('Error en el test: ' + (res.error || 'Comprueba la URL del Webhook.'));
            }
        } catch (err) {
            showError('Error al probar webhook: ' + err.message);
        } finally {
            setTestingWebhook(false);
        }
    };

    // Delete publication from history
    const handleDeletePublication = async (id) => {
        if (!window.confirm('¿Seguro que deseas eliminar este registro de publicación de sanción?')) return;
        try {
            const { error } = await supabase.rpc('delete_ia_published_sanction', { p_id: id });
            if (error) throw error;
            fetchPublications();
            showSuccess('Registro eliminado.');
        } catch (err) {
            showError('Error al eliminar: ' + err.message);
        }
    };

    // Filtered Publications
    const filteredPublications = publications.filter(item => {
        if (historyFilter !== 'all' && item.sanction_type !== historyFilter) return false;
        if (historySearch.trim()) {
            const term = historySearch.toLowerCase();
            const officer = (item.officer_name || '').toLowerCase();
            const reason = (item.reason || '').toLowerCase();
            const badge = (item.officer_badge || '').toLowerCase();
            return officer.includes(term) || reason.includes(term) || badge.includes(term);
        }
        return true;
    });

    const activeTypeInfo = IA_SANCTION_TYPES[formData.sanctionType] || IA_SANCTION_TYPES.leves_ia;
    const currentPreviewBanner = formData.customBannerUrl || banners[formData.sanctionType] || '';

    return (
        <div className="mac-dashboard-container" style={{ minHeight: '100vh', padding: '1.5rem' }}>
            {/* Top Navigation / Breadcrumbs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button
                    type="button"
                    onClick={() => navigate('/internal-affairs')}
                    style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        padding: '0.45rem 1rem',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                    }}
                >
                    <span>←</span>
                    <span>{language === 'es' ? 'Volver a Asuntos Internos' : 'Back to Internal Affairs'}</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="mac-status-dot" style={{ backgroundColor: '#ef4444', boxShadow: '0 0 10px #ef4444' }}></span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {isLSSD ? "Sheriff IAB • Sanciones" : "Internal Affairs Bureau • Sanctions"}
                    </span>
                </div>
            </div>

            {/* Banner Header */}
            <div className="mac-command-banner" style={{
                marginBottom: '1.5rem',
                background: 'linear-gradient(135deg, rgba(30, 27, 38, 0.9), rgba(15, 23, 42, 0.95))',
                borderLeft: '4px solid #ef4444'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <img
                        src={isLSSD ? "/logowebp/IALSSD.webp" : "/logowebp/ialogo.webp"}
                        alt="IA Division Logo"
                        style={{
                            height: '70px',
                            width: 'auto',
                            filter: 'drop-shadow(0 4px 14px rgba(239, 68, 68, 0.45))'
                        }}
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                SISTEMA DISCIPLINARIO OFICIAL
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.7rem', fontWeight: 800, margin: '0.2rem 0 0.3rem 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {language === 'es' ? 'Publicación de Faltas & Banners' : 'Sanctions Publishing & Banners'}
                        </h1>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                            Emisión formal de notificaciones disciplinarias a Discord con banners personalizados por tipología de falta.
                        </p>
                    </div>
                </div>
            </div>

            {/* Feedback Notifications */}
            {feedbackNotice && (
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
                    <span>{feedbackNotice}</span>
                </div>
            )}
            {feedbackError && (
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
                    <span>{feedbackError}</span>
                </div>
            )}

            {/* Tabs Navigation */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                paddingBottom: '0.5rem',
                marginBottom: '1.5rem',
                flexWrap: 'wrap'
            }}>
                <button
                    type="button"
                    onClick={() => setActiveTab('publish')}
                    style={{
                        padding: '0.6rem 1.2rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: activeTab === 'publish' ? '#ef4444' : 'rgba(255, 255, 255, 0.05)',
                        color: activeTab === 'publish' ? '#ffffff' : '#94a3b8',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                    }}
                >
                    <span>📢</span>
                    <span>Nueva Publicación & Historial</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('banners')}
                    style={{
                        padding: '0.6rem 1.2rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: activeTab === 'banners' ? '#f59e0b' : 'rgba(255, 255, 255, 0.05)',
                        color: activeTab === 'banners' ? '#ffffff' : '#94a3b8',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                    }}
                >
                    <span>🎨</span>
                    <span>Banners de Faltas</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('webhook')}
                    style={{
                        padding: '0.6rem 1.2rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: activeTab === 'webhook' ? '#3b82f6' : 'rgba(255, 255, 255, 0.05)',
                        color: activeTab === 'webhook' ? '#ffffff' : '#94a3b8',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                    }}
                >
                    <span>⚙️</span>
                    <span>Webhook de Discord</span>
                </button>
            </div>

            {/* TAB 1: NEW PUBLICATION & HISTORY */}
            {activeTab === 'publish' && (
                <div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(340px, 1.1fr) minmax(320px, 1fr)',
                        gap: '1.5rem',
                        alignItems: 'start'
                    }}>
                        {/* Form Card */}
                        <div className="mac-widget-card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
                                <span style={{ fontSize: '1.2rem' }}>⚖️</span>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#ffffff' }}>Emitir Publicación de Falta</h3>
                            </div>

                            <form onSubmit={handleSubmitPublication}>
                                {/* 1. Sanction Type Selector (5 levels) */}
                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', fontSize: '0.85rem', color: '#cbd5e1' }}>
                                        Tipo / Calificación de la Falta *
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                                        {Object.values(IA_SANCTION_TYPES).map(st => {
                                            const isSelected = formData.sanctionType === st.id;
                                            return (
                                                <button
                                                    key={st.id}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, sanctionType: st.id })}
                                                    style={{
                                                        padding: '10px 8px',
                                                        borderRadius: '8px',
                                                        border: isSelected ? `2px solid ${st.hexColor}` : '1px solid rgba(255, 255, 255, 0.1)',
                                                        background: isSelected ? `${st.hexColor}25` : 'rgba(255, 255, 255, 0.03)',
                                                        color: isSelected ? '#ffffff' : '#94a3b8',
                                                        fontWeight: isSelected ? '800' : '500',
                                                        fontSize: '0.78rem',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                        textAlign: 'center',
                                                        boxShadow: isSelected ? `0 0 12px ${st.hexColor}35` : 'none'
                                                    }}
                                                >
                                                    <div>{st.tag}</div>
                                                    <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '2px' }}>{st.label}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 2. Motivo */}
                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label className="form-label" style={{ fontWeight: '700', fontSize: '0.85rem', color: '#cbd5e1' }}>
                                        Motivo de la Falta *
                                    </label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Ej: ERROR AL PONER UNA SANCIÓN"
                                        value={formData.reason}
                                        onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                        required
                                        style={{ fontSize: '0.95rem', fontWeight: '600' }}
                                    />
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                                        Aparecerá en Discord como título: <strong>MOTIVO: {formData.reason ? formData.reason.toUpperCase() : 'ERROR AL PONER UNA SANCIÓN'}</strong>
                                    </span>
                                </div>

                                {/* 3. Fecha de Imposición */}
                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label className="form-label" style={{ fontWeight: '700', fontSize: '0.85rem', color: '#cbd5e1' }}>
                                        📅 Fecha de Imposición *
                                    </label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={formData.sanctionDate}
                                        onChange={e => setFormData({ ...formData, sanctionDate: e.target.value })}
                                        required
                                    />
                                </div>

                                {/* 4. Discord Toggle */}
                                <div style={{
                                    marginBottom: '1.5rem',
                                    padding: '0.85rem 1rem',
                                    background: formData.sendToDiscord ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                                    border: `1px solid ${formData.sendToDiscord ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    <input
                                        type="checkbox"
                                        id="ia-send-discord-toggle"
                                        checked={formData.sendToDiscord}
                                        onChange={(e) => setFormData(prev => ({ ...prev, sendToDiscord: e.target.checked }))}
                                        style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                                    />
                                    <label htmlFor="ia-send-discord-toggle" style={{ margin: 0, fontSize: '0.85rem', color: '#e2e8f0', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>📢</span>
                                        <span style={{ fontWeight: '600' }}>Publicar en el canal de Discord de Asuntos Internos</span>
                                    </label>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    style={{
                                        width: '100%',
                                        padding: '0.9rem',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                                        color: '#ffffff',
                                        fontWeight: '800',
                                        fontSize: '0.95rem',
                                        cursor: submitting ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <span>{submitting ? '⏳ Publicando...' : '🚀 Publicar Falta en Discord'}</span>
                                </button>
                            </form>
                        </div>

                        {/* Live Discord Preview Card */}
                        <div>
                            <div className="mac-widget-card" style={{ padding: '1.25rem', position: 'sticky', top: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '1rem' }}>👁️</span>
                                        <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f1f5f9' }}>Vista Previa en Discord</h4>
                                    </div>
                                    <span style={{ fontSize: '0.7rem', background: '#3b82f6', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>LIVE</span>
                                </div>

                                {/* Discord Mockup Window */}
                                <div style={{
                                    background: '#313338',
                                    borderRadius: '8px',
                                    padding: '1rem',
                                    fontFamily: '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif',
                                    color: '#dbdee1',
                                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
                                }}>
                                    {/* Bot Message Header */}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                                        <img
                                            src={webhookConfig.botAvatar || IA_LOGO_URL}
                                            alt="Bot Avatar"
                                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                                            onError={(e) => { e.target.src = '/logowebp/ialogo.webp'; }}
                                        />
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontWeight: '600', color: '#f2f3f5', fontSize: '0.95rem' }}>
                                                    {webhookConfig.botName || DEFAULT_IA_BOT_NAME}
                                                </span>
                                                <span style={{ background: '#5865F2', color: '#ffffff', fontSize: '0.62rem', padding: '1px 4px', borderRadius: '3px', fontWeight: '600' }}>
                                                    APP
                                                </span>
                                                <span style={{ fontSize: '0.72rem', color: '#949ba4' }}>
                                                    Hoy a las {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            {webhookConfig.rolePing && (
                                                <div style={{ marginTop: '4px', fontSize: '0.85rem', color: '#c9cdfb', background: 'rgba(88, 101, 242, 0.15)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                                    @{webhookConfig.rolePing.replace(/[<@&>]/g, '')}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Embed Box */}
                                    <div style={{
                                        background: '#2b2d31',
                                        borderLeft: `4px solid ${activeTypeInfo.hexColor}`,
                                        borderRadius: '4px',
                                        padding: '0.85rem 1rem',
                                        marginLeft: '52px'
                                    }}>
                                        {/* Title Header */}
                                        <div style={{
                                            fontWeight: '700',
                                            fontSize: '1rem',
                                            color: '#f2f3f5',
                                            marginBottom: '10px',
                                            letterSpacing: '-0.01em'
                                        }}>
                                            MOTIVO: {(formData.reason || 'ERROR AL PONER UNA SANCIÓN').toUpperCase()}
                                        </div>

                                        {/* Banner Image */}
                                        {currentPreviewBanner ? (
                                            <div style={{ marginBottom: '12px', borderRadius: '6px', overflow: 'hidden', background: '#1e1f22', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <img
                                                    src={currentPreviewBanner}
                                                    alt="Banner de Falta"
                                                    style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }}
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            <div style={{
                                                marginBottom: '12px',
                                                padding: '14px',
                                                borderRadius: '6px',
                                                background: `${activeTypeInfo.hexColor}20`,
                                                border: `1px dashed ${activeTypeInfo.hexColor}50`,
                                                textAlign: 'center',
                                                color: activeTypeInfo.hexColor,
                                                fontSize: '0.8rem',
                                                fontWeight: '700'
                                            }}>
                                                [ Banner de {activeTypeInfo.name} no configurado aún - Puedes subirlo en la pestaña "Banners de Faltas" ]
                                            </div>
                                        )}

                                        {/* Bottom Fields: Only Calificación & Fecha de Imposición */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                                            <div>
                                                <div style={{ fontSize: '0.72rem', color: '#b5bac1', fontWeight: '700', textTransform: 'uppercase' }}>⚖️ Calificación de la Falta</div>
                                                <div style={{ background: '#1e1f22', padding: '4px 6px', borderRadius: '3px', fontSize: '0.8rem', color: activeTypeInfo.hexColor, marginTop: '2px', fontFamily: 'monospace', fontWeight: '700' }}>
                                                    {activeTypeInfo.name}
                                                </div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.72rem', color: '#b5bac1', fontWeight: '700', textTransform: 'uppercase' }}>📅 Fecha de Imposición</div>
                                                <div style={{ background: '#1e1f22', padding: '4px 6px', borderRadius: '3px', fontSize: '0.8rem', color: '#dbdee1', marginTop: '2px', fontFamily: 'monospace' }}>
                                                    {formData.sanctionDate || new Date().toLocaleDateString('es-ES')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem', color: '#949ba4' }}>
                                            <img src={webhookConfig.botAvatar || IA_LOGO_URL} alt="" style={{ width: '14px', height: '14px', borderRadius: '50%' }} onError={(e) => { e.target.src = '/logowebp/ialogo.webp'; }} />
                                            <span>{webhookConfig.footerText || DEFAULT_IA_FOOTER_TEXT}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Publications History Section */}
                    <div className="mac-widget-card" style={{ marginTop: '2rem', padding: '1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{ fontSize: '1.2rem' }}>📜</span>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#ffffff' }}>Historial de Faltas Publicadas ({filteredPublications.length})</h3>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <input
                                    type="text"
                                    placeholder="Buscar por motivo..."
                                    className="form-input"
                                    style={{ width: '240px', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                    value={historySearch}
                                    onChange={e => setHistorySearch(e.target.value)}
                                />
                                <select
                                    className="form-input"
                                    style={{ width: '160px', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                    value={historyFilter}
                                    onChange={e => setHistoryFilter(e.target.value)}
                                >
                                    <option value="all">Todas las Faltas</option>
                                    <option value="leves_sargentos">Leves Sargentos</option>
                                    <option value="leves_ia">Leves IA</option>
                                    <option value="medias">Medias</option>
                                    <option value="graves">Graves</option>
                                    <option value="despido">Despido</option>
                                </select>
                            </div>
                        </div>

                        {filteredPublications.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>📭</span>
                                {historySearch || historyFilter !== 'all' ? 'No se encontraron publicaciones con los filtros aplicados.' : 'No hay faltas publicadas todavía.'}
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: '#94a3b8' }}>
                                            <th style={{ padding: '0.75rem 0.5rem' }}>Tipo</th>
                                            <th style={{ padding: '0.75rem 0.5rem' }}>Motivo de la Falta</th>
                                            <th style={{ padding: '0.75rem 0.5rem' }}>Fecha Imposición</th>
                                            <th style={{ padding: '0.75rem 0.5rem' }}>Emitido por</th>
                                            <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPublications.map(item => {
                                            const typeObj = IA_SANCTION_TYPES[item.sanction_type] || IA_SANCTION_TYPES.leves_ia;
                                            return (
                                                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                                                    <td style={{ padding: '0.75rem 0.5rem' }}>
                                                        <span style={{
                                                            background: `${typeObj.hexColor}20`,
                                                            color: typeObj.hexColor,
                                                            border: `1px solid ${typeObj.hexColor}40`,
                                                            padding: '3px 7px',
                                                            borderRadius: '5px',
                                                            fontWeight: '700',
                                                            fontSize: '0.72rem',
                                                            whiteSpace: 'nowrap'
                                                        }}>
                                                            {typeObj.name}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 0.5rem', color: '#ffffff', fontWeight: '700', textTransform: 'uppercase' }}>
                                                        {item.reason}
                                                    </td>
                                                    <td style={{ padding: '0.75rem 0.5rem', color: '#94a3b8', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                        {item.sanction_date}
                                                    </td>
                                                    <td style={{ padding: '0.75rem 0.5rem', color: '#cbd5e1', fontSize: '0.8rem' }}>
                                                        {item.creator_name || 'Asuntos Internos'}
                                                    </td>
                                                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeletePublication(item.id)}
                                                            style={{
                                                                background: 'rgba(239, 68, 68, 0.1)',
                                                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                                                color: '#f87171',
                                                                padding: '4px 8px',
                                                                borderRadius: '5px',
                                                                cursor: 'pointer',
                                                                fontSize: '0.75rem'
                                                            }}
                                                            title="Eliminar registro"
                                                        >
                                                            🗑️ Eliminar
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: BANNERS CONFIGURATION (5 TIERS) */}
            {activeTab === 'banners' && (
                <div className="mac-widget-card" style={{ padding: '1.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
                        <div>
                            <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.2rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>🎨</span>
                                <span>Banners Oficiales de Sanciones Disciplinarias</span>
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
                                Configura o sube la imagen de banner correspondiente a cada una de las 5 categorías de falta. Se adjuntará automáticamente en el mensaje de Discord.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={handleSaveBanners}
                            disabled={submitting}
                            style={{
                                padding: '0.65rem 1.4rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: '#f59e0b',
                                color: '#000000',
                                fontWeight: '800',
                                fontSize: '0.85rem',
                                cursor: submitting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                            }}
                        >
                            <span>💾</span>
                            <span>{submitting ? 'Guardando...' : 'Guardar Todos los Banners'}</span>
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                        {Object.values(IA_SANCTION_TYPES).map(st => {
                            const bannerUrl = banners[st.id] || '';
                            const isUploading = uploadingBannerFor === st.id;

                            return (
                                <div
                                    key={st.id}
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.6)',
                                        border: `1px solid ${bannerUrl ? st.hexColor + '50' : 'rgba(255, 255, 255, 0.1)'}`,
                                        borderRadius: '12px',
                                        padding: '1.25rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px'
                                    }}
                                >
                                    {/* Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                fontWeight: '800',
                                                color: st.hexColor,
                                                letterSpacing: '0.05em'
                                            }}>
                                                {st.tag}
                                            </span>
                                            <h4 style={{ margin: '2px 0 0 0', fontSize: '1rem', color: '#ffffff' }}>
                                                {st.label}
                                            </h4>
                                        </div>
                                        <span style={{
                                            fontSize: '0.7rem',
                                            padding: '2px 8px',
                                            borderRadius: '10px',
                                            background: bannerUrl ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            color: bannerUrl ? '#34d399' : '#f87171',
                                            fontWeight: '700'
                                        }}>
                                            {bannerUrl ? '✓ Con Banner' : 'Sin Banner'}
                                        </span>
                                    </div>

                                    {/* Banner Preview Frame */}
                                    <div style={{
                                        width: '100%',
                                        height: '110px',
                                        borderRadius: '8px',
                                        background: '#0b0f19',
                                        border: '1px dashed rgba(255, 255, 255, 0.15)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        position: 'relative'
                                    }}>
                                        {bannerUrl ? (
                                            <img
                                                src={bannerUrl}
                                                alt={`Banner ${st.name}`}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.75rem', padding: '10px' }}>
                                                <span>🖼️ Ningún banner cargado aún</span>
                                                <div style={{ fontSize: '0.68rem', marginTop: '2px', opacity: 0.8 }}>Sube una imagen horizontal (Ej: 800x200px)</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Upload Controls */}
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <label style={{
                                            flex: 1,
                                            padding: '0.5rem',
                                            borderRadius: '6px',
                                            background: 'rgba(255, 255, 255, 0.06)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            color: '#cbd5e1',
                                            fontSize: '0.78rem',
                                            fontWeight: '600',
                                            textAlign: 'center',
                                            cursor: isUploading ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px'
                                        }}>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                disabled={isUploading}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleBannerFileUpload(st.id, file);
                                                }}
                                            />
                                            <span>{isUploading ? '⏳ Subiendo...' : '📁 Subir Imagen'}</span>
                                        </label>

                                        {bannerUrl && (
                                            <button
                                                type="button"
                                                onClick={() => setBanners(prev => ({ ...prev, [st.id]: '' }))}
                                                style={{
                                                    padding: '0.5rem 0.75rem',
                                                    borderRadius: '6px',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.25)',
                                                    color: '#f87171',
                                                    fontSize: '0.78rem',
                                                    cursor: 'pointer'
                                                }}
                                                title="Quitar banner"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>

                                    {/* Direct URL input */}
                                    <div>
                                        <input
                                            type="url"
                                            placeholder="O pega URL de la imagen..."
                                            value={banners[st.id] || ''}
                                            onChange={(e) => setBanners({ ...banners, [st.id]: e.target.value })}
                                            className="form-input"
                                            style={{ fontSize: '0.75rem', padding: '0.4rem 0.6rem' }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 3: WEBHOOK SETTINGS */}
            {activeTab === 'webhook' && (
                <div className="mac-widget-card" style={{ maxWidth: '750px', margin: '0 auto', padding: '1.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>⚙️</span>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#ffffff' }}>Configuración del Webhook de Asuntos Internos</h3>
                    </div>

                    <form onSubmit={handleSaveWebhookConfig}>
                        {/* Enabled Toggle */}
                        <div style={{
                            padding: '1rem',
                            background: webhookConfig.enabled ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${webhookConfig.enabled ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.3)'}`,
                            borderRadius: '10px',
                            marginBottom: '1.5rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h4 style={{ margin: '0 0 2px 0', fontSize: '0.95rem', color: '#ffffff' }}>
                                    Habilitar Publicaciones en Discord
                                </h4>
                                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                                    Permite enviar sanciones automáticamente al canal configurado cuando se emite una falta.
                                </span>
                            </div>
                            <input
                                type="checkbox"
                                checked={webhookConfig.enabled}
                                onChange={e => setWebhookConfig({ ...webhookConfig, enabled: e.target.checked })}
                                style={{ width: '20px', height: '20px', accentColor: '#10b981', cursor: 'pointer' }}
                            />
                        </div>

                        {/* Webhook URL */}
                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label className="form-label" style={{ fontWeight: '700', fontSize: '0.85rem', color: '#cbd5e1' }}>
                                URL del Webhook de Discord *
                            </label>
                            <input
                                type="url"
                                className="form-input"
                                placeholder="https://discord.com/api/webhooks/..."
                                value={webhookConfig.webhookUrl}
                                onChange={e => setWebhookConfig({ ...webhookConfig, webhookUrl: e.target.value })}
                                required
                            />
                            <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px', display: 'block' }}>
                                En Discord: Ajustes de Canal &gt; Integraciones &gt; Webhooks &gt; Crear Webhook &gt; Copiar URL.
                            </span>
                        </div>

                        {/* Role Ping */}
                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label className="form-label" style={{ fontWeight: '700', fontSize: '0.85rem', color: '#cbd5e1' }}>
                                Mención de Rol (Opcional)
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej: 1306619156052967471 o @everyone"
                                value={webhookConfig.rolePing}
                                onChange={e => setWebhookConfig({ ...webhookConfig, rolePing: e.target.value })}
                            />
                        </div>

                        {/* Bot Name & Avatar */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '1.25rem' }}>
                            <div>
                                <label className="form-label" style={{ fontWeight: '700', fontSize: '0.85rem', color: '#cbd5e1' }}>
                                    Nombre del Bot
                                </label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={webhookConfig.botName}
                                    onChange={e => setWebhookConfig({ ...webhookConfig, botName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="form-label" style={{ fontWeight: '700', fontSize: '0.85rem', color: '#cbd5e1' }}>
                                    URL Avatar del Bot
                                </label>
                                <input
                                    type="url"
                                    className="form-input"
                                    placeholder="https://..."
                                    value={webhookConfig.botAvatar}
                                    onChange={e => setWebhookConfig({ ...webhookConfig, botAvatar: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Footer Text */}
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label className="form-label" style={{ fontWeight: '700', fontSize: '0.85rem', color: '#cbd5e1' }}>
                                Pie de Página del Embed
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                value={webhookConfig.footerText}
                                onChange={e => setWebhookConfig({ ...webhookConfig, footerText: e.target.value })}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={handleTestWebhook}
                                disabled={testingWebhook || !webhookConfig.webhookUrl}
                                style={{
                                    padding: '0.75rem 1.25rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                    background: 'rgba(59, 130, 246, 0.15)',
                                    color: '#60a5fa',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: (testingWebhook || !webhookConfig.webhookUrl) ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span>{testingWebhook ? '⏳ Probando...' : '🧪 Enviar Mensaje de Prueba'}</span>
                            </button>

                            <button
                                type="submit"
                                disabled={submitting}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#3b82f6',
                                    color: '#ffffff',
                                    fontWeight: '800',
                                    fontSize: '0.85rem',
                                    cursor: submitting ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                                }}
                            >
                                {submitting ? 'Guardando...' : 'Guardar Configuración'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
