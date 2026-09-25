import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { DEFAULT_SANCTION_DURATIONS, fetchSanctionDurations } from '../utils/sanctionConfig';
import { 
    getDiscordIAComplaintsWebhookConfig, 
    saveDiscordIAComplaintsWebhookConfig, 
    testIAComplaintsDiscordWebhook,
    DEFAULT_IA_COMPLAINTS_BOT_NAME,
    DEFAULT_IA_COMPLAINTS_CUSTOM_MSG
} from '../utils/discordWebhook';
import { uploadImageToStorage } from '../utils/imageStorage';
import '../index.css';

function InternalAffairs() {
    const navigate = useNavigate();
    const { isLSSD, branding } = useTheme();
    const { language } = useLanguage();

    // Sanction Durations State
    const [sanctionDays, setSanctionDays] = useState({
        Leve: DEFAULT_SANCTION_DURATIONS.Leve,
        Media: DEFAULT_SANCTION_DURATIONS.Media,
        Grave: DEFAULT_SANCTION_DURATIONS.Grave
    });
    const [savingDurations, setSavingDurations] = useState(false);
    const [durationSavedNotice, setDurationSavedNotice] = useState(false);

    // IA Complaints Discord Webhook State
    const [currentUserProfile, setCurrentUserProfile] = useState(null);
    const avatarInputRef = useRef(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [complaintWebhook, setComplaintWebhook] = useState({
        webhookUrl: '',
        enabled: false,
        rolePing: '',
        botName: DEFAULT_IA_COMPLAINTS_BOT_NAME,
        botAvatar: '',
        customMsg: DEFAULT_IA_COMPLAINTS_CUSTOM_MSG
    });
    const [savingWebhook, setSavingWebhook] = useState(false);
    const [webhookSavedNotice, setWebhookSavedNotice] = useState(false);
    const [testingWebhook, setTestingWebhook] = useState(false);
    const [webhookTestNotice, setWebhookTestNotice] = useState(null);
    const [webhookTestError, setWebhookTestError] = useState(null);

    const loadUserProfile = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data } = await supabase
                    .from('users')
                    .select('id, rol, rango')
                    .eq('id', session.user.id)
                    .single();
                setCurrentUserProfile(data);
            }
        } catch (e) {
            console.error("Error loading profile:", e);
        }
    };

    const canManageWebhook = () => {
        if (!currentUserProfile) return false;
        const role = (currentUserProfile.rol || '').toLowerCase().trim();
        const rank = (currentUserProfile.rango || '').toLowerCase().trim();
        const allowed = ['coordinador', 'comisionado', 'administrador', 'superadmin', 'admin'];
        return allowed.some(a => role.includes(a)) || allowed.some(a => rank.includes(a));
    };

    useEffect(() => {
        const loadConfigs = async () => {
            const loadedDurations = await fetchSanctionDurations();
            setSanctionDays(loadedDurations);

            const webhookCfg = await getDiscordIAComplaintsWebhookConfig();
            setComplaintWebhook(webhookCfg);
        };
        loadConfigs();
        loadUserProfile();
    }, []);

    const handleSaveComplaintWebhook = async (e) => {
        e.preventDefault();
        setSavingWebhook(true);
        setWebhookSavedNotice(false);
        try {
            const res = await saveDiscordIAComplaintsWebhookConfig(complaintWebhook);
            if (res.success) {
                setWebhookSavedNotice(true);
                setTimeout(() => setWebhookSavedNotice(false), 4000);
            } else {
                alert((language === 'es' ? 'Error al guardar webhook: ' : 'Error saving webhook: ') + res.error);
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSavingWebhook(false);
        }
    };

    const handleTestComplaintWebhook = async () => {
        setTestingWebhook(true);
        setWebhookTestNotice(null);
        setWebhookTestError(null);
        try {
            const res = await testIAComplaintsDiscordWebhook(complaintWebhook);
            if (res.success) {
                setWebhookTestNotice(language === 'es' ? '¡Mensaje de prueba enviado con éxito a Discord!' : 'Test message sent successfully to Discord!');
                setTimeout(() => setWebhookTestNotice(null), 5000);
            } else {
                setWebhookTestError(res.error || 'Error al conectar con Discord');
                setTimeout(() => setWebhookTestError(null), 6000);
            }
        } catch (err) {
            setWebhookTestError(err.message);
            setTimeout(() => setWebhookTestError(null), 6000);
        } finally {
            setTestingWebhook(false);
        }
    };

    const handleAvatarFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingAvatar(true);
        setWebhookTestError(null);
        try {
            const publicUrl = await uploadImageToStorage(file, 'branding');
            if (publicUrl) {
                setComplaintWebhook(prev => ({ ...prev, botAvatar: publicUrl }));
                setWebhookTestNotice("Avatar subido exitosamente.");
                setTimeout(() => setWebhookTestNotice(null), 3500);
            }
        } catch (err) {
            console.error("Error al subir avatar:", err);
            setWebhookTestError("Error al subir imagen: " + err.message);
        } finally {
            setUploadingAvatar(false);
            if (avatarInputRef.current) avatarInputRef.current.value = '';
        }
    };

    const handleSaveSanctionDurations = async (e) => {
        e.preventDefault();
        setSavingDurations(true);
        setDurationSavedNotice(false);

        const leveVal = parseInt(sanctionDays.Leve, 10) || 7;
        const mediaVal = parseInt(sanctionDays.Media, 10) || 14;
        const graveVal = parseInt(sanctionDays.Grave, 10) || 20;

        try {
            // Try via RPC first
            const { error: rpcError } = await supabase.rpc('update_sanction_durations', {
                p_leve: leveVal,
                p_media: mediaVal,
                p_grave: graveVal
            });

            if (rpcError) {
                // Fallback to direct app_settings upsert
                const updates = [
                    { key: 'sanction_days_leve', value: String(leveVal) },
                    { key: 'sanction_days_media', value: String(mediaVal) },
                    { key: 'sanction_days_grave', value: String(graveVal) }
                ];
                const { error: upsertError } = await supabase.from('app_settings').upsert(updates);
                if (upsertError) throw upsertError;
            }

            setSanctionDays({ Leve: leveVal, Media: mediaVal, Grave: graveVal });
            setDurationSavedNotice(true);
            setTimeout(() => setDurationSavedNotice(false), 4000);
        } catch (err) {
            alert((language === 'es' ? 'Error al guardar duraciones de sanciones: ' : 'Error saving sanction durations: ') + err.message);
        } finally {
            setSavingDurations(false);
        }
    };

    const modules = [
        {
            id: 'cases',
            path: '/internal-affairs/cases',
            title: language === 'es' ? 'Investigaciones Internas' : 'Internal Investigations',
            desc: language === 'es' ? 'Gestionar archivos de casos e indagaciones activas de la división.' : 'Manage case files and active inquiries.',
            color: '#ef4444',
            bgGlow: 'rgba(239, 68, 68, 0.12)',
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
            )
        },
        {
            id: 'docs',
            path: '/internal-affairs/docs',
            title: language === 'es' ? 'Documentación de IA' : 'IA Documentation',
            desc: language === 'es' ? 'Protocolos, normativas internas y recursos clasificados.' : 'Classified protocols and resources.',
            color: '#f59e0b',
            bgGlow: 'rgba(245, 158, 11, 0.12)',
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
            )
        },
        {
            id: 'interrogations',
            path: '/internal-affairs/interrogations',
            title: language === 'es' ? 'Interrogatorios' : 'Interrogations',
            desc: language === 'es' ? 'Registro y actas de entrevistas a sujetos bajo investigación.' : 'Subject interviews registry.',
            color: '#14b8a6',
            bgGlow: 'rgba(20, 184, 166, 0.12)',
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
            )
        },
        {
            id: 'sanctions',
            path: '/internal-affairs/sanctions',
            title: language === 'es' ? 'Sanciones Disciplinarias' : 'Disciplinary Sanctions',
            desc: language === 'es' ? 'Registro de acciones disciplinarias y expediente de agentes.' : 'Disciplinary actions log.',
            color: '#8b5cf6',
            bgGlow: 'rgba(139, 92, 246, 0.12)',
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v18"/>
                    <path d="M5 8l7-5 7 5"/>
                    <path d="M5 12h14"/>
                    <path d="M3 20h18"/>
                </svg>
            )
        },
        {
            id: 'receptor',
            path: '/internal-affairs/receptor-denuncias',
            title: language === 'es' ? 'Receptor de Denuncias' : 'Complaints Receiver',
            desc: language === 'es' ? 'Recibir y gestionar denuncias de Asuntos Internos.' : 'Receive and manage Internal Affairs complaints.',
            color: '#38bdf8',
            bgGlow: 'rgba(56, 189, 248, 0.12)',
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
                    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
                </svg>
            )
        },
        {
            id: 'publicacion-faltas',
            path: '/internal-affairs/publicacion-faltas',
            title: language === 'es' ? 'Publicación Faltas' : 'Sanctions Publishing',
            desc: language === 'es' ? 'Publicar sanciones disciplinarias en Discord con banners oficiales (Leves, Medias, Graves, Despido).' : 'Publish disciplinary sanctions to Discord with official banners.',
            color: '#ef4444',
            bgGlow: 'rgba(239, 68, 68, 0.16)',
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            )
        },
        {
            id: 'miembros-iab',
            path: '/internal-affairs/miembros',
            title: language === 'es' ? 'Plantilla Miembros Discord' : 'IA Discord Roster',
            desc: language === 'es' ? 'Organizar y publicar la lista oficial de miembros de Asuntos Internos en Discord (#miembros-iab).' : 'Manage and publish official Internal Affairs roster on Discord.',
            color: '#f43f5e',
            bgGlow: 'rgba(244, 63, 94, 0.16)',
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
            )
        }
    ];

    return (
        <div className="mac-dashboard-container">
            {/* Command Header Banner */}
            <div className="mac-command-banner" style={{ marginBottom: '2.5rem', background: 'linear-gradient(135deg, rgba(30, 27, 38, 0.75), rgba(15, 23, 42, 0.85))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <img
                        src={branding?.ia_logo || (isLSSD ? "/logowebp/IALSSD.webp" : "/logowebp/ialogo.webp")}
                        alt="IA Division Logo"
                        style={{
                            height: '75px',
                            width: 'auto',
                            filter: `drop-shadow(0 4px 16px ${isLSSD ? 'rgba(74, 222, 128, 0.4)' : 'rgba(239, 68, 68, 0.45)'})`
                        }}
                        onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = isLSSD ? "/logowebp/IALSSD.webp" : "/logowebp/ialogo.webp";
                        }}
                    />
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <span className="mac-status-dot" style={{ backgroundColor: '#ef4444', boxShadow: '0 0 10px #ef4444' }}></span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {branding?.ia_badge || (isLSSD ? "Sheriff Internal Affairs Division" : "Internal Affairs Bureau")}
                            </span>
                        </div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0.2rem 0 0.4rem 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {branding?.ia_title || (language === 'es' ? 'ASUNTOS INTERNOS' : 'INTERNAL AFFAIRS')}
                        </h1>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.4rem 0.9rem', borderRadius: '20px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f87171', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {language === 'es' ? 'Solo Personal Autorizado' : 'Authorized Personnel Only'}
                    </span>
                </div>
            </div>

            {/* Dashboard Modules Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2.5rem'
            }}>
                {modules.map(mod => (
                    <div
                        key={mod.id}
                        className="mac-widget-card"
                        onClick={() => navigate(mod.path)}
                        style={{
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '1.6rem',
                            position: 'relative',
                            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, border-color 0.25s ease',
                            borderLeft: `4px solid ${mod.color}`,
                            overflow: 'hidden'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = `0 16px 36px -8px ${mod.bgGlow}`;
                            e.currentTarget.style.borderColor = mod.color;
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        }}
                    >
                        {/* Module Icon Container */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '1.25rem'
                        }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                borderRadius: '16px',
                                background: mod.bgGlow,
                                border: `1px solid ${mod.color}35`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: mod.color
                            }}>
                                {mod.icon}
                            </div>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64748b' }}>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                                <polyline points="12 5 19 12 12 19"/>
                            </svg>
                        </div>

                        {/* Title & Description */}
                        <h3 style={{
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            color: '#ffffff',
                            margin: '0 0 0.5rem 0',
                            letterSpacing: '-0.01em'
                        }}>
                            {mod.title}
                        </h3>
                        <p style={{
                            fontSize: '0.85rem',
                            color: '#94a3b8',
                            lineHeight: '1.5',
                            margin: 0
                        }}>
                            {mod.desc}
                        </p>
                    </div>
                ))}
            </div>

            {/* Vigencia de Sanciones (Asuntos Internos) Section */}
            <div className="coordination-card" style={{
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '2rem',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.3)'
            }}>
                <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
                    <h3 style={{
                        margin: '0 0 0.4rem 0',
                        fontSize: '1.15rem',
                        fontWeight: 800,
                        color: '#f59e0b',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <span>⚖️</span>
                        <span>{language === 'es' ? 'VIGENCIA DE SANCIONES (ASUNTOS INTERNOS)' : 'INTERNAL AFFAIRS SANCTION DURATIONS'}</span>
                    </h3>
                    <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem' }}>
                        {language === 'es' 
                            ? 'Establece los días de caducidad para las faltas disciplinarias. Empiezan a contar desde la fecha en que se aplica la sanción.' 
                            : 'Configure the active expiration days for disciplinary offenses. Counts start from the sanction date.'}
                    </p>
                </div>

                <form onSubmit={handleSaveSanctionDurations}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: '1.25rem',
                        marginBottom: '1.5rem'
                    }}>
                        {/* Falta Leve */}
                        <div style={{
                            background: 'rgba(56, 189, 248, 0.06)',
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            borderRadius: '12px',
                            padding: '1.25rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38bdf8' }}></span>
                                <h4 style={{ margin: 0, color: '#38bdf8', fontSize: '0.95rem', fontWeight: 700 }}>
                                    {language === 'es' ? 'Falta Leve' : 'Minor Offense'}
                                </h4>
                            </div>
                            <p style={{ margin: '0 0 0.85rem 0', color: '#94a3b8', fontSize: '0.78rem' }}>
                                {language === 'es' ? 'Amonestaciones / Infracciones leves' : 'Minor infractions'} (Default: 7 {language === 'es' ? 'días' : 'days'})
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="number"
                                    min="1"
                                    max="365"
                                    required
                                    className="mac-form-input"
                                    style={{
                                        width: '80px',
                                        padding: '0.45rem 0.65rem',
                                        textAlign: 'center',
                                        fontWeight: 700,
                                        background: 'rgba(0, 0, 0, 0.4)',
                                        border: '1px solid rgba(56, 189, 248, 0.3)',
                                        borderRadius: '8px',
                                        color: '#ffffff'
                                    }}
                                    value={sanctionDays.Leve}
                                    onChange={e => setSanctionDays({ ...sanctionDays, Leve: e.target.value })}
                                />
                                <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>
                                    {language === 'es' ? 'Días activo' : 'Days active'}
                                </span>
                            </div>
                        </div>

                        {/* Falta Media */}
                        <div style={{
                            background: 'rgba(245, 158, 11, 0.06)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            borderRadius: '12px',
                            padding: '1.25rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></span>
                                <h4 style={{ margin: 0, color: '#f59e0b', fontSize: '0.95rem', fontWeight: 700 }}>
                                    {language === 'es' ? 'Falta Media' : 'Moderate Offense'}
                                </h4>
                            </div>
                            <p style={{ margin: '0 0 0.85rem 0', color: '#94a3b8', fontSize: '0.78rem' }}>
                                {language === 'es' ? 'Suspensiones temporales / Faltas medias' : 'Moderate infractions'} (Default: 14 {language === 'es' ? 'días' : 'days'})
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="number"
                                    min="1"
                                    max="365"
                                    required
                                    className="mac-form-input"
                                    style={{
                                        width: '80px',
                                        padding: '0.45rem 0.65rem',
                                        textAlign: 'center',
                                        fontWeight: 700,
                                        background: 'rgba(0, 0, 0, 0.4)',
                                        border: '1px solid rgba(245, 158, 11, 0.3)',
                                        borderRadius: '8px',
                                        color: '#ffffff'
                                    }}
                                    value={sanctionDays.Media}
                                    onChange={e => setSanctionDays({ ...sanctionDays, Media: e.target.value })}
                                />
                                <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>
                                    {language === 'es' ? 'Días activo' : 'Days active'}
                                </span>
                            </div>
                        </div>

                        {/* Falta Grave */}
                        <div style={{
                            background: 'rgba(239, 68, 68, 0.06)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '12px',
                            padding: '1.25rem'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></span>
                                <h4 style={{ margin: 0, color: '#f87171', fontSize: '0.95rem', fontWeight: 700 }}>
                                    {language === 'es' ? 'Falta Grave' : 'Major Offense'}
                                </h4>
                            </div>
                            <p style={{ margin: '0 0 0.85rem 0', color: '#94a3b8', fontSize: '0.78rem' }}>
                                {language === 'es' ? 'Expulsiones / Faltas severas' : 'Major disciplinary offenses'} (Default: 20 {language === 'es' ? 'días' : 'days'})
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                    type="number"
                                    min="1"
                                    max="365"
                                    required
                                    className="mac-form-input"
                                    style={{
                                        width: '80px',
                                        padding: '0.45rem 0.65rem',
                                        textAlign: 'center',
                                        fontWeight: 700,
                                        background: 'rgba(0, 0, 0, 0.4)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        borderRadius: '8px',
                                        color: '#ffffff'
                                    }}
                                    value={sanctionDays.Grave}
                                    onChange={e => setSanctionDays({ ...sanctionDays, Grave: e.target.value })}
                                />
                                <span style={{ color: '#cbd5e1', fontSize: '0.85rem', fontWeight: 600 }}>
                                    {language === 'es' ? 'Días activo' : 'Days active'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem' }}>
                        {durationSavedNotice && (
                            <span style={{ color: '#34d399', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                <span>{language === 'es' ? '¡Duraciones guardadas correctamente!' : 'Durations saved successfully!'}</span>
                            </span>
                        )}
                        <button
                            type="submit"
                            className="mac-btn mac-btn-primary"
                            disabled={savingDurations}
                            style={{
                                padding: '0.55rem 1.4rem',
                                fontSize: '0.88rem',
                                fontWeight: 700,
                                background: '#10b981',
                                borderColor: '#059669',
                                cursor: savingDurations ? 'wait' : 'pointer'
                            }}
                        >
                            {savingDurations 
                                ? (language === 'es' ? 'Guardando...' : 'Saving...') 
                                : (language === 'es' ? 'Guardar Duraciones de Sanciones' : 'Save Sanction Durations')}
                        </button>
                    </div>
                </form>
            </div>

            {/* Configuración Discord Webhook para Denuncias Ciudadanas (Only for Coordinador, Comisionado, Administrador) */}
            {canManageWebhook() && (
                <div className="coordination-card" style={{
                    marginTop: '2rem',
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '2rem',
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
                        <div>
                            <h3 style={{
                                margin: '0 0 0.4rem 0',
                                fontSize: '1.15rem',
                                fontWeight: 800,
                                color: '#38bdf8',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}>
                                <span>🔔</span>
                                <span>{language === 'es' ? 'NOTIFICACIONES DISCORD DE NUEVAS DENUNCIAS (FORMULARIO IA)' : 'DISCORD NOTIFICATIONS FOR NEW IA COMPLAINTS'}</span>
                            </h3>
                            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem' }}>
                                {language === 'es' 
                                    ? 'Al recibir una nueva denuncia desde el formulario, se enviará una notificación automática al canal de Discord con los datos del caso para que el equipo de IA la revise y asigne en la BBDD.' 
                                    : 'Automatically notifies the configured Discord channel when a citizen submits a complaint, prompting IA staff to review and assign it in the database.'}
                            </p>
                        </div>

                        {/* Enabled Switch */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(0,0,0,0.4)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: complaintWebhook.enabled ? '#34d399' : '#94a3b8' }}>
                                {complaintWebhook.enabled ? (language === 'es' ? 'Webhook Activo' : 'Webhook Active') : (language === 'es' ? 'Webhook Inactivo' : 'Webhook Inactive')}
                            </span>
                            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px' }}>
                                <input 
                                    type="checkbox" 
                                    checked={complaintWebhook.enabled} 
                                    onChange={e => setComplaintWebhook({ ...complaintWebhook, enabled: e.target.checked })} 
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span className="slider round" style={{ 
                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, 
                                    backgroundColor: complaintWebhook.enabled ? '#059669' : '#334155', 
                                    transition: '.3s', borderRadius: '28px'
                                }}>
                                    <span style={{
                                        position: 'absolute', content: '""', height: '20px', width: '20px', left: '4px', bottom: '4px',
                                        backgroundColor: 'white', transition: '.3s', borderRadius: '50%',
                                        transform: complaintWebhook.enabled ? 'translateX(22px)' : 'translateX(0)'
                                    }}></span>
                                </span>
                            </label>
                        </div>
                    </div>

                    <form onSubmit={handleSaveComplaintWebhook}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                            {/* Webhook URL */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    {language === 'es' ? 'URL del Webhook de Discord (Canal de Notificaciones de IA)' : 'Discord Webhook URL (IA Notifications Channel)'} <span style={{ color: '#f87171' }}>*</span>
                                </label>
                                <input
                                    type="url"
                                    required={complaintWebhook.enabled}
                                    value={complaintWebhook.webhookUrl}
                                    onChange={e => setComplaintWebhook({ ...complaintWebhook, webhookUrl: e.target.value })}
                                    placeholder="https://discord.com/api/webhooks/1234567890/abcdef..."
                                    className="mac-form-input"
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.9rem' }}
                                />
                            </div>

                            {/* Role Ping */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    {language === 'es' ? 'Mención de Rol / Notificación' : 'Role Mention / Ping'}
                                </label>
                                <input
                                    type="text"
                                    value={complaintWebhook.rolePing}
                                    onChange={e => setComplaintWebhook({ ...complaintWebhook, rolePing: e.target.value })}
                                    placeholder="Ej: @everyone, @here, o ID de rol"
                                    className="mac-form-input"
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.9rem' }}
                                />
                            </div>

                            {/* Bot Name */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    {language === 'es' ? 'Nombre del Bot en Discord' : 'Discord Bot Name'}
                                </label>
                                <input
                                    type="text"
                                    value={complaintWebhook.botName}
                                    onChange={e => setComplaintWebhook({ ...complaintWebhook, botName: e.target.value })}
                                    placeholder="Ej: IA • Notificaciones de Denuncias"
                                    className="mac-form-input"
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.9rem' }}
                                />
                            </div>

                            {/* Bot Avatar URL */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    {language === 'es' ? 'Avatar / Logo del Bot (URL o Archivo Local)' : 'Bot Avatar / Logo (URL or Local File)'}
                                </label>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    {complaintWebhook.botAvatar && (
                                        <img 
                                            src={complaintWebhook.botAvatar} 
                                            alt="Bot Avatar" 
                                            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0, background: 'rgba(0,0,0,0.4)' }}
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                        />
                                    )}
                                    <input
                                        type="text"
                                        value={complaintWebhook.botAvatar}
                                        onChange={e => setComplaintWebhook({ ...complaintWebhook, botAvatar: e.target.value })}
                                        placeholder="/logowebp/IALSSD.webp o URL directa"
                                        className="mac-form-input"
                                        style={{ flex: 1, padding: '0.65rem 0.9rem', fontSize: '0.9rem' }}
                                    />
                                    <input
                                        type="file"
                                        ref={avatarInputRef}
                                        onChange={handleAvatarFileChange}
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => avatarInputRef.current?.click()}
                                        disabled={uploadingAvatar}
                                        className="mac-btn mac-btn-secondary"
                                        style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        <span>📁</span>
                                        <span>{uploadingAvatar ? (language === 'es' ? 'Subiendo...' : 'Uploading...') : (language === 'es' ? 'Elegir archivo' : 'Choose file')}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Custom Msg */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.4rem' }}>
                                    {language === 'es' ? 'Mensaje de Aviso en Cabecera' : 'Header Notification Message'}
                                </label>
                                <textarea
                                    value={complaintWebhook.customMsg}
                                    onChange={e => setComplaintWebhook({ ...complaintWebhook, customMsg: e.target.value })}
                                    placeholder="Ej: ⚠️ **Nueva Denuncia Ciudadana Recibida**. Por favor, revisad la Base de Datos para verificarla y asignarla."
                                    className="mac-form-input"
                                    rows={2}
                                    style={{ width: '100%', padding: '0.65rem 0.9rem', fontSize: '0.9rem', resize: 'vertical' }}
                                />
                            </div>
                        </div>

                        {/* Feedback notices */}
                        {webhookTestNotice && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem', color: '#34d399', fontSize: '0.88rem', fontWeight: 600 }}>
                                ✅ {webhookTestNotice}
                            </div>
                        )}
                        {webhookTestError && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem', color: '#f87171', fontSize: '0.88rem', fontWeight: 600 }}>
                                ❌ {webhookTestError}
                            </div>
                        )}
                        {webhookSavedNotice && (
                            <div style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.4)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem', color: '#38bdf8', fontSize: '0.88rem', fontWeight: 600 }}>
                                ✅ {language === 'es' ? '¡Configuración de Webhook guardada exitosamente!' : 'Webhook configuration saved successfully!'}
                            </div>
                        )}

                        {/* Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem' }}>
                            <button
                                type="button"
                                onClick={handleTestComplaintWebhook}
                                disabled={testingWebhook || !complaintWebhook.webhookUrl}
                                className="mac-btn mac-btn-secondary"
                                style={{
                                    padding: '0.6rem 1.25rem',
                                    fontSize: '0.88rem',
                                    fontWeight: 700,
                                    opacity: !complaintWebhook.webhookUrl ? 0.5 : 1
                                }}
                            >
                                {testingWebhook 
                                    ? (language === 'es' ? 'Enviando prueba...' : 'Testing...') 
                                    : (language === 'es' ? '🧪 Enviar Mensaje de Prueba' : '🧪 Send Test Message')}
                            </button>
                            <button
                                type="submit"
                                className="mac-btn mac-btn-primary"
                                disabled={savingWebhook}
                                style={{
                                    padding: '0.6rem 1.5rem',
                                    fontSize: '0.88rem',
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                                    borderColor: '#0284c7',
                                    cursor: savingWebhook ? 'wait' : 'pointer'
                                }}
                            >
                                {savingWebhook 
                                    ? (language === 'es' ? 'Guardando...' : 'Saving...') 
                                    : (language === 'es' ? '💾 Guardar Configuración Discord' : '💾 Save Discord Config')}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

export default InternalAffairs;
