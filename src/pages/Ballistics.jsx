import { useState, useEffect } from 'react';
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

    // Modals visibility
    const [showWeaponModal, setShowWeaponModal] = useState(false);
    const [showBulletModal, setShowBulletModal] = useState(false);

    // Form inputs - Bullet
    const [bulletForm, setBulletForm] = useState({
        incidente: '',
        calibre: '',
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
        // Load read/seen matches from local storage
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
                // If RPC fails because tables/RPCs don't exist yet, catch it
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

        // Sort by newest match first
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
                p_calibre: bulletForm.calibre,
                p_num_serie: bulletForm.num_serie
            });
            if (error) throw error;

            // Compute potential new matches before state updates
            const newBulletObj = {
                id: data,
                incidente_relacionado: bulletForm.incidente,
                calibre: bulletForm.calibre,
                numero_serie: bulletForm.num_serie,
                created_at: new Date().toISOString()
            };

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
            setBulletForm({ incidente: '', calibre: '', num_serie: '' });
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

            // Compute potential new matches before state updates
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

    // Mark single match as seen
    const handleMarkMatchAsSeen = (matchId) => {
        const updated = [...seenMatchIds, matchId];
        setSeenMatchIds(updated);
        localStorage.setItem('seen_ballistics_matches', JSON.stringify(updated));
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

    return (
        <div className="documentation-container" style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem' }}>
            
            {/* Custom styles for glow effect and layout styling */}
            <style>{`
                @keyframes goldGlow {
                    0% {
                        box-shadow: 0 0 8px rgba(234, 179, 8, 0.4), inset 0 0 8px rgba(234, 179, 8, 0.1);
                        border-color: rgba(234, 179, 8, 0.5);
                    }
                    50% {
                        box-shadow: 0 0 20px rgba(234, 179, 8, 0.7), inset 0 0 12px rgba(234, 179, 8, 0.3);
                        border-color: rgba(234, 179, 8, 0.9);
                    }
                    100% {
                        box-shadow: 0 0 8px rgba(234, 179, 8, 0.4), inset 0 0 8px rgba(234, 179, 8, 0.1);
                        border-color: rgba(234, 179, 8, 0.5);
                    }
                }
                .new-coincidence-card {
                    animation: goldGlow 2.5s infinite ease-in-out;
                    border: 1px solid rgba(234, 179, 8, 0.6) !important;
                    background: rgba(234, 179, 8, 0.04) !important;
                }
                .glow-badge {
                    background: #eab308;
                    color: #000;
                    font-weight: 800;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    box-shadow: 0 0 12px rgba(234, 179, 8, 0.7);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .coincidence-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
                    gap: 1.5rem;
                }
                .ballistics-list-card {
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 8px;
                    padding: 1.25rem;
                    margin-bottom: 1rem;
                    position: relative;
                }
                .alert-banner {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(220, 38, 38, 0.1) 100%);
                    border: 1px solid rgba(239, 68, 68, 0.5);
                    border-left: 5px solid #ef4444;
                    color: #fca5a5;
                    border-radius: 8px;
                    padding: 1.25rem;
                    margin-bottom: 2rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    animation: pulseBorder 2s infinite ease-in-out;
                }
                @keyframes pulseBorder {
                    0% { border-color: rgba(239, 68, 68, 0.5); }
                    50% { border-color: rgba(239, 68, 68, 0.9); }
                    100% { border-color: rgba(239, 68, 68, 0.5); }
                }
            `}</style>

            {/* Float Alert Match Notification */}
            {alertMatch && (
                <div className="alert-banner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '2rem' }}>⚠️</span>
                        <div>
                            <h4 style={{ margin: 0, fontWeight: 'bold', color: '#fca5a5', fontSize: '1.1rem' }}>
                                {t('newCoincidenceDetected').replace('{item}', alertMatch.serialNumber)}
                            </h4>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#f3f4f6' }}>
                                Coincidencia entre casquillo del <strong>{alertMatch.bulletIncident}</strong> y el arma <strong>{alertMatch.weaponModel}</strong> (Propietario: {alertMatch.weaponOwner}).
                            </p>
                        </div>
                    </div>
                    <button 
                        className="login-button btn-secondary" 
                        style={{ width: 'auto', margin: 0, background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1rem' }}
                        onClick={handleMarkAllMatchesAsSeen}
                    >
                        Entendido
                    </button>
                </div>
            )}

            {/* Header Area */}
            <div className="doc-header" style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ fontSize: '3rem', filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.2))' }}>🔬</div>
                    <div>
                        <h2 className="page-title" style={{ margin: 0 }}>{t('ballistics')}</h2>
                        <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            {isLSSD ? t('ballistics_module_desc_lssd') : t('ballistics_module_desc')}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="login-button btn-secondary" style={{ width: 'auto', margin: 0 }} onClick={() => setShowBulletModal(true)}>
                        {t('addBulletCasing')}
                    </button>
                    <button className="login-button" style={{ width: 'auto', margin: 0 }} onClick={() => setShowWeaponModal(true)}>
                        {t('addSeizedWeapon')}
                    </button>
                </div>
            </div>

            {/* Error or Loading Grid */}
            {dbError ? (
                <div className="empty-list" style={{ color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '2rem', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <p style={{ fontWeight: 'bold', fontSize: '1.1rem', margin: '0 0 1rem 0' }}>⚠️ Error en la Base de Datos</p>
                    <p style={{ margin: 0 }}>{dbError}</p>
                </div>
            ) : loading ? (
                <div className="loading-container">Cargando módulo de balística...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    
                    {/* TABS NAVIGATION */}
                    <div className="tabs-container" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: '1rem', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
                        <button 
                            onClick={() => setActiveTab('coincidences')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: activeTab === 'coincidences' ? 'var(--accent-gold, #eab308)' : 'var(--text-secondary, #94a3b8)',
                                borderBottom: activeTab === 'coincidences' ? '2px solid var(--accent-gold, #eab308)' : 'none',
                                padding: '0.75rem 1.5rem',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                transition: 'all 0.2s',
                                marginBottom: '-0.6rem'
                            }}
                        >
                            {t('coincidences')} ({coincidences.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('bullets')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: activeTab === 'bullets' ? 'var(--color-blue-light)' : 'var(--text-secondary, #94a3b8)',
                                borderBottom: activeTab === 'bullets' ? '2px solid var(--color-blue-light)' : 'none',
                                padding: '0.75rem 1.5rem',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                transition: 'all 0.2s',
                                marginBottom: '-0.6rem'
                            }}
                        >
                            {t('bulletCasings')} ({bullets.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('weapons')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: activeTab === 'weapons' ? '#ef4444' : 'var(--text-secondary, #94a3b8)',
                                borderBottom: activeTab === 'weapons' ? '2px solid #ef4444' : 'none',
                                padding: '0.75rem 1.5rem',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                transition: 'all 0.2s',
                                marginBottom: '-0.6rem'
                            }}
                        >
                            {t('seizedWeapons')} ({weapons.length})
                        </button>
                    </div>

                    {/* RENDERING ACTIVE TAB CONTENT */}
                    {activeTab === 'coincidences' && (() => {
                        const groupedCoincidences = weapons.map(weapon => {
                            if (!weapon.numero_serie) return null;
                            const cleanWeaponSn = weapon.numero_serie.trim().toLowerCase();
                            if (cleanWeaponSn === '' || cleanWeaponSn === 'n/a') return null;

                            const matchingBullets = bullets.filter(bullet => 
                                bullet.numero_serie && bullet.numero_serie.trim().toLowerCase() === cleanWeaponSn
                            );

                            if (matchingBullets.length === 0) return null;

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

                        return (
                            <div className="doc-section">
                                <h3 className="section-title" style={{ borderBottom: '2px solid #eab308', paddingBottom: '0.5rem', color: '#eab308', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                    {t('coincidences')} ({groupedCoincidences.length})
                                </h3>
                                {groupedCoincidences.length === 0 ? (
                                    <div className="empty-list">No se han detectado coincidencias de número de serie todavía.</div>
                                ) : (
                                    <div className="coincidence-grid">
                                        {groupedCoincidences.map(group => {
                                            const isExpanded = expandedWeapons.includes(group.weapon.id);
                                            return (
                                                <div 
                                                    key={group.weapon.id} 
                                                    className={`ballistics-list-card ${group.isNew ? 'new-coincidence-card' : ''}`}
                                                    style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'all 0.3s ease' }}
                                                >
                                                    <div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--accent-gold)', background: 'rgba(255,255,255,0.06)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.95rem' }}>
                                                                N/S: {group.weapon.numero_serie}
                                                            </span>
                                                            {group.isNew ? (
                                                                <span className="glow-badge">{t('newBadge')} ({group.newBullets.length})</span>
                                                            ) : (
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>✓ {group.bullets.length} Vinculados</span>
                                                            )}
                                                        </div>

                                                        {/* Weapon Info */}
                                                        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '6px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#ef4444', marginBottom: '0.5rem' }}>
                                                                🔫 {group.weapon.modelo}
                                                            </div>
                                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                                <span style={{ color: '#fff', opacity: 0.8 }}>Propietario:</span> {group.weapon.propietario}
                                                                <br />
                                                                <span style={{ color: '#fff', opacity: 0.8 }}>Incidente Incautación:</span> {group.weapon.incidente_relacionado}
                                                            </div>
                                                        </div>

                                                        {/* Expanded Bullet Relationships */}
                                                        {isExpanded && (
                                                            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1rem' }}>
                                                                <h4 style={{ fontSize: '0.85rem', color: 'var(--color-blue-light)', margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Casquillos Vinculados:</h4>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                    {group.bullets.map(bullet => {
                                                                        const isBulletNew = !seenMatchIds.includes(`${bullet.id}-${group.weapon.id}`);
                                                                        return (
                                                                            <div key={bullet.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: '4px', fontSize: '0.8rem', borderLeft: isBulletNew ? '3px solid #eab308' : '3px solid var(--color-blue-light)' }}>
                                                                                <strong>Incidente:</strong> {bullet.incidente_relacionado}
                                                                                <br />
                                                                                <strong>Calibre:</strong> {bullet.calibre}
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.7, marginTop: '4px' }}>
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

                                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                                                        <button 
                                                            className="login-button btn-secondary" 
                                                            style={{ flex: 1, margin: 0, padding: '6px', fontSize: '0.8rem' }}
                                                            onClick={() => toggleWeaponExpand(group.weapon.id)}
                                                        >
                                                            {isExpanded ? 'Ocultar Casquillos' : `Ver Casquillos (${group.bullets.length})`}
                                                        </button>
                                                        {group.isNew && (
                                                            <button 
                                                                className="login-button" 
                                                                style={{ flex: 1, margin: 0, padding: '6px', fontSize: '0.8rem' }}
                                                                onClick={() => handleMarkWeaponMatchesAsSeen(group.weapon, group.bullets)}
                                                            >
                                                                Marcar vistos
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {activeTab === 'bullets' && (
                        <div className="doc-section" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                            <h3 className="section-title" style={{ borderBottom: '2px solid var(--color-blue-light)', paddingBottom: '0.5rem', color: 'var(--color-blue-light)', marginBottom: '1.5rem' }}>
                                {t('bulletCasings')} ({bullets.length})
                            </h3>
                            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {bullets.length === 0 ? (
                                    <div className="empty-list">No hay casquillos registrados.</div>
                                ) : (
                                    bullets.map(item => (
                                        <div key={item.id} className="ballistics-list-card">
                                            {item.can_delete && (
                                                <button 
                                                    style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem' }}
                                                    onClick={() => handleDeleteBullet(item.id)}
                                                    title="Eliminar casquillo"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                                                <div>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>{t('relatedIncident')}</span>
                                                    <strong>{item.incidente_relacionado}</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>{t('bulletCaliber')}</span>
                                                    <strong>{item.calibre}</strong>
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>{t('serialNumber')}</span>
                                                <strong style={{ fontFamily: 'monospace', color: 'var(--accent-gold)' }}>{item.numero_serie}</strong>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.75rem', opacity: 0.8 }}>
                                                <span>Registrado por: {item.author_rank} {item.author_name}</span>
                                                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'weapons' && (
                        <div className="doc-section" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                            <h3 className="section-title" style={{ borderBottom: '2px solid #ef4444', paddingBottom: '0.5rem', color: '#ef4444', marginBottom: '1.5rem' }}>
                                {t('seizedWeapons')} ({weapons.length})
                            </h3>
                            <div style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {weapons.length === 0 ? (
                                    <div className="empty-list">No hay armas registradas.</div>
                                ) : (
                                    weapons.map(item => (
                                        <div key={item.id} className="ballistics-list-card">
                                            {item.can_delete && (
                                                <button 
                                                    style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.9rem' }}
                                                    onClick={() => handleDeleteWeapon(item.id)}
                                                    title="Eliminar arma"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                                                <div>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>{t('ownerName')}</span>
                                                    <strong>{item.propietario}</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>{t('weaponModel')}</span>
                                                    <strong>{item.modelo}</strong>
                                                </div>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                                                <div>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>{t('relatedIncident')}</span>
                                                    <strong>{item.incidente_relacionado}</strong>
                                                </div>
                                                <div>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>{t('serialNumber')}</span>
                                                    <strong style={{ fontFamily: 'monospace', color: 'var(--accent-gold)' }}>{item.numero_serie}</strong>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.75rem', opacity: 0.8 }}>
                                                <span>Registrado por: {item.author_rank} {item.author_name}</span>
                                                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                </div>
            )}

            {/* --- ADD BULLET CASING MODAL --- */}
            {showBulletModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '500px', textAlign: 'left' }}>
                        <h3 className="section-title" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                            {t('addBulletCasing')}
                        </h3>
                        <form onSubmit={handleCreateBullet} style={{ marginTop: '1.5rem' }}>
                            <div className="form-group">
                                <label className="form-label">{t('relatedIncident')}</label>
                                <input 
                                    className="form-input" 
                                    required 
                                    value={bulletForm.incidente}
                                    onChange={e => setBulletForm({ ...bulletForm, incidente: e.target.value })}
                                    placeholder="Ej: Tiroteo en Grove St"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('bulletCaliber')}</label>
                                <input 
                                    className="form-input" 
                                    required 
                                    value={bulletForm.calibre}
                                    onChange={e => setBulletForm({ ...bulletForm, calibre: e.target.value })}
                                    placeholder="Ej: 9mm, .45 ACP, 5.56mm"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('serialNumber')}</label>
                                <input 
                                    className="form-input" 
                                    required 
                                    value={bulletForm.num_serie}
                                    onChange={e => setBulletForm({ ...bulletForm, num_serie: e.target.value })}
                                    placeholder="Ej: SN-12948-BALA"
                                />
                            </div>
                            <div className="cropper-actions" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowBulletModal(false)} style={{ width: 'auto' }}>
                                    {t('cancelBtn')}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submitting}>
                                    {submitting ? t('savingBtn') : t('saveBtn')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- ADD SEIZED WEAPON MODAL --- */}
            {showWeaponModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '500px', textAlign: 'left' }}>
                        <h3 className="section-title" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                            {t('addSeizedWeapon')}
                        </h3>
                        <form onSubmit={handleCreateWeapon} style={{ marginTop: '1.5rem' }}>
                            <div className="form-group">
                                <label className="form-label">{t('ownerName')}</label>
                                <input 
                                    className="form-input" 
                                    required 
                                    value={weaponForm.propietario}
                                    onChange={e => setWeaponForm({ ...weaponForm, propietario: e.target.value })}
                                    placeholder="Ej: Desconocido, John Doe"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('relatedIncident')}</label>
                                <input 
                                    className="form-input" 
                                    required 
                                    value={weaponForm.incidente}
                                    onChange={e => setWeaponForm({ ...weaponForm, incidente: e.target.value })}
                                    placeholder="Ej: Asalto en Licorería"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('weaponModel')}</label>
                                <input 
                                    className="form-input" 
                                    required 
                                    value={weaponForm.modelo}
                                    onChange={e => setWeaponForm({ ...weaponForm, modelo: e.target.value })}
                                    placeholder="Ej: Combat Pistol, Special Carbine"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('serialNumber')}</label>
                                <input 
                                    className="form-input" 
                                    required 
                                    value={weaponForm.num_serie}
                                    onChange={e => setWeaponForm({ ...weaponForm, num_serie: e.target.value })}
                                    placeholder="Ej: SN-12948-BALA"
                                />
                            </div>
                            <div className="cropper-actions" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                <button type="button" className="login-button btn-secondary" onClick={() => setShowWeaponModal(false)} style={{ width: 'auto' }}>
                                    {t('cancelBtn')}
                                </button>
                                <button type="submit" className="login-button" style={{ width: 'auto' }} disabled={submitting}>
                                    {submitting ? t('savingBtn') : t('saveBtn')}
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
