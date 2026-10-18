import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../supabaseClient';
import '../index.css';

function DOJ() {
    const navigate = useNavigate();
    const { language } = useLanguage();
    const { isLSSD } = useTheme();

    const [stats, setStats] = useState({
        openCases: 0,
        totalDocs: 0,
        interrogations: 0,
        civilians: 0,
        sanctions: 0,
        loading: true
    });

    useEffect(() => {
        const fetchQuickStats = async () => {
            try {
                const [casesRes, docsRes, interrogationsRes, civiliansRes, sanctionsRes] = await Promise.allSettled([
                    supabase.rpc('get_doj_cases', { p_status_filter: 'Open' }),
                    supabase.from('doj_documentation').select('id', { count: 'exact', head: true }),
                    supabase.rpc('get_doj_interrogations', { p_case_id: null }),
                    supabase.rpc('get_doj_civilians'),
                    supabase.rpc('get_doj_subjects')
                ]);

                const openCases = casesRes.status === 'fulfilled' && casesRes.value.data ? casesRes.value.data.length : 0;
                const totalDocs = docsRes.status === 'fulfilled' && docsRes.value.count ? docsRes.value.count : 0;
                const interrogations = interrogationsRes.status === 'fulfilled' && interrogationsRes.value.data ? interrogationsRes.value.data.length : 0;
                const civilians = civiliansRes.status === 'fulfilled' && civiliansRes.value.data ? civiliansRes.value.data.length : 0;
                const sanctions = sanctionsRes.status === 'fulfilled' && sanctionsRes.value.data ? sanctionsRes.value.data.length : 0;

                setStats({
                    openCases,
                    totalDocs,
                    interrogations,
                    civilians,
                    sanctions,
                    loading: false
                });
            } catch (err) {
                console.error('Error fetching DOJ stats:', err);
                setStats(prev => ({ ...prev, loading: false }));
            }
        };

        fetchQuickStats();
    }, []);

    const modules = [
        {
            id: 'cases',
            path: '/doj/cases',
            title: language === 'es' ? 'Investigaciones Judiciales' : 'Legal Investigations',
            subtitle: language === 'es' ? 'DOJ Cases Archive' : 'DOJ Cases Archive',
            desc: language === 'es' 
                ? 'Control de sumarios penales, evidencias recopiladas, asignación de fiscales e indagaciones en curso.' 
                : 'Manage case files, collected evidence, assigned agents and active legal inquiries.',
            color: '#3b82f6',
            bgGlow: 'rgba(59, 130, 246, 0.15)',
            badgeText: `${stats.openCases} ${language === 'es' ? 'Activos' : 'Active'}`,
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    <line x1="12" y1="11" x2="12" y2="17"/>
                    <line x1="9" y1="14" x2="15" y2="14"/>
                </svg>
            )
        },
        {
            id: 'docs',
            path: '/doj/docs',
            title: language === 'es' ? 'Documentación & Protocolos' : 'DOJ Documentation',
            subtitle: language === 'es' ? 'Legal Framework & Resources' : 'Legal Framework & Resources',
            desc: language === 'es' 
                ? 'Protocolos de actuación legal, resoluciones judiciales, códigos penales y biblioteca de recursos oficiales.' 
                : 'Legal protocols, judicial resolutions, regulatory penal frameworks and official resources.',
            color: '#f59e0b',
            bgGlow: 'rgba(245, 158, 11, 0.15)',
            badgeText: `${stats.totalDocs} ${language === 'es' ? 'Docs' : 'Docs'}`,
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                </svg>
            )
        },
        {
            id: 'interrogations',
            path: '/doj/interrogations',
            title: language === 'es' ? 'Interrogatorios & Actas' : 'Interrogations Registry',
            subtitle: language === 'es' ? 'Depositions & Audio-Visual Log' : 'Depositions & Audio-Visual Log',
            desc: language === 'es' 
                ? 'Actas oficiales de declaraciones de imputados, testigos protegidos y grabaciones periciales.' 
                : 'Formal records of subject interviews, protected witness depositions and audio-video evidence.',
            color: '#10b981',
            bgGlow: 'rgba(16, 185, 129, 0.15)',
            badgeText: `${stats.interrogations} ${language === 'es' ? 'Registros' : 'Logs'}`,
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
            id: 'licenses',
            path: '/doj/licenses',
            title: language === 'es' ? 'Licencias Ciudadanas' : 'Citizen Licenses & Permits',
            subtitle: language === 'es' ? 'Permits & Equipment Tracking' : 'Permits & Equipment Tracking',
            desc: language === 'es' 
                ? 'Padrón de ciudadanos, expedición de licencias (armas, caza, comerciales) y control de armamento asignado.' 
                : 'Civilian registry, license issuances (CCW, commercial, hunting) and tracked weapon serials.',
            color: '#8b5cf6',
            bgGlow: 'rgba(139, 92, 246, 0.15)',
            badgeText: `${stats.civilians} ${language === 'es' ? 'Ciudadanos' : 'Citizens'}`,
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="3"/>
                    <circle cx="9" cy="10" r="2"/>
                    <line x1="15" y1="8" x2="17" y2="8"/>
                    <line x1="15" y1="12" x2="17" y2="12"/>
                    <line x1="7" y1="16" x2="17" y2="16"/>
                </svg>
            )
        },
        {
            id: 'sanctions',
            path: '/doj/sanctions',
            title: language === 'es' ? 'Amonestaciones & Sanciones' : 'Sanctions & Disciplinary Records',
            subtitle: language === 'es' ? 'Civiles, Letrados & Licencias' : 'Civilians, Lawyers & Licensees',
            desc: language === 'es' 
                ? 'Expedientes sancionadores, amonestaciones y suspensiones para civiles, abogados y titulares de licencias legales.' 
                : 'Disciplinary records, warnings and suspension files for civilians, lawyers and official license holders.',
            color: '#f43f5e',
            bgGlow: 'rgba(244, 63, 94, 0.15)',
            badgeText: `${stats.sanctions} ${language === 'es' ? 'Perfiles' : 'Profiles'}`,
            icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M12 8v4"/>
                    <path d="M12 16h.01"/>
                </svg>
            )
        }
    ];

    return (
        <div className="mac-dashboard-container" style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {/* macOS Command Header Banner */}
            <div 
                className="mac-command-banner" 
                style={{ 
                    marginBottom: '2.5rem', 
                    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(11, 15, 25, 0.95))',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                        <img
                            src="/logowebp/doj-logo.webp"
                            alt="DOJ Logo"
                            style={{
                                height: '78px',
                                width: 'auto',
                                filter: 'drop-shadow(0 6px 20px rgba(37, 99, 235, 0.45))'
                            }}
                            onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = "/logowebp/dojlogo.webp";
                            }}
                        />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
                            <span 
                                className="mac-status-dot" 
                                style={{ 
                                    backgroundColor: '#3b82f6', 
                                    boxShadow: '0 0 10px #3b82f6' 
                                }}
                            ></span>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                {language === 'es' ? 'ESTADO DE SAN ANDREAS • DEPARTAMENTO DE JUSTICIA' : 'STATE OF SAN ANDREAS • DEPARTMENT OF JUSTICE'}
                            </span>
                        </div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: '0.1rem 0 0.3rem 0', color: '#ffffff', letterSpacing: '-0.02em' }}>
                            {language === 'es' ? 'DEPARTMENT OF JUSTICE' : 'DEPARTMENT OF JUSTICE'}
                        </h1>
                        <p style={{ margin: 0, fontSize: '0.86rem', color: '#94a3b8', fontWeight: 500 }}>
                            {language === 'es' 
                                ? 'Sistema Integrado de Fiscalía, Control de Licencias y Diligencias Judiciales' 
                                : 'Integrated Prosecution System, Licensing Registry & Judicial Inquiries'}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        background: 'rgba(59, 130, 246, 0.12)', 
                        border: '1px solid rgba(59, 130, 246, 0.3)', 
                        padding: '0.45rem 1rem', 
                        borderRadius: '9999px',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#60a5fa', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                            {language === 'es' ? 'Acceso Clasificado' : 'Authorized Personnel Only'}
                        </span>
                    </div>

                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem', 
                        background: 'rgba(245, 158, 11, 0.12)', 
                        border: '1px solid rgba(245, 158, 11, 0.3)', 
                        padding: '0.45rem 1rem', 
                        borderRadius: '9999px',
                        backdropFilter: 'blur(10px)'
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5" />
                            <path d="M2 12l10 5 10-5" />
                        </svg>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fbbf24', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                            {language === 'es' ? 'Tribunal Superior' : 'Superior Court'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Quick Summary Metric Strip */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                <div style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    backdropFilter: 'blur(12px)'
                }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#60a5fa'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                            {stats.loading ? '...' : stats.openCases}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {language === 'es' ? 'Casos Abiertos' : 'Open Cases'}
                        </div>
                    </div>
                </div>

                <div style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    backdropFilter: 'blur(12px)'
                }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fbbf24'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                            {stats.loading ? '...' : stats.totalDocs}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {language === 'es' ? 'Documentos' : 'Legal Docs'}
                        </div>
                    </div>
                </div>

                <div style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    backdropFilter: 'blur(12px)'
                }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#34d399'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                            {stats.loading ? '...' : stats.interrogations}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {language === 'es' ? 'Interrogatorios' : 'Interrogations'}
                        </div>
                    </div>
                </div>

                <div style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    backdropFilter: 'blur(12px)'
                }}>
                    <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: 'rgba(139, 92, 246, 0.15)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#c084fc'
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="16" rx="3"/>
                            <circle cx="9" cy="10" r="2"/>
                        </svg>
                    </div>
                    <div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.1 }}>
                            {stats.loading ? '...' : stats.civilians}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {language === 'es' ? 'Ciudadanos' : 'Civilians'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Dashboard Modules Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '1.5rem',
                marginBottom: '3rem'
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
                            background: 'rgba(15, 23, 42, 0.72)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '20px',
                            overflow: 'hidden'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = `0 18px 38px -10px ${mod.bgGlow}, 0 0 0 1px ${mod.color}40`;
                            e.currentTarget.style.borderColor = mod.color;
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                            e.currentTarget.style.borderLeftColor = mod.color;
                        }}
                    >
                        {/* Module Top Row */}
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
                                color: mod.color,
                                boxShadow: `0 8px 16px -4px ${mod.bgGlow}`
                            }}>
                                {mod.icon}
                            </div>

                            <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '0.3rem 0.75rem',
                                borderRadius: '9999px',
                                background: mod.bgGlow,
                                border: `1px solid ${mod.color}40`,
                                color: mod.color,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em'
                            }}>
                                {mod.badgeText}
                            </span>
                        </div>

                        {/* Module Titles */}
                        <div style={{ marginBottom: '0.6rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: mod.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>
                                {mod.subtitle}
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.015em' }}>
                                {mod.title}
                            </h3>
                        </div>

                        {/* Module Description */}
                        <p style={{
                            fontSize: '0.86rem',
                            color: '#94a3b8',
                            lineHeight: 1.5,
                            margin: '0 0 1.5rem 0',
                            flex: 1
                        }}>
                            {mod.desc}
                        </p>

                        {/* Footer Enter Link */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingTop: '0.85rem',
                            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            color: mod.color
                        }}>
                            <span>{language === 'es' ? 'Acceder al Módulo' : 'Enter Module'}</span>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12" />
                                <polyline points="12 5 19 12 12 19" />
                            </svg>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default DOJ;
