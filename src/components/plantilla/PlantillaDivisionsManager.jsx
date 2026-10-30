import { useState } from 'react';
import { uploadImageToStorage } from '../../utils/imageStorage';
import { savePlantillaDivision, deletePlantillaDivision, updateDivisionsOrder } from '../../services/plantillaService';

export default function PlantillaDivisionsManager({ divisions, onClose, onDivisionsUpdated }) {
    const [divisionsList, setDivisionsList] = useState(divisions || []);
    const [editingDivision, setEditingDivision] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [uploadingBadge, setUploadingBadge] = useState(false);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        short_name: '',
        badge_image_url: '',
        color: '#10b981',
        order_index: divisionsList.length + 1
    });

    const openCreateForm = () => {
        setEditingDivision(null);
        setFormData({
            name: '',
            short_name: '',
            badge_image_url: '',
            color: '#10b981',
            order_index: divisionsList.length + 1
        });
        setIsCreating(true);
    };

    const openEditForm = (div) => {
        setEditingDivision(div);
        setFormData({
            name: div.name,
            short_name: div.short_name || div.name.substring(0, 5),
            badge_image_url: div.badge_image_url || '',
            color: div.color || '#10b981',
            order_index: div.order_index || 1
        });
        setIsCreating(true);
    };

    const handleBadgeUpload = async (file) => {
        if (!file) return;
        try {
            setUploadingBadge(true);
            const url = await uploadImageToStorage(file, 'branding');
            if (url) {
                setFormData(prev => ({ ...prev, badge_image_url: url }));
            }
        } catch (err) {
            console.error('Error uploading division badge:', err);
            alert('Error al subir el icono: ' + err.message);
        } finally {
            setUploadingBadge(false);
        }
    };

    const handleSaveDivision = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('Por favor ingresa el nombre de la división');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                ...(editingDivision ? { id: editingDivision.id } : {}),
                ...formData,
                name: formData.name.trim(),
                short_name: (formData.short_name || formData.name.substring(0, 5)).trim()
            };
            const saved = await savePlantillaDivision(payload);
            let updatedList;
            if (editingDivision) {
                updatedList = divisionsList.map(d => d.id === editingDivision.id ? saved : d);
            } else {
                const exists = divisionsList.some(d => d.id === saved.id || (d.name && d.name.trim().toLowerCase() === saved.name.trim().toLowerCase()));
                if (exists) {
                    updatedList = divisionsList.map(d => (d.id === saved.id || (d.name && d.name.trim().toLowerCase() === saved.name.trim().toLowerCase())) ? saved : d);
                } else {
                    updatedList = [...divisionsList, saved];
                }
            }
            updatedList = updatedList
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                .map((d, i) => ({ ...d, order_index: i + 1 }));

            const persisted = await updateDivisionsOrder(updatedList);
            setDivisionsList(persisted);
            setIsCreating(false);
            setEditingDivision(null);
            if (onDivisionsUpdated) onDivisionsUpdated(persisted);
        } catch (err) {
            console.error('Error guardando división:', err);
            alert('Error guardando división: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteDivision = async (div) => {
        if (!window.confirm(`¿Seguro que deseas eliminar la división "${div.name}"? Los agentes que la tengan asignada perderán esta marca.`)) return;
        try {
            await deletePlantillaDivision(div.id);
            const updated = divisionsList.filter(d => d.id !== div.id).map((d, i) => ({ ...d, order_index: i + 1 }));
            const persisted = await updateDivisionsOrder(updated);
            setDivisionsList(persisted);
            if (onDivisionsUpdated) onDivisionsUpdated(persisted);
        } catch (err) {
            console.error('Error al eliminar división:', err);
            alert('Error al eliminar división: ' + err.message);
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
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '20px',
                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)'
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
                            background: 'rgba(16, 185, 129, 0.2)',
                            border: '1px solid rgba(16, 185, 129, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem'
                        }}>
                            🏢
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>
                                Gestión de Divisiones
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                                Administra las divisiones activas que se mostrarán en la plantilla de agentes
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                        {!isCreating && (
                            <button
                                type="button"
                                onClick={openCreateForm}
                                style={{
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '0.45rem 0.95rem',
                                    borderRadius: '8px',
                                    fontWeight: 800,
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span>➕</span>
                                <span>Nueva División</span>
                            </button>
                        )}
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
                </div>

                {/* Body Content */}
                <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
                    {isCreating ? (
                        <form onSubmit={handleSaveDivision} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            <div style={{
                                background: 'rgba(30, 41, 59, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '14px',
                                padding: '1.25rem'
                            }}>
                                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#f8fafc', fontWeight: 800 }}>
                                    {editingDivision ? '✏️ Editar División' : '✨ Crear Nueva División'}
                                </h3>

                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                            Nombre Completo de la División *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej: Air Support Division (ASD), Special Enforcement Bureau (SEB)..."
                                            value={formData.name}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    name: val,
                                                    short_name: prev.short_name || val.substring(0, 5).toUpperCase()
                                                }));
                                            }}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                                borderRadius: '8px',
                                                padding: '0.55rem 0.85rem',
                                                color: '#f8fafc',
                                                fontSize: '0.85rem'
                                            }}
                                        />
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                            Siglas / Columna (Cabecera) *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej: ASD, TRT, K9..."
                                            value={formData.short_name}
                                            onChange={e => setFormData({ ...formData, short_name: e.target.value.toUpperCase() })}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                                borderRadius: '8px',
                                                padding: '0.55rem 0.85rem',
                                                color: '#f8fafc',
                                                fontSize: '0.85rem'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Icon / Badge Upload */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                        Icono / Insignia de la División (Visible en cabecera y celdas)
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                        {formData.badge_image_url ? (
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '10px',
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                border: '1px solid rgba(16, 185, 129, 0.5)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden'
                                            }}>
                                                <img
                                                    src={formData.badge_image_url}
                                                    alt="Badge"
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                    onError={e => { e.target.style.display = 'none'; }}
                                                />
                                            </div>
                                        ) : (
                                            <div style={{
                                                width: '48px',
                                                height: '48px',
                                                borderRadius: '10px',
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                border: '1px dashed rgba(255, 255, 255, 0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1.2rem',
                                                color: '#64748b'
                                            }}>
                                                🏢
                                            </div>
                                        )}

                                        <div style={{ flex: 1, minWidth: '220px' }}>
                                            <input
                                                type="text"
                                                placeholder="URL de la imagen del icono (https://...)"
                                                value={formData.badge_image_url}
                                                onChange={e => setFormData({ ...formData, badge_image_url: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    background: 'rgba(15, 23, 42, 0.8)',
                                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                                    borderRadius: '8px',
                                                    padding: '0.45rem 0.75rem',
                                                    color: '#f8fafc',
                                                    fontSize: '0.8rem',
                                                    marginBottom: '6px'
                                                }}
                                            />
                                            <label style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                background: 'rgba(255, 255, 255, 0.08)',
                                                border: '1px solid rgba(255, 255, 255, 0.18)',
                                                color: '#cbd5e1',
                                                padding: '0.35rem 0.75rem',
                                                borderRadius: '6px',
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                cursor: uploadingBadge ? 'wait' : 'pointer'
                                            }}>
                                                <span>📁</span>
                                                <span>{uploadingBadge ? 'Subiendo...' : 'Subir Icono / Escudo'}</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: 'none' }}
                                                    disabled={uploadingBadge}
                                                    onChange={e => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleBadgeUpload(file);
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                            Color de la División
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input
                                                type="color"
                                                value={formData.color}
                                                onChange={e => setFormData({ ...formData, color: e.target.value })}
                                                style={{ width: '42px', height: '34px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'transparent' }}
                                            />
                                            <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontFamily: 'monospace' }}>{formData.color}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                            Orden de Columna
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={formData.order_index}
                                            onChange={e => setFormData({ ...formData, order_index: parseInt(e.target.value, 10) || 1 })}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                                borderRadius: '8px',
                                                padding: '0.55rem 0.85rem',
                                                color: '#f8fafc',
                                                fontSize: '0.85rem'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                                <button
                                    type="button"
                                    onClick={() => { setIsCreating(false); setEditingDivision(null); }}
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
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        border: 'none',
                                        color: '#ffffff',
                                        padding: '0.55rem 1.3rem',
                                        borderRadius: '8px',
                                        fontWeight: 800,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {saving ? 'Guardando...' : (editingDivision ? 'Actualizar División' : 'Crear División')}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div>
                            <div style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '12px',
                                padding: '0.75rem 1rem',
                                marginBottom: '1rem',
                                fontSize: '0.82rem',
                                color: '#94a3b8'
                            }}>
                                Total: <strong style={{ color: '#f8fafc' }}>{divisionsList.length} divisiones configuradas</strong>. Cada una aparecerá como columna en la plantilla para marcar asignaciones.
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                                {divisionsList.map((div, idx) => (
                                    <div
                                        key={div.id || idx}
                                        style={{
                                            background: 'rgba(30, 41, 59, 0.5)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: '12px',
                                            padding: '0.85rem',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.6rem'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '36px',
                                                height: '36px',
                                                borderRadius: '8px',
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                border: `1px solid ${div.color || 'rgba(16, 185, 129, 0.4)'}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden',
                                                flexShrink: 0
                                            }}>
                                                {div.badge_image_url ? (
                                                    <img
                                                        src={div.badge_image_url}
                                                        alt="Icon"
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                        onError={e => { e.target.style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    <span style={{ fontSize: '1rem' }}>🏢</span>
                                                )}
                                            </div>

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {div.name}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 900,
                                                        color: div.color || '#34d399',
                                                        background: 'rgba(255, 255, 255, 0.06)',
                                                        padding: '1px 6px',
                                                        borderRadius: '4px'
                                                    }}>
                                                        {div.short_name || div.name}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                        Columna #{idx + 1}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '0.5rem' }}>
                                            <button
                                                type="button"
                                                onClick={() => openEditForm(div)}
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.06)',
                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                    color: '#cbd5e1',
                                                    borderRadius: '6px',
                                                    padding: '0.25rem 0.6rem',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteDivision(div)}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    color: '#f87171',
                                                    borderRadius: '6px',
                                                    padding: '0.25rem 0.6rem',
                                                    fontSize: '0.72rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

