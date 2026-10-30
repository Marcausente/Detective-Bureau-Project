import { useState } from 'react';
import { uploadImageToStorage } from '../../utils/imageStorage';
import { savePlantillaRank, deletePlantillaRank, updateRanksOrder } from '../../services/plantillaService';

export default function PlantillaRanksManager({ ranks, onClose, onRanksUpdated, onApplyHierarchy }) {
    const [ranksList, setRanksList] = useState(ranks || []);
    const [editingRank, setEditingRank] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [uploadingBadge, setUploadingBadge] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        category: 'COMMAND',
        badge_image_url: '',
        color: '#3b82f6',
        order_index: ranksList.length + 1
    });

    const openCreateForm = () => {
        setEditingRank(null);
        setFormData({
            name: '',
            category: 'COMMAND',
            badge_image_url: '',
            color: '#3b82f6',
            order_index: ranksList.length + 1
        });
        setIsCreating(true);
    };

    const openEditForm = (rank) => {
        setEditingRank(rank);
        setFormData({
            name: rank.name,
            category: rank.category || 'General',
            badge_image_url: rank.badge_image_url || '',
            color: rank.color || '#3b82f6',
            order_index: rank.order_index || 1
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
            console.error('Error uploading badge image:', err);
            alert('Error al subir la insignia: ' + err.message);
        } finally {
            setUploadingBadge(false);
        }
    };

    const handleSaveRank = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('Por favor ingresa el nombre del rango');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                ...(editingRank ? { id: editingRank.id } : {}),
                ...formData
            };
            const saved = await savePlantillaRank(payload);
            let updatedList;
            if (editingRank) {
                updatedList = ranksList.map(r => r.id === editingRank.id ? saved : r);
            } else {
                updatedList = [...ranksList, saved].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            }
            setRanksList(updatedList);
            setIsCreating(false);
            setEditingRank(null);
            if (onRanksUpdated) onRanksUpdated(updatedList);
        } catch (err) {
            alert('Error guardando rango: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteRank = async (rank) => {
        if (!window.confirm(`¿Seguro que deseas eliminar el rango "${rank.name}"?`)) return;
        try {
            await deletePlantillaRank(rank.id);
            const updated = ranksList.filter(r => r.id !== rank.id);
            setRanksList(updated);
            if (onRanksUpdated) onRanksUpdated(updated);
        } catch (err) {
            alert('Error al eliminar rango: ' + err.message);
        }
    };

    const moveRank = async (index, direction) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= ranksList.length) return;

        const updated = [...ranksList];
        const temp = updated[index];
        updated[index] = updated[newIndex];
        updated[newIndex] = temp;

        setRanksList(updated);
        try {
            const reordered = await updateRanksOrder(updated);
            setRanksList(reordered);
            if (onRanksUpdated) onRanksUpdated(reordered);
        } catch (err) {
            console.error('Error reordering ranks:', err);
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
                            background: 'rgba(234, 179, 8, 0.2)',
                            border: '1px solid rgba(234, 179, 8, 0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.2rem'
                        }}>
                            🎖️
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>
                                Gestión y Jerarquía de Rangos
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                                Define rangos, insignias y orden jerárquico para la plantilla de agentes
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                        {!isCreating && (
                            <button
                                type="button"
                                onClick={openCreateForm}
                                style={{
                                    background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                                    color: '#0f172a',
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
                                <span>Nuevo Rango</span>
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
                        <form onSubmit={handleSaveRank} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                            <div style={{
                                background: 'rgba(30, 41, 59, 0.6)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '14px',
                                padding: '1.25rem'
                            }}>
                                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#f8fafc', fontWeight: 800 }}>
                                    {editingRank ? '✏️ Editar Rango' : '✨ Crear Nuevo Rango'}
                                </h3>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                            Nombre del Rango *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ej: 09. Capitán, Deputy Sheriff..."
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
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
                                            Categoría Jerárquica
                                        </label>
                                        <select
                                            value={formData.category}
                                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                                borderRadius: '8px',
                                                padding: '0.55rem 0.85rem',
                                                color: '#f8fafc',
                                                fontSize: '0.85rem'
                                            }}
                                        >
                                            <option value="JEFATURA SHERIFF">JEFATURA SHERIFF</option>
                                            <option value="COMMAND">COMMAND / MANDO</option>
                                            <option value="SARGEANTS">SARGEANTS / SUPERVISORES</option>
                                            <option value="DETECTIVES">DETECTIVES / INVESTIGACIÓN</option>
                                            <option value="ESCALA BÁSICA">ESCALA BÁSICA / AGENTES</option>
                                            <option value="CADETES">CADETES / EN PRÁCTICAS</option>
                                            <option value="OTRO">OTRO / PERSONAL CIVIL</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Badge Image Upload */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                        Insignia / Escudo del Rango (Imagen)
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                        {formData.badge_image_url ? (
                                            <div style={{
                                                width: '52px',
                                                height: '52px',
                                                borderRadius: '10px',
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                border: '1px solid rgba(234, 179, 8, 0.5)',
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
                                                width: '52px',
                                                height: '52px',
                                                borderRadius: '10px',
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                border: '1px dashed rgba(255, 255, 255, 0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '1.2rem',
                                                color: '#64748b'
                                            }}>
                                                🎖️
                                            </div>
                                        )}

                                        <div style={{ flex: 1, minWidth: '220px' }}>
                                            <input
                                                type="text"
                                                placeholder="URL de la insignia (https://...)"
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
                                                <span>{uploadingBadge ? 'Subiendo...' : 'Subir Imagen de Insignia'}</span>
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
                                            Color de Rango
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
                                            Posición Jerárquica (1 = Máxima)
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
                                    onClick={() => { setIsCreating(false); setEditingRank(null); }}
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
                                        background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                                        border: 'none',
                                        color: '#0f172a',
                                        padding: '0.55rem 1.3rem',
                                        borderRadius: '8px',
                                        fontWeight: 800,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {saving ? 'Guardando...' : (editingRank ? 'Actualizar Rango' : 'Crear Rango')}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div>
                            {/* Summary bar */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '12px',
                                padding: '0.75rem 1rem',
                                marginBottom: '1rem',
                                flexWrap: 'wrap',
                                gap: '0.5rem'
                            }}>
                                <div style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                                    Total: <strong style={{ color: '#f8fafc' }}>{ranksList.length} rangos configurados</strong> en orden jerárquico descendente (1 = Sheriff / Máximo).
                                </div>
                                {onApplyHierarchy && (
                                    <button
                                        type="button"
                                        onClick={onApplyHierarchy}
                                        style={{
                                            background: 'rgba(16, 185, 129, 0.15)',
                                            border: '1px solid rgba(16, 185, 129, 0.4)',
                                            color: '#6ee7b7',
                                            padding: '0.4rem 0.85rem',
                                            borderRadius: '8px',
                                            fontSize: '0.78rem',
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                        title="Ordena inmediatamente a los agentes de la plantilla siguiendo esta jerarquía"
                                    >
                                        <span>🔄</span>
                                        <span>Ordenar Plantilla por esta Jerarquía</span>
                                    </button>
                                )}
                            </div>

                            {/* Ranks list */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                {ranksList.map((rank, idx) => (
                                    <div
                                        key={rank.id || idx}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            background: 'rgba(30, 41, 59, 0.45)',
                                            border: '1px solid rgba(255, 255, 255, 0.08)',
                                            borderRadius: '10px',
                                            padding: '0.6rem 0.9rem',
                                            gap: '0.8rem'
                                        }}
                                    >
                                        {/* Position & Move */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 900,
                                                color: '#fbbf24',
                                                background: 'rgba(234, 179, 8, 0.12)',
                                                border: '1px solid rgba(234, 179, 8, 0.3)',
                                                borderRadius: '6px',
                                                padding: '2px 7px',
                                                minWidth: '28px',
                                                textAlign: 'center'
                                            }}>
                                                #{idx + 1}
                                            </span>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <button
                                                    type="button"
                                                    disabled={idx === 0}
                                                    onClick={() => moveRank(idx, -1)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: idx === 0 ? '#475569' : '#cbd5e1',
                                                        cursor: idx === 0 ? 'default' : 'pointer',
                                                        fontSize: '0.7rem',
                                                        lineHeight: 1,
                                                        padding: '1px 3px'
                                                    }}
                                                    title="Subir nivel jerárquico"
                                                >
                                                    ▲
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={idx === ranksList.length - 1}
                                                    onClick={() => moveRank(idx, 1)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: idx === ranksList.length - 1 ? '#475569' : '#cbd5e1',
                                                        cursor: idx === ranksList.length - 1 ? 'default' : 'pointer',
                                                        fontSize: '0.7rem',
                                                        lineHeight: 1,
                                                        padding: '1px 3px'
                                                    }}
                                                    title="Bajar nivel jerárquico"
                                                >
                                                    ▼
                                                </button>
                                            </div>
                                        </div>

                                        {/* Badge thumbnail */}
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '6px',
                                            background: 'rgba(15, 23, 42, 0.8)',
                                            border: `1px solid ${rank.color || 'rgba(255, 255, 255, 0.15)'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                            flexShrink: 0
                                        }}>
                                            {rank.badge_image_url ? (
                                                <img
                                                    src={rank.badge_image_url}
                                                    alt="Rank"
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                                    onError={e => { e.target.style.display = 'none'; }}
                                                />
                                            ) : (
                                                <span style={{ fontSize: '0.9rem' }}>🎖️</span>
                                            )}
                                        </div>

                                        {/* Rank info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {rank.name}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: rank.color || '#94a3b8', fontWeight: 600 }}>
                                                {rank.category || 'General'}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <button
                                                type="button"
                                                onClick={() => openEditForm(rank)}
                                                style={{
                                                    background: 'rgba(255, 255, 255, 0.06)',
                                                    border: '1px solid rgba(255, 255, 255, 0.12)',
                                                    color: '#cbd5e1',
                                                    borderRadius: '6px',
                                                    padding: '0.3rem 0.65rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteRank(rank)}
                                                style={{
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    color: '#f87171',
                                                    borderRadius: '6px',
                                                    padding: '0.3rem 0.65rem',
                                                    fontSize: '0.75rem',
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

