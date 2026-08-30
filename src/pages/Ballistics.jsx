import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import '../index.css';

function Ballistics() {
    const { t } = useLanguage();
    const { isLSSD } = useTheme();

    // Data states
    const [bullets, setBullets] = useState([]);
    const [weapons, setWeapons] = useState([]);
    const [coincidences, setCoincidences] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [dbError, setDbError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals visibility
    const [showWeaponModal, setShowWeaponModal] = useState(false);
    const [showBulletModal, setShowBulletModal] = useState(false);

    // Form inputs - Bullet
    const [bulletForm, setBulletForm] = useState({
        incidente: '',
        num_serie: ''
    });

    // Form inputs - Weapon
    const [weaponForm, setWeaponForm] = useState({
        propietario: '',
        incidente: '',
        modelo: '',
        num_serie: ''
    });

    // Match alerts state
    const [alertMatch, setAlertMatch] = useState(null); // stores the most recent match for popup alert
    const [seenMatchIds, setSeenMatchIds] = useState([]);
    const [activeTab, setActiveTab] = useState('coincidences');
    const [expandedWeapons, setExpandedWeapons] = useState([]);

    // Load initial data
    useEffect(() => {
        loadData();
        try {
            const seen = JSON.parse(localStorage.getItem('seen_ballistics_matches') || '[]');
            setSeenMatchIds(seen);
        } catch (e) {
            console.error("Error reading localStorage:", e);
        }
    }, []);

    const loadData = async () => {
        setLoading(true);
        setDbError(null);
        try {
            // Fetch Bullets
            const { data: bulletsData, error: bulletsError } = await supabase.rpc('get_ballistics_bullets');
            if (bulletsError) {
                console.error("Error fetching bullets:", bulletsError);
                if (bulletsError.message.includes("does not exist")) {
                    setDbError("El sistema de base de datos de Balística no está inicializado. Por favor ejecuta el archivo SQL 'BBDD/create_ballistics_system.sql' en tu panel de Supabase.");
                    setLoading(false);
                    return;
                }
                throw bulletsError;
            }

            // Fetch Weapons
            const { data: weaponsData, error: weaponsError } = await supabase.rpc('get_ballistics_weapons');
            if (weaponsError) throw weaponsError;

            const fetchedBullets = bulletsData || [];
            const fetchedWeapons = weaponsData || [];

            setBullets(fetchedBullets);
            setWeapons(fetchedWeapons);

            // Compute coincidences
            recalculateCoincidences(fetchedBullets, fetchedWeapons);

        } catch (err) {
            console.error('Error loading ballistics data:', err);
            setDbError(err.message || 'Error al conectar con la base de datos.');
        } finally {
            setLoading(false);
        }
    };

    const recalculateCoincidences = (bulletsList, weaponsList) => {
        const matches = [];
        bulletsList.forEach(bullet => {
            if (!bullet.numero_serie) return;
            const cleanBulletSn = bullet.numero_serie.trim().toLowerCase();
            if (cleanBulletSn === '' || cleanBulletSn === 'n/a') return;

            weaponsList.forEach(weapon => {
                if (!weapon.numero_serie) return;
                const cleanWeaponSn = weapon.numero_serie.trim().toLowerCase();
                if (cleanWeaponSn === '' || cleanWeaponSn === 'n/a') return;

                if (cleanWeaponSn === cleanBulletSn) {
                    const matchId = `${bullet.id}-${weapon.id}`;
                    matches.push({
                        id: matchId,
                        serialNumber: bullet.numero_serie,
                        bullet,
                        weapon,
                        created_at: bullet.created_at > weapon.created_at ? bullet.created_at : weapon.created_at
                    });
                }
            });
        });

        const sortedMatches = matches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setCoincidences(sortedMatches);
    };

    // Submissions
    const handleCreateBullet = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { data, error } = await supabase.rpc('create_ballistics_bullet', {
                p_incidente: bulletForm.incidente,
                p_calibre: 'N/A',
                p_num_serie: bulletForm.num_serie,
                p_modelo_arma: 'N/A'
            });
            if (error) throw error;

            const cleanBulletSn = bulletForm.num_serie.trim().toLowerCase();
            if (cleanBulletSn !== '' && cleanBulletSn !== 'n/a') {
                const matchedWeapon = weapons.find(w => w.numero_serie.trim().toLowerCase() === cleanBulletSn);
                if (matchedWeapon) {
                    setAlertMatch({
                        serialNumber: bulletForm.num_serie,
                        bulletIncident: bulletForm.incidente,
                        weaponModel: matchedWeapon.modelo,
                        weaponOwner: matchedWeapon.propietario
                    });
                }
            }

            setShowBulletModal(false);
            setBulletForm({ incidente: '', num_serie: '' });
            await loadData();
        } catch (err) {
            alert('Error al añadir casquillo: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateWeapon = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const { data, error } = await supabase.rpc('create_ballistics_weapon', {
                p_propietario: weaponForm.propietario,
                p_incidente: weaponForm.incidente,
                p_modelo: weaponForm.modelo,
                p_num_serie: weaponForm.num_serie
            });
            if (error) throw error;

            const cleanWeaponSn = weaponForm.num_serie.trim().toLowerCase();
            if (cleanWeaponSn !== '' && cleanWeaponSn !== 'n/a') {
                const matchedBullet = bullets.find(b => b.numero_serie.trim().toLowerCase() === cleanWeaponSn);
                if (matchedBullet) {
                    setAlertMatch({
                        serialNumber: weaponForm.num_serie,
                        bulletIncident: matchedBullet.incidente_relacionado,
                        weaponModel: weaponForm.modelo,
                        weaponOwner: weaponForm.propietario
                    });
                }
            }

            setShowWeaponModal(false);
            setWeaponForm({ propietario: '', incidente: '', modelo: '', num_serie: '' });
            await loadData();
        } catch (err) {
            alert('Error al añadir arma: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    // Deletions
    const handleDeleteBullet = async (id) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este registro de casquillo?')) return;
        try {
            const { error } = await supabase.rpc('delete_ballistics_bullet', { p_id: id });
            if (error) throw error;
            await loadData();
        } catch (err) {
            alert('Error al eliminar casquillo: ' + err.message);
        }
    };

    const handleDeleteWeapon = async (id) => {
        if (!confirm('¿Estás seguro de que deseas eliminar este registro de arma?')) return;
        try {
            const { error } = await supabase.rpc('delete_ballistics_weapon', { p_id: id });
            if (error) throw error;
            await loadData();
        } catch (err) {
            alert('Error al eliminar arma: ' + err.message);
        }
    };

    // Mark all matches as seen
    const handleMarkAllMatchesAsSeen = () => {
        const allIds = coincidences.map(c => c.id);
        setSeenMatchIds(allIds);
        localStorage.setItem('seen_ballistics_matches', JSON.stringify(allIds));
        setAlertMatch(null);
    };

    // Toggle weapon expand
    const toggleWeaponExpand = (weaponId) => {
        setExpandedWeapons(prev =>
            prev.includes(weaponId)
                ? prev.filter(id => id !== weaponId)
                : [...prev, weaponId]
        );
    };

    // Mark all matches for a specific weapon as seen
    const handleMarkWeaponMatchesAsSeen = (weapon, matchedBullets) => {
        const weaponMatchesIds = matchedBullets.map(bullet => `${bullet.id}-${weapon.id}`);
        const updated = [...new Set([...seenMatchIds, ...weaponMatchesIds])];
        setSeenMatchIds(updated);
        localStorage.setItem('seen_ballistics_matches', JSON.stringify(updated));
    };

    // Filtered lists for search
    const filteredBullets = useMemo(() => {
        if (!searchTerm.trim()) return bullets;
        const term = searchTerm.toLowerCase();
        return bullets.filter(b =>
            (b.numero_serie && b.numero_serie.toLowerCase().includes(term)) ||
            (b.incidente_relacionado && b.incidente_relacionado.toLowerCase().includes(term)) ||
            (b.calibre && b.calibre.toLowerCase().includes(term)) ||
            (b.modelo_arma && b.modelo_arma.toLowerCase().includes(term))
        );
    }, [bullets, searchTerm]);

    const filteredWeapons = useMemo(() => {
        if (!searchTerm.trim()) return weapons;
        const term = searchTerm.toLowerCase();
        return weapons.filter(w =>
            (w.numero_serie && w.numero_serie.toLowerCase().includes(term)) ||
            (w.propietario && w.propietario.toLowerCase().includes(term)) ||
            (w.modelo && w.modelo.toLowerCase().includes(term)) ||
            (w.incidente_relacionado && w.incidente_relacionado.toLowerCase().includes(term))
        );
    }, [weapons, searchTerm]);

    const groupedCoincidences = useMemo(() => {
        return weapons.map(weapon => {
            if (!weapon.numero_serie) return null;
            const cleanWeaponSn = weapon.numero_serie.trim().toLowerCase();
            if (cleanWeaponSn === '' || cleanWeaponSn === 'n/a') return null;

            const matchingBullets = bullets.filter(bullet =>
                bullet.numero_serie && bullet.numero_serie.trim().toLowerCase() === cleanWeaponSn
            );

            if (matchingBullets.length === 0) return null;

            // Search filter check for coincidences
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchesSn = weapon.numero_serie.toLowerCase().includes(term);
                const matchesModel = weapon.modelo.toLowerCase().includes(term);
                const matchesOwner = weapon.propietario.toLowerCase().includes(term);
                const matchesBullets = matchingBullets.some(b =>
                    (b.incidente_relacionado && b.incidente_relacionado.toLowerCase().includes(term)) ||
                    (b.calibre && b.calibre.toLowerCase().includes(term))
                );
                if (!matchesSn && !matchesModel && !matchesOwner && !matchesBullets) return null;
            }

            const newBullets = matchingBullets.filter(bullet => {
                const matchId = `${bullet.id}-${weapon.id}`;
                return !seenMatchIds.includes(matchId);
            });

            return {
                weapon,
                bullets: matchingBullets,
                newBullets,
                isNew: newBullets.length > 0,
                latestDate: matchingBullets.reduce((latest, bullet) => {
                    const bDate = new Date(bullet.created_at);
                    const wDate = new Date(weapon.created_at);
                    const max = bDate > wDate ? bDate : wDate;
                    return max > latest ? max : latest;
                }, new Date(weapon.created_at))
            };
        }).filter(Boolean).sort((a, b) => b.latestDate - a.latestDate);
    }, [weapons, bullets, seenMatchIds, searchTerm]);

    const unseenCoincidencesCount = useMemo(() => {
        return groupedCoincidences.filter(g => g.isNew).length;
    }, [groupedCoincidences]);

    return (
        <div
            id="ballistics-page"
            style={{
                width: '100%',
                height: 'calc(100vh - 80px)',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'transparent',
                padding: '1rem 1.5rem 0 1.5rem',
                boxSizing: 'border-box',
                overflow: 'hidden'
            }}
        >
            <style>{`
                @keyframes goldGlow {
                    0% {
                        box-shadow: 0 0 10px rgba(234, 179, 8, 0.35), inset 0 0 10px rgba(234, 179, 8, 0.08);
                        border-color: rgba(234, 179, 8, 0.5);
                    }
                    50% {
                        box-shadow: 0 0 22px rgba(234, 179, 8, 0.65), inset 0 0 14px rgba(234, 179, 8, 0.25);
                        border-color: rgba(234, 179, 8, 0.9);
                    }
                    100% {
                        box-shadow: 0 0 10px rgba(234, 179, 8, 0.35), inset 0 0 10px rgba(234, 179, 8, 0.08);
                        border-color: rgba(234, 179, 8, 0.5);
                    }
                }
                .new-coincidence-card {
                    animation: goldGlow 2.5s infinite ease-in-out;
                    border: 1px solid rgba(234, 179, 8, 0.6) !important;
                    background: rgba(234, 179, 8, 0.05) !important;
                }
                .glow-badge {
                    background: #eab308;
                    color: #0f172a;
                    font-weight: 800;
                    padding: 3px 9px;
                    border-radius: 20px;
                    font-size: 0.7rem;
                    box-shadow: 0 0 12px rgba(234, 179, 8, 0.7);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                }
                .alert-banner-mac {
                    background: rgba(239, 68, 68, 0.15);
                    backdrop-filter: blur(14px);
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    border-left: 4px solid #ef4444;
                    color: #fca5a5;
                    border-radius: 14px;
                    padding: 1rem 1.25rem;
                    margin-bottom: 1rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-shrink: 0;
                }
            `}</style>

            {/* Apple Command Topbar */}
            <div style={{
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                marginBottom: '0.9rem',
                padding: '0.3rem 0.5rem',
                gap: '1rem',
                flexWrap: 'wrap',
                width: '100%',
                boxSizing: 'border-box',
                flexShrink: 0
            }}>
                {/* Left: Brand Title & Apple Status LED */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: '#22c55e',
                            boxShadow: '0 0 12px #22c55e',
                            display: 'inline-block'
                        }}></span>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.015em' }}>
                                {t('ballistics') || 'Laboratorio de Balística'}
                            </h2>
                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                                <span>Coincidencias: <strong style={{ color: '#fbbf24' }}>{groupedCoincidences.length}</strong></span>
                                {unseenCoincidencesCount > 0 && (
                                    <>
                                        <span>•</span>
                                        <span>Nuevas: <strong style={{ color: '#facc15' }}>{unseenCoincidencesCount}</strong></span>
                                    </>
                                )}
                                <span>•</span>
                                <span>Casquillos: <strong style={{ color: '#60a5fa' }}>{bullets.length}</strong></span>
                                <span>•</span>
                                <span>Armas: <strong style={{ color: '#f87171' }}>{weapons.length}</strong></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Search, Tabs & Action Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Apple Search Input */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.14)',
                        borderRadius: '20px',
                        padding: '0.38rem 0.9rem',
                        gap: '8px',
                        minWidth: '240px',
                        transition: 'border-color 0.2s',
                    }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar Nº Serie, modelo, incidente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: '#fff',
                                fontSize: '0.82rem',
                                width: '100%',
                            }}
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => setSearchTerm('')}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', padding: '0 2px', lineHeight: 1 }}
                            >✕</button>
                        )}
                    </div>

                    {/* Apple Style Pill Tabs Header Navigation */}
                    <div style={{
                        display: 'flex',
                        background: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(12px)',
                        padding: '3px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                        <button
                            type="button"
                            onClick={() => setActiveTab('coincidences')}
                            style={{
                                padding: '0.35rem 0.85rem',
                                borderRadius: '16px',
                                background: activeTab === 'coincidences' ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
                                color: activeTab === 'coincidences' ? '#fde047' : '#94a3b8',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: activeTab === 'coincidences' ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid transparent'
                            }}
                        >
                            {t('coincidences') || 'Coincidencias'} ({groupedCoincidences.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('bullets')}
                            style={{
                                padding: '0.35rem 0.85rem',
                                borderRadius: '16px',
                                background: activeTab === 'bullets' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                                color: activeTab === 'bullets' ? '#93c5fd' : '#94a3b8',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: activeTab === 'bullets' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent'
                            }}
                        >
                            {t('bulletCasings') || 'Casquillos'} ({filteredBullets.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('weapons')}
                            style={{
                                padding: '0.35rem 0.85rem',
                                borderRadius: '16px',
                                background: activeTab === 'weapons' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                                color: activeTab === 'weapons' ? '#fca5a5' : '#94a3b8',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: activeTab === 'weapons' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent'
                            }}
                        >
                            {t('seizedWeapons') || 'Armas Incautadas'} ({filteredWeapons.length})
                        </button>
                    </div>

                    {/* Action Buttons */}
                    <button
                        type="button"
                        onClick={() => setShowBulletModal(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '0.4rem 1.05rem',
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.35)',
                            borderRadius: '20px',
                            color: '#93c5fd',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        {t('addBulletCasing') || 'Registrar Casquillo'}
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowWeaponModal(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '0.4rem 1.05rem',
                            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.35) 100%)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '20px',
                            color: '#fca5a5',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.15)',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        {t('addSeizedWeapon') || 'Registrar Arma Incautada'}
                    </button>
                </div>
            </div>

            {/* Float Alert Match Notification Banner */}
            {alertMatch && (
                <div className="alert-banner-mac">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <div>
                            <h4 style={{ margin: 0, fontWeight: 700, color: '#fca5a5', fontSize: '1rem' }}>
                                {t('newCoincidenceDetected')?.replace('{item}', alertMatch.serialNumber) || `¡Coincidencia detectada! (Nº Serie: ${alertMatch.serialNumber})`}
                            </h4>
                            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#cbd5e1' }}>
                                Coincidencia entre casquillo del <strong>{alertMatch.bulletIncident}</strong> y el arma <strong>{alertMatch.weaponModel}</strong> (Propietario: {alertMatch.weaponOwner}).
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        style={{
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            padding: '0.45rem 1.1rem',
                            borderRadius: '20px',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
                            whiteSpace: 'nowrap'
                        }}
                        onClick={handleMarkAllMatchesAsSeen}
                    >
                        Entendido
                    </button>
                </div>
            )}

            {/* Error or Loading Screen */}
            {dbError ? (
                <div style={{
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    padding: '2.5rem',
                    background: 'rgba(239, 68, 68, 0.08)',
                    borderRadius: '16px',
                    textAlign: 'center',
                    backdropFilter: 'blur(12px)'
                }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 0.75rem auto' }}>
                        <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <h4 style={{ fontWeight: 700, fontSize: '1.1rem', margin: '0 0 0.5rem 0' }}>Error en la Base de Datos</h4>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>{dbError}</p>
                </div>
            ) : loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', fontSize: '0.95rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '18px', height: '18px', border: '2px solid #60a5fa', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                        Cargando laboratorio de balística...
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.35rem', paddingBottom: '1rem' }} className="custom-scrollbar">

                    {/* RENDERING COINCIDENCES TAB */}
                    {activeTab === 'coincidences' && (
                        <div>
                            {groupedCoincidences.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '4rem 1rem',
                                    color: '#64748b',
                                    background: 'rgba(15, 23, 42, 0.3)',
                                    backdropFilter: 'blur(12px)',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(255, 255, 255, 0.06)'
                                }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }}>
                                        <circle cx="11" cy="11" r="8" />
                                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#cbd5e1' }}>
                                        No se han detectado coincidencias de número de serie todavía.
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                                    gap: '1.25rem'
                                }}>
                                    {groupedCoincidences.map(group => {
                                        const isExpanded = expandedWeapons.includes(group.weapon.id);
                                        return (
                                            <div
                                                key={group.weapon.id}
                                                className={`ballistics-list-card ${group.isNew ? 'new-coincidence-card' : ''}`}
                                                style={{
                                                    background: group.isNew ? 'rgba(234, 179, 8, 0.05)' : 'rgba(15, 23, 42, 0.65)',
                                                    backdropFilter: 'blur(16px)',
                                                    border: group.isNew ? '1px solid rgba(234, 179, 8, 0.6)' : '1px solid rgba(255, 255, 255, 0.08)',
                                                    borderRadius: '16px',
                                                    padding: '1.2rem',
                                                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justify: 'space-between',
                                                    transition: 'all 0.25s ease'
                                                }}
                                            >
                                                <div>
                                                    {/* Card Header Top */}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }}></span>
                                                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }}></span>
                                                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#27c93f', display: 'inline-block' }}></span>
                                                            <span style={{
                                                                fontFamily: 'monospace',
                                                                fontWeight: 700,
                                                                color: '#fbbf24',
                                                                background: 'rgba(251, 191, 36, 0.12)',
                                                                border: '1px solid rgba(251, 191, 36, 0.25)',
                                                                padding: '2px 8px',
                                                                borderRadius: '6px',
                                                                fontSize: '0.78rem',
                                                                marginLeft: '6px'
                                                            }}>
                                                                N/S: {group.weapon.numero_serie}
                                                            </span>
                                                        </div>

                                                        {group.isNew ? (
                                                            <span className="glow-badge">
                                                                ★ {t('newBadge') || 'NUEVA'} ({group.newBullets.length})
                                                            </span>
                                                        ) : (
                                                            <span style={{
                                                                fontSize: '0.72rem',
                                                                fontWeight: 600,
                                                                color: '#4ade80',
                                                                background: 'rgba(34, 197, 94, 0.12)',
                                                                border: '1px solid rgba(34, 197, 94, 0.25)',
                                                                padding: '2px 8px',
                                                                borderRadius: '12px'
                                                            }}>
                                                                ✓ {group.bullets.length} Vinculados
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Weapon Info Box */}
                                                    <div style={{
                                                        background: 'rgba(0, 0, 0, 0.28)',
                                                        padding: '0.85rem',
                                                        borderRadius: '12px',
                                                        border: '1px solid rgba(255, 255, 255, 0.05)',
                                                        marginBottom: '0.85rem'
                                                    }}>
                                                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#f87171', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                            {group.weapon.modelo}
                                                        </div>
                                                        <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                                                            <div><span style={{ color: '#94a3b8' }}>Propietario:</span> <strong>{group.weapon.propietario}</strong></div>
                                                            <div><span style={{ color: '#94a3b8' }}>Incidente Incautación:</span> <strong>{group.weapon.incidente_relacionado}</strong></div>
                                                        </div>
                                                    </div>

                                                    {/* Expanded Bullet Relationships */}
                                                    {isExpanded && (
                                                        <div style={{ marginTop: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '0.85rem' }}>
                                                            <div style={{ fontSize: '0.78rem', color: '#60a5fa', marginBottom: '0.5rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                                                Casquillos Vinculados ({group.bullets.length}):
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                {group.bullets.map(bullet => {
                                                                    const isBulletNew = !seenMatchIds.includes(`${bullet.id}-${group.weapon.id}`);
                                                                    return (
                                                                        <div
                                                                            key={bullet.id}
                                                                            style={{
                                                                                background: 'rgba(0, 0, 0, 0.25)',
                                                                                padding: '0.65rem 0.75rem',
                                                                                borderRadius: '8px',
                                                                                fontSize: '0.78rem',
                                                                                borderLeft: isBulletNew ? '3px solid #eab308' : '3px solid #60a5fa',
                                                                                border: '1px solid rgba(255, 255, 255, 0.04)'
                                                                            }}
                                                                        >
                                                                            <div><strong style={{ color: '#f8fafc' }}>Incidente:</strong> {bullet.incidente_relacionado}</div>
                                                                            {((bullet.calibre && bullet.calibre !== 'N/A') || (bullet.modelo_arma && bullet.modelo_arma !== 'N/A')) && (
                                                                                <div style={{ color: '#cbd5e1', marginTop: '2px' }}>
                                                                                    {bullet.calibre && bullet.calibre !== 'N/A' && <><strong>Calibre:</strong> {bullet.calibre} </>}
                                                                                    {bullet.modelo_arma && bullet.modelo_arma !== 'N/A' && <>| <strong>Modelo:</strong> {bullet.modelo_arma}</>}
                                                                                </div>
                                                                            )}
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
                                                                                <span>Por: {bullet.author_rank} {bullet.author_name}</span>
                                                                                <span>{new Date(bullet.created_at).toLocaleDateString()}</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Action Buttons */}
                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                                    <button
                                                        type="button"
                                                        style={{
                                                            flex: 1,
                                                            padding: '0.42rem',
                                                            borderRadius: '10px',
                                                            background: 'rgba(255, 255, 255, 0.06)',
                                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                                            color: '#cbd5e1',
                                                            fontSize: '0.78rem',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s'
                                                        }}
                                                        onClick={() => toggleWeaponExpand(group.weapon.id)}
                                                    >
                                                        {isExpanded ? 'Ocultar Casquillos ▲' : `Ver Casquillos (${group.bullets.length}) ▼`}
                                                    </button>
                                                    {group.isNew && (
                                                        <button
                                                            type="button"
                                                            style={{
                                                                flex: 1,
                                                                padding: '0.42rem',
                                                                borderRadius: '10px',
                                                                background: 'rgba(234, 179, 8, 0.2)',
                                                                border: '1px solid rgba(234, 179, 8, 0.4)',
                                                                color: '#fde047',
                                                                fontSize: '0.78rem',
                                                                fontWeight: 700,
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onClick={() => handleMarkWeaponMatchesAsSeen(group.weapon, group.bullets)}
                                                        >
                                                            Marcar vistos ✓
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* RENDERING BULLETS TAB */}
                    {activeTab === 'bullets' && (
                        <div>
                            {filteredBullets.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '4rem 1rem',
                                    color: '#64748b',
                                    background: 'rgba(15, 23, 42, 0.3)',
                                    backdropFilter: 'blur(12px)',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(255, 255, 255, 0.06)'
                                }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }}>
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#cbd5e1' }}>
                                        No hay casquillos registrados.
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                                    gap: '1.25rem'
                                }}>
                                    {filteredBullets.map(item => (
                                        <div
                                            key={item.id}
                                            style={{
                                                background: 'rgba(15, 23, 42, 0.65)',
                                                backdropFilter: 'blur(16px)',
                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '16px',
                                                padding: '1.15rem',
                                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justify: 'space-between',
                                                position: 'relative'
                                            }}
                                        >
                                            <div>
                                                {/* Header window controls & trash */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }}></span>
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }}></span>
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#27c93f', display: 'inline-block' }}></span>
                                                    </div>
                                                    {item.can_delete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteBullet(item.id)}
                                                            style={{
                                                                background: 'rgba(239, 68, 68, 0.1)',
                                                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                                                color: '#f87171',
                                                                borderRadius: '8px',
                                                                width: '26px',
                                                                height: '26px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justify: 'center',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            title="Eliminar casquillo"
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="3 6 5 6 21 6" />
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Bullet Metadata */}
                                                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.6rem 0.75rem', borderRadius: '8px', marginBottom: '0.65rem' }}>
                                                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('relatedIncident') || 'Incidente'}</span>
                                                    <strong style={{ color: '#f8fafc', fontSize: '0.88rem' }}>{item.incidente_relacionado}</strong>
                                                </div>

                                                {((item.calibre && item.calibre !== 'N/A') || (item.modelo_arma && item.modelo_arma !== 'N/A')) && (
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
                                                        {item.calibre && item.calibre !== 'N/A' && (
                                                            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.55rem', borderRadius: '8px' }}>
                                                                <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('bulletCaliber') || 'Calibre'}</span>
                                                                <strong style={{ color: '#60a5fa', fontSize: '0.85rem' }}>{item.calibre}</strong>
                                                            </div>
                                                        )}
                                                        {item.modelo_arma && item.modelo_arma !== 'N/A' && (
                                                            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.55rem', borderRadius: '8px' }}>
                                                                <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('weaponModel') || 'Modelo del Arma'}</span>
                                                                <strong style={{ color: '#f87171', fontSize: '0.85rem' }}>{item.modelo_arma}</strong>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.55rem 0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                                                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('serialNumber') || 'Número de Serie'}</span>
                                                    <strong style={{ fontFamily: 'monospace', color: '#fbbf24', fontSize: '0.9rem', letterSpacing: '0.04em' }}>{item.numero_serie}</strong>
                                                </div>
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                justify: 'space-between',
                                                fontSize: '0.73rem',
                                                color: '#94a3b8',
                                                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                                paddingTop: '0.55rem',
                                                marginTop: '0.2rem'
                                            }}>
                                                <span>Registrado por: <strong style={{ color: '#e2e8f0' }}>{item.author_rank} {item.author_name}</strong></span>
                                                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* RENDERING WEAPONS TAB */}
                    {activeTab === 'weapons' && (
                        <div>
                            {filteredWeapons.length === 0 ? (
                                <div style={{
                                    textAlign: 'center',
                                    padding: '4rem 1rem',
                                    color: '#64748b',
                                    background: 'rgba(15, 23, 42, 0.3)',
                                    backdropFilter: 'blur(12px)',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(255, 255, 255, 0.06)'
                                }}>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 0.75rem auto', opacity: 0.5 }}>
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                        <line x1="16" y1="2" x2="16" y2="6" />
                                        <line x1="8" y1="2" x2="8" y2="6" />
                                        <line x1="3" y1="10" x2="21" y2="10" />
                                    </svg>
                                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#cbd5e1' }}>
                                        No hay armas registradas.
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                                    gap: '1.25rem'
                                }}>
                                    {filteredWeapons.map(item => (
                                        <div
                                            key={item.id}
                                            style={{
                                                background: 'rgba(15, 23, 42, 0.65)',
                                                backdropFilter: 'blur(16px)',
                                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                                borderRadius: '16px',
                                                padding: '1.15rem',
                                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justify: 'space-between',
                                                position: 'relative'
                                            }}
                                        >
                                            <div>
                                                {/* Header window controls & trash */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }}></span>
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }}></span>
                                                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#27c93f', display: 'inline-block' }}></span>
                                                    </div>
                                                    {item.can_delete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteWeapon(item.id)}
                                                            style={{
                                                                background: 'rgba(239, 68, 68, 0.1)',
                                                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                                                color: '#f87171',
                                                                borderRadius: '8px',
                                                                width: '26px',
                                                                height: '26px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justify: 'center',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            title="Eliminar arma"
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="3 6 5 6 21 6" />
                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Weapon Title / Model */}
                                                <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem', fontWeight: 800, color: '#f87171' }}>
                                                    {item.modelo}
                                                </h3>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.75rem' }}>
                                                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.55rem', borderRadius: '8px' }}>
                                                        <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('ownerName') || 'Propietario'}</span>
                                                        <strong style={{ color: '#f8fafc', fontSize: '0.85rem' }}>{item.propietario}</strong>
                                                    </div>
                                                    <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.55rem', borderRadius: '8px' }}>
                                                        <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('relatedIncident') || 'Incidente'}</span>
                                                        <strong style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{item.incidente_relacionado}</strong>
                                                    </div>
                                                </div>

                                                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.55rem 0.75rem', borderRadius: '8px', marginBottom: '0.75rem' }}>
                                                    <span style={{ color: '#94a3b8', fontSize: '0.72rem', display: 'block', marginBottom: '2px' }}>{t('serialNumber') || 'Número de Serie'}</span>
                                                    <strong style={{ fontFamily: 'monospace', color: '#fbbf24', fontSize: '0.9rem', letterSpacing: '0.04em' }}>{item.numero_serie}</strong>
                                                </div>
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                justify: 'space-between',
                                                fontSize: '0.73rem',
                                                color: '#94a3b8',
                                                borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                                                paddingTop: '0.55rem',
                                                marginTop: '0.2rem'
                                            }}>
                                                <span>Registrado por: <strong style={{ color: '#e2e8f0' }}>{item.author_rank} {item.author_name}</strong></span>
                                                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* --- ADD BULLET CASING MODAL --- */}
            {showBulletModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{
                        maxWidth: '540px',
                        width: '92vw',
                        borderRadius: '20px',
                        background: 'rgba(30, 41, 59, 0.96)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
                        padding: '1.5rem',
                        boxSizing: 'border-box'
                    }}>
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setShowBulletModal(false)} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    {t('addBulletCasing') || 'Registrar Casquillo'}
                                </h3>
                            </div>
                        </div>

                        <form onSubmit={handleCreateBullet} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                    {t('relatedIncident') || 'Incidente Relacionado'}
                                </label>
                                <input
                                    className="form-input"
                                    required
                                    value={bulletForm.incidente}
                                    onChange={e => setBulletForm({ ...bulletForm, incidente: e.target.value })}
                                    placeholder="Ej: Tiroteo en Grove St"
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.75)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: '10px',
                                        color: '#ffffff',
                                        fontSize: '0.88rem',
                                        padding: '0.65rem 0.9rem'
                                    }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#fde047', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                    {t('serialNumber') || 'Número de Serie Balístico'}
                                </label>
                                <input
                                    className="form-input"
                                    required
                                    value={bulletForm.num_serie}
                                    onChange={e => setBulletForm({ ...bulletForm, num_serie: e.target.value })}
                                    placeholder="Ej: SN-12948-BALA"
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.75)',
                                        border: '1px solid rgba(234, 179, 8, 0.4)',
                                        borderRadius: '10px',
                                        color: '#fde047',
                                        fontFamily: 'monospace',
                                        fontWeight: 700,
                                        fontSize: '0.9rem',
                                        padding: '0.65rem 0.9rem'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '1rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowBulletModal(false)} style={{ width: 'auto', padding: '0.5rem 1.4rem', borderRadius: '10px' }}>
                                    {t('cancelBtn') || 'Cancelar'}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto', padding: '0.5rem 1.6rem', borderRadius: '10px', fontWeight: 700 }} disabled={submitting}>
                                    {submitting ? (t('savingBtn') || 'Guardando...') : (t('saveBtn') || 'Guardar Registro')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- ADD SEIZED WEAPON MODAL --- */}
            {showWeaponModal && (
                <div className="mac-modal-overlay">
                    <div className="mac-modal-content" style={{
                        maxWidth: '540px',
                        width: '92vw',
                        borderRadius: '20px',
                        background: 'rgba(30, 41, 59, 0.96)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.85)',
                        padding: '1.5rem',
                        boxSizing: 'border-box'
                    }}>
                        <div className="mac-modal-header" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.12)', paddingBottom: '0.85rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="mac-window-dots">
                                    <span className="mac-window-dot close" onClick={() => setShowWeaponModal(false)} title="Cerrar" />
                                    <span className="mac-window-dot min" />
                                    <span className="mac-window-dot max" />
                                </div>
                                <h3 style={{ margin: '0 0 0 10px', fontSize: '1.15rem', color: '#f8fafc', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                    {t('addSeizedWeapon') || 'Registrar Arma Incautada'}
                                </h3>
                            </div>
                        </div>

                        <form onSubmit={handleCreateWeapon} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#cbd5e1', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                        {t('ownerName') || 'Propietario'}
                                    </label>
                                    <input
                                        className="form-input"
                                        required
                                        value={weaponForm.propietario}
                                        onChange={e => setWeaponForm({ ...weaponForm, propietario: e.target.value })}
                                        placeholder="Ej: Desconocido, John Doe"
                                        style={{
                                            background: 'rgba(15, 23, 42, 0.75)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: '10px',
                                            color: '#ffffff',
                                            fontSize: '0.88rem',
                                            padding: '0.65rem 0.9rem'
                                        }}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label" style={{ fontSize: '0.82rem', color: '#f87171', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                        {t('weaponModel') || 'Modelo del Arma'}
                                    </label>
                                    <input
                                        className="form-input"
                                        required
                                        value={weaponForm.modelo}
                                        onChange={e => setWeaponForm({ ...weaponForm, modelo: e.target.value })}
                                        placeholder="Ej: Combat Pistol, Special Carbine"
                                        style={{
                                            background: 'rgba(15, 23, 42, 0.75)',
                                            border: '1px solid rgba(255, 255, 255, 0.2)',
                                            borderRadius: '10px',
                                            color: '#ffffff',
                                            fontSize: '0.88rem',
                                            padding: '0.65rem 0.9rem'
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#93c5fd', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                    {t('relatedIncident') || 'Incidente Relacionado'}
                                </label>
                                <input
                                    className="form-input"
                                    required
                                    value={weaponForm.incidente}
                                    onChange={e => setWeaponForm({ ...weaponForm, incidente: e.target.value })}
                                    placeholder="Ej: Asalto en Licorería"
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.75)',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                        borderRadius: '10px',
                                        color: '#ffffff',
                                        fontSize: '0.88rem',
                                        padding: '0.65rem 0.9rem'
                                    }}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: '0.82rem', color: '#fde047', fontWeight: 700, marginBottom: '0.4rem', display: 'block' }}>
                                    {t('serialNumber') || 'Número de Serie Balístico'}
                                </label>
                                <input
                                    className="form-input"
                                    required
                                    value={weaponForm.num_serie}
                                    onChange={e => setWeaponForm({ ...weaponForm, num_serie: e.target.value })}
                                    placeholder="Ej: SN-12948-BALA"
                                    style={{
                                        background: 'rgba(15, 23, 42, 0.75)',
                                        border: '1px solid rgba(234, 179, 8, 0.4)',
                                        borderRadius: '10px',
                                        color: '#fde047',
                                        fontFamily: 'monospace',
                                        fontWeight: 700,
                                        fontSize: '0.9rem',
                                        padding: '0.65rem 0.9rem'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.12)', paddingTop: '1rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowWeaponModal(false)} style={{ width: 'auto', padding: '0.5rem 1.4rem', borderRadius: '10px' }}>
                                    {t('cancelBtn') || 'Cancelar'}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto', padding: '0.5rem 1.6rem', borderRadius: '10px', fontWeight: 700 }} disabled={submitting}>
                                    {submitting ? (t('savingBtn') || 'Guardando...') : (t('saveBtn') || 'Guardar Registro')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Ballistics;
