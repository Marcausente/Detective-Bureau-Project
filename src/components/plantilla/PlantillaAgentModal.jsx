import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { uploadImageToStorage } from '../../utils/imageStorage';
import { calculatePromotionDays, DEFAULT_VALORACIONES, hexToRgba } from '../../services/plantillaService';

export default function PlantillaAgentModal({ agent, ranks, divisions, valoraciones = [], onClose, onSave }) {
    const isEdit = Boolean(agent && agent.id);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const availableValoraciones = valoraciones && valoraciones.length > 0 ? valoraciones : DEFAULT_VALORACIONES;

    // Form state
    const [formData, setFormData] = useState({
        username: agent?.username || '',
        email: agent?.email || '',
        nombre: agent?.nombre || '',
        apellido: agent?.apellido || '',
        no_placa: agent?.no_placa || '',
        rank_name: agent?.rank_name || (ranks?.[0]?.name || ''),
        divisions: Array.isArray(agent?.divisions) ? agent.divisions : [],
        activity_status: agent?.activity_status || 'Activo',
        valoracion: agent?.valoracion || '',
        last_promotion_date: agent?.last_promotion_date ? agent.last_promotion_date.split('T')[0] : '',
        notes: agent?.notes || '',
        avatar_url: agent?.avatar_url || '',
        is_placeholder: Boolean(agent?.is_placeholder)
    });

    // Registered users autocomplete state
    const [systemUsers, setSystemUsers] = useState([]);
    const [userSearch, setUserSearch] = useState('');
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    const userDropdownRef = useRef(null);

    useEffect(() => {
        fetchSystemUsers();
        const handleClickOutside = (e) => {
            if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
                setShowUserDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchSystemUsers = async () => {
        try {
            const { data } = await supabase
                .from('users')
                .select('id, nombre, apellido, no_placa, email, username, avatar_url, rango, rol')
                .limit(100);
            if (data) setSystemUsers(data);
        } catch (e) {
            console.warn('Could not fetch system users:', e);
        }
    };

    const handleAvatarUpload = async (file) => {
        if (!file) return;
        try {
            setUploadingAvatar(true);
            const url = await uploadImageToStorage(file, 'avatars');
            if (url) {
                setFormData(prev => ({ ...prev, avatar_url: url }));
            }
        } catch (err) {
            alert('Error al subir la foto: ' + err.message);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const toggleDivision = (divName) => {
        setFormData(prev => {
            const current = prev.divisions || [];
            if (current.includes(divName)) {
                return { ...prev, divisions: current.filter(d => d !== divName) };
            } else {
                return { ...prev, divisions: [...current, divName] };
            }
        });
    };

    const handleSelectSystemUser = (u) => {
        setFormData(prev => ({
            ...prev,
            username: u.username || prev.username,
            email: u.email || prev.email,
            nombre: u.nombre || prev.nombre,
            apellido: u.apellido || prev.apellido,
            no_placa: u.no_placa || prev.no_placa,
            avatar_url: u.avatar_url || prev.avatar_url,
            rank_name: u.rango || prev.rank_name,
            is_placeholder: false
        }));
        setShowUserDropdown(false);
        setUserSearch('');
    };

    const filteredSystemUsers = systemUsers.filter(u => {
        if (!userSearch.trim()) return true;
        const term = userSearch.toLowerCase();
        const full = `${u.nombre || ''} ${u.apellido || ''} ${u.username || ''} ${u.no_placa || ''}`.toLowerCase();
        return full.includes(term);
    });

    const promoDaysInfo = calculatePromotionDays(formData.last_promotion_date);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            const rankObj = ranks.find(r => r.name.toLowerCase() === (formData.rank_name || '').toLowerCase());
            const payload = {
                ...(agent?.id ? { id: agent.id } : {}),
                ...formData,
                rank_id: rankObj?.id || null,
                order_index: agent?.order_index !== undefined ? agent.order_index : 999
            };
            await onSave(payload);
            onClose();
        } catch (err) {
            alert('Error guardando agente: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mac-modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
            <div
                className="mac-modal-card"
                onClick={e => e.stopPropagation()}
                style={{
                    maxWidth: '820px',
                    width: '95%',
                    maxHeight: '92vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '20px',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: 'rgba(59, 130, 246, 0.2)',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem'
                        }}>
                            👤
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>
                                {isEdit ? (formData.is_placeholder ? 'Editar Casilla Reservada' : 'Editar Agente de Plantilla') : 'Añadir a la Plantilla de Agentes'}
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                                Configura datos personales, rango, divisiones y tiempos de servicio
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#cbd5e1',
                            padding: '0.45rem 0.85rem',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>

                        {/* Top banner: Reserved Slot toggle & Import User */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: formData.is_placeholder ? 'rgba(234, 179, 8, 0.1)' : 'rgba(30, 41, 59, 0.5)',
                            border: formData.is_placeholder ? '1px dashed rgba(234, 179, 8, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '12px',
                            padding: '0.85rem 1rem',
                            flexWrap: 'wrap',
                            gap: '0.75rem'
                        }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                                <input
                                    type="checkbox"
                                    checked={formData.is_placeholder}
                                    onChange={e => setFormData({ ...formData, is_placeholder: e.target.checked })}
                                    style={{ width: '18px', height: '18px', accentColor: '#eab308', cursor: 'pointer' }}
                                />
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: formData.is_placeholder ? '#fef08a' : '#cbd5e1' }}>
                                    📌 Marcar como Casilla Reservada / Plaza Vacante (Permite dejar nombre y usuario en blanco)
                                </span>
                            </label>

                            {!formData.is_placeholder && (
                                <div style={{ position: 'relative' }} ref={userDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowUserDropdown(!showUserDropdown)}
                                        style={{
                                            background: 'rgba(99, 102, 241, 0.18)',
                                            border: '1px solid rgba(129, 140, 248, 0.4)',
                                            color: '#c7d2fe',
                                            padding: '0.35rem 0.75rem',
                                            borderRadius: '8px',
                                            fontSize: '0.78rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}
                                    >
                                        <span>🔍</span>
                                        <span>Importar de Usuario Registrado</span>
                                    </button>

                                    {showUserDropdown && (
                                        <div style={{
                                            position: 'absolute',
                                            right: 0,
                                            top: '100%',
                                            marginTop: '6px',
                                            width: '280px',
                                            background: '#1e293b',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '10px',
                                            padding: '8px',
                                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                            zIndex: 200
                                        }}>
                                            <input
                                                type="text"
                                                autoFocus
                                                placeholder="Buscar usuario o placa..."
                                                value={userSearch}
                                                onChange={e => setUserSearch(e.target.value)}
                                                style={{
                                                    width: '100%',
                                                    background: 'rgba(15, 23, 42, 0.8)',
                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                    borderRadius: '6px',
                                                    padding: '0.4rem 0.6rem',
                                                    color: '#f8fafc',
                                                    fontSize: '0.78rem',
                                                    marginBottom: '6px'
                                                }}
                                            />
                                            <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                {filteredSystemUsers.slice(0, 10).map(u => (
                                                    <div
                                                        key={u.id}
                                                        onClick={() => handleSelectSystemUser(u)}
                                                        style={{
                                                            padding: '6px 8px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            background: 'rgba(255, 255, 255, 0.04)',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            fontSize: '0.78rem',
                                                            color: '#f8fafc'
                                                        }}
                                                    >
                                                        <span>{u.nombre} {u.apellido}</span>
                                                        <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>#{u.no_placa}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Profile Photo & Primary Identifiers */}
                        <div style={{
                            background: 'rgba(30, 41, 59, 0.45)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '14px',
                            padding: '1.1rem',
                            display: 'flex',
                            gap: '1.25rem',
                            alignItems: 'center',
                            flexWrap: 'wrap'
                        }}>
                            {/* Avatar */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <div style={{
                                    width: '64px',
                                    height: '64px',
                                    borderRadius: '50%',
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    border: '2px solid rgba(59, 130, 246, 0.5)',
                                    overflow: 'hidden',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.75rem'
                                }}>
                                    {formData.avatar_url ? (
                                        <img
                                            src={formData.avatar_url}
                                            alt="Avatar"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={e => { e.target.style.display = 'none'; }}
                                        />
                                    ) : (
                                        <span>👮</span>
                                    )}
                                </div>
                                <label style={{
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: '#60a5fa',
                                    cursor: uploadingAvatar ? 'wait' : 'pointer',
                                    textDecoration: 'underline'
                                }}>
                                    {uploadingAvatar ? 'Subiendo...' : 'Cambiar Foto'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        disabled={uploadingAvatar}
                                        onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (file) handleAvatarUpload(file);
                                        }}
                                    />
                                </label>
                            </div>

                            {/* Identifiers inputs */}
                            <div style={{ flex: 1, minWidth: '240px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        Nº Placa *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej: 701"
                                        value={formData.no_placa}
                                        onChange={e => setFormData({ ...formData, no_placa: e.target.value })}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            padding: '0.5rem 0.75rem',
                                            color: '#f8fafc',
                                            fontSize: '0.85rem',
                                            fontWeight: 800
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        Nombre {formData.is_placeholder && '(Opcional)'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Matthew"
                                        value={formData.nombre}
                                        onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            padding: '0.5rem 0.75rem',
                                            color: '#f8fafc',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        Apellido {formData.is_placeholder && '(Opcional)'}
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Kleiner"
                                        value={formData.apellido}
                                        onChange={e => setFormData({ ...formData, apellido: e.target.value })}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            padding: '0.5rem 0.75rem',
                                            color: '#f8fafc',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Account Details: Username & Email */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Nombre de Usuario (Login / Discord)
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: marcuscurrie"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        padding: '0.5rem 0.75rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Correo Electrónico
                                </label>
                                <input
                                    type="email"
                                    placeholder="Ej: marcuscurrie@gmail.com"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        padding: '0.5rem 0.75rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Rank and Activity Status */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Rango Oficial *
                                </label>
                                <select
                                    value={formData.rank_name}
                                    onChange={e => setFormData({ ...formData, rank_name: e.target.value })}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        padding: '0.55rem 0.75rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem',
                                        fontWeight: 700
                                    }}
                                >
                                    {ranks.map(r => (
                                        <option key={r.id || r.name} value={r.name}>
                                            {r.name} ({r.category || 'General'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Estado de Actividad
                                </label>
                                <select
                                    value={formData.activity_status}
                                    onChange={e => setFormData({ ...formData, activity_status: e.target.value })}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        padding: '0.55rem 0.75rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    <option value="Activo">🟢 Activo / Activa</option>
                                    <option value="Poco activa">🟡 Poco activa / Vacaciones</option>
                                    <option value="Inactivo">🔴 Inactivo / No activa</option>
                                </select>
                            </div>
                        </div>

                        {/* Valoración / Acotación de Fila */}
                        {(() => {
                            const valObj = availableValoraciones.find(v => (v.name || '').trim().toLowerCase() === (formData.valoracion || '').trim().toLowerCase());
                            return (
                                <div style={{
                                    background: valObj ? hexToRgba(valObj.color, 0.15) : 'rgba(30, 41, 59, 0.45)',
                                    border: valObj ? `1px solid ${valObj.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                                    borderLeft: valObj ? `5px solid ${valObj.color}` : '5px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '12px',
                                    padding: '0.85rem 1rem',
                                    transition: 'all 0.2s ease'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                        <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase' }}>
                                            🏷️ Valoración / Acotación de Fila
                                        </label>
                                        {valObj && (
                                            <span style={{
                                                fontSize: '0.72rem',
                                                fontWeight: 900,
                                                background: hexToRgba(valObj.color, 0.35),
                                                border: `1px solid ${valObj.color}`,
                                                color: '#ffffff',
                                                padding: '2px 8px',
                                                borderRadius: '5px'
                                            }}>
                                                ● Toda la fila se marcará en {valObj.name}
                                            </span>
                                        )}
                                    </div>
                                    <select
                                        value={formData.valoracion}
                                        onChange={e => setFormData({ ...formData, valoracion: e.target.value })}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.85)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            padding: '0.55rem 0.75rem',
                                            color: '#f8fafc',
                                            fontSize: '0.85rem',
                                            fontWeight: 700
                                        }}
                                    >
                                        <option value="">— Ninguna (Fila sin marcar) —</option>
                                        {availableValoraciones.map(v => (
                                            <option key={v.id || v.name} value={v.name}>
                                                ● {v.name} {v.description ? `(${v.description})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <span style={{ display: 'block', fontSize: '0.72rem', color: valObj ? '#cbd5e1' : '#94a3b8', marginTop: '4px' }}>
                                        {valObj ? (valObj.description || `La fila de este agente se destacará completamente en color ${valObj.color}`) : 'Permite marcar toda la fila en verde (Ascenso), azul (Val. Ascenso), amarillo (Observación), rojo (Degrado), etc.'}
                                    </span>
                                </div>
                            );
                        })()}

                        {/* Promotion Dates and Calculation Indicator */}
                        <div style={{
                            background: 'rgba(30, 41, 59, 0.45)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '12px',
                            padding: '1rem',
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: '1rem',
                            alignItems: 'center'
                        }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Fecha del Último Ascenso
                                </label>
                                <input
                                    type="date"
                                    value={formData.last_promotion_date}
                                    onChange={e => setFormData({ ...formData, last_promotion_date: e.target.value })}
                                    style={{
                                        width: '100%',
                                        background: 'rgba(15, 23, 42, 0.8)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        borderRadius: '8px',
                                        padding: '0.5rem 0.75rem',
                                        color: '#f8fafc',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                    Días sin Ascender (Calculado Automáticamente)
                                </label>
                                <div style={{
                                    background: promoDaysInfo.bg,
                                    border: promoDaysInfo.border,
                                    color: promoDaysInfo.color,
                                    padding: '0.5rem 0.85rem',
                                    borderRadius: '8px',
                                    fontWeight: 900,
                                    fontSize: '0.9rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    <span>⏳</span>
                                    <span>{promoDaysInfo.text}</span>
                                </div>
                            </div>
                        </div>

                        {/* Divisions Assignment (Checkboxes) */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Divisiones Asignadas (Marca todas las divisiones en las que participa)
                            </label>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                                gap: '6px',
                                background: 'rgba(15, 23, 42, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '10px',
                                padding: '10px'
                            }}>
                                {divisions.map(div => {
                                    const isSelected = formData.divisions.includes(div.short_name) || formData.divisions.includes(div.name);
                                    return (
                                        <div
                                            key={div.id || div.name}
                                            onClick={() => toggleDivision(div.short_name || div.name)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '5px 8px',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                background: isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                                                border: isSelected ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                                                color: isSelected ? '#6ee7b7' : '#94a3b8',
                                                fontSize: '0.78rem',
                                                fontWeight: isSelected ? 800 : 500,
                                                transition: 'all 0.12s ease'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                readOnly
                                                style={{ accentColor: '#10b981', pointerEvents: 'none' }}
                                            />
                                            {div.badge_image_url ? (
                                                <img src={div.badge_image_url} alt="" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                                            ) : (
                                                <span>🏢</span>
                                            )}
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {div.short_name || div.name}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                Notas Especiales / Observaciones
                            </label>
                            <textarea
                                rows={2}
                                placeholder="Anotaciones de Comandancia, méritos, condiciones especiales..."
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '8px',
                                    padding: '0.5rem 0.75rem',
                                    color: '#f8fafc',
                                    fontSize: '0.85rem',
                                    resize: 'vertical'
                                }}
                            />
                        </div>

                    </div>

                    {/* Footer Actions */}
                    <div style={{
                        padding: '1rem 1.5rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '0.75rem',
                        background: 'rgba(15, 23, 42, 0.95)'
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#cbd5e1',
                                padding: '0.55rem 1.1rem',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            style={{
                                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                border: 'none',
                                color: '#ffffff',
                                padding: '0.55rem 1.4rem',
                                borderRadius: '8px',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                            }}
                        >
                            {saving ? 'Guardando...' : (isEdit ? 'Actualizar Fila' : 'Añadir a Plantilla')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

