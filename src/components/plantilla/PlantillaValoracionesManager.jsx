import { useState } from 'react';
import {
    savePlantillaValoracion,
    deletePlantillaValoracion,
    updateValoracionesOrder,
    DEFAULT_VALORACIONES,
    hexToRgba
} from '../../services/plantillaService';

const PRESET_COLORS = [
    { label: 'Verde (Ascenso)', color: '#10b981' },
    { label: 'Azul (Val. Ascenso)', color: '#3b82f6' },
    { label: 'Amarillo (Observación)', color: '#f59e0b' },
    { label: 'Rojo (Degrado / Inactivo)', color: '#ef4444' },
    { label: 'Púrpura', color: '#8b5cf6' },
    { label: 'Cian', color: '#06b6d4' },
    { label: 'Naranja', color: '#f97316' },
    { label: 'Rosa', color: '#ec4899' },
    { label: 'Índigo', color: '#6366f1' }
];

export default function PlantillaValoracionesManager({ valoraciones, onClose, onValoracionesUpdated }) {
    const [valList, setValList] = useState(valoraciones || DEFAULT_VALORACIONES);
    const [editingVal, setEditingVal] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        color: '#10b981',
        description: '',
        order_index: valList.length + 1
    });

    const openCreateForm = () => {
        setEditingVal(null);
        setFormData({
            name: '',
            color: '#10b981',
            description: '',
            order_index: valList.length + 1
        });
        setIsCreating(true);
    };

    const openEditForm = (item) => {
        setEditingVal(item);
        setFormData({
            name: item.name,
            color: item.color || '#10b981',
            description: item.description || '',
            order_index: item.order_index || 1
        });
        setIsCreating(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('Por favor introduce el nombre o motivo de la valoración / acotación');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                ...(editingVal ? { id: editingVal.id } : {}),
                ...formData
            };
            const saved = await savePlantillaValoracion(payload);
            let updatedList;
            if (editingVal) {
                updatedList = valList.map(v => v.id === editingVal.id ? saved : v);
            } else {
                updatedList = [...valList, saved].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
            }
            setValList(updatedList);
            setIsCreating(false);
            setEditingVal(null);
            if (onValoracionesUpdated) onValoracionesUpdated(updatedList);
        } catch (err) {
            alert('Error guardando valoración: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item) => {
        if (!window.confirm(`¿Seguro que deseas eliminar la acotación "${item.name}"? Los agentes que la tengan asignada dejarán de mostrar este marcado de fila.`)) return;
        try {
            await deletePlantillaValoracion(item.id);
            const updated = valList.filter(v => v.id !== item.id);
            setValList(updated);
            if (onValoracionesUpdated) onValoracionesUpdated(updated);
        } catch (err) {
            alert('Error al eliminar acotación: ' + err.message);
        }
    };

    const handleMove = async (index, direction) => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= valList.length) return;

        const updated = [...valList];
        const temp = updated[index];
        updated[index] = updated[targetIndex];
        updated[targetIndex] = temp;

        setValList(updated);
        try {
            const persisted = await updateValoracionesOrder(updated);
            setValList(persisted);
            if (onValoracionesUpdated) onValoracionesUpdated(persisted);
        } catch (e) {
            console.error('Error reordering valoraciones:', e);
        }
    };

    const handleResetDefaults = async () => {
        if (!window.confirm('¿Deseas restablecer las valoraciones a los 4 valores por defecto (Ascenso, Val. Ascenso, Observación, Degrado)?')) return;
        try {
            setSaving(true);
            const persisted = await updateValoracionesOrder(DEFAULT_VALORACIONES);
            setValList(persisted);
            if (onValoracionesUpdated) onValoracionesUpdated(persisted);
        } catch (err) {
            alert('Error al restablecer valores por defecto: ' + err.message);
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
                            🏷️
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: '#f8fafc' }}>
                                Gestión de Acotaciones / Valoración
                            </h2>
                            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                                Configura los motivos y colores que marcarán <strong>toda la fila</strong> de los agentes en la plantilla
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#94a3b8',
                            borderRadius: '8px',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '1.1rem'
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Body Content */}
                <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                    {isCreating ? (
                        /* CREATE / EDIT FORM */
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div style={{
                                background: 'rgba(30, 41, 59, 0.5)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '12px',
                                padding: '1.25rem'
                            }}>
                                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>
                                    {editingVal ? '✏️ Editar Acotación / Valoración' : '➕ Nueva Acotación / Valoración'}
                                </h3>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    {/* Name / Motivo */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                            Nombre / Motivo en Columna *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Ascenso, Val. Ascenso, Observación..."
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(15, 23, 42, 0.8)',
                                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                                borderRadius: '8px',
                                                padding: '0.55rem 0.75rem',
                                                color: '#f8fafc',
                                                fontSize: '0.85rem'
                                            }}
                                            required
                                        />
                                    </div>

                                    {/* Color Picker with presets */}
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                            Color de Marcado de Fila *
                                        </label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <input
                                                type="color"
                                                value={formData.color}
                                                onChange={e => setFormData({ ...formData, color: e.target.value })}
                                                style={{
                                                    width: '42px',
                                                    height: '38px',
                                                    borderRadius: '8px',
                                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                                    background: 'transparent',
                                                    cursor: 'pointer'
                                                }}
                                            />
                                            <input
                                                type="text"
                                                value={formData.color}
                                                onChange={e => setFormData({ ...formData, color: e.target.value })}
                                                style={{
                                                    width: '100px',
                                                    background: 'rgba(15, 23, 42, 0.8)',
                                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                                    borderRadius: '8px',
                                                    padding: '0.55rem 0.75rem',
                                                    color: '#f8fafc',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 700
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Preset color pills */}
                                <div style={{ marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
                                        Paleta de colores rápidos:
                                    </span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {PRESET_COLORS.map(p => (
                                            <button
                                                key={p.color}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, color: p.color })}
                                                style={{
                                                    background: formData.color === p.color ? hexToRgba(p.color, 0.4) : 'rgba(255, 255, 255, 0.05)',
                                                    border: `1px solid ${formData.color === p.color ? p.color : 'rgba(255, 255, 255, 0.1)'}`,
                                                    borderRadius: '6px',
                                                    padding: '3px 8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    cursor: 'pointer',
                                                    color: '#f8fafc',
                                                    fontSize: '0.72rem'
                                                }}
                                            >
                                                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.color }} />
                                                <span>{p.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Motivo / Descripción */}
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                                        Motivo / Descripción de la Acotación
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Propuesto para ascenso en la próxima promoción, etc."
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(15, 23, 42, 0.8)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            borderRadius: '8px',
                                            padding: '0.55rem 0.75rem',
                                            color: '#f8fafc',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                </div>

                                {/* LIVE ROW PREVIEW */}
                                <div>
                                    <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '6px' }}>
                                        👁️ Vista previa de cómo se marcará toda la fila:
                                    </span>
                                    <div style={{
                                        background: `linear-gradient(90deg, ${hexToRgba(formData.color, 0.28)} 0%, ${hexToRgba(formData.color, 0.10)} 100%)`,
                                        border: `1px solid ${hexToRgba(formData.color, 0.45)}`,
                                        borderLeft: `4px solid ${formData.color}`,
                                        borderRadius: '8px',
                                        padding: '0.65rem 1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '12px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 900,
                                                background: hexToRgba(formData.color, 0.35),
                                                border: `1px solid ${formData.color}`,
                                                color: '#ffffff',
                                                padding: '2px 8px',
                                                borderRadius: '5px'
                                            }}>
                                                ● {formData.name || 'Sin nombre'}
                                            </span>
                                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f8fafc' }}>
                                                #500 Barclay, Wyatt
                                            </span>
                                            <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                                                14. Sheriff
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                            {formData.description || 'Toda la fila del agente adoptará este color'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => { setIsCreating(false); setEditingVal(null); }}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.08)',
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        color: '#cbd5e1',
                                        padding: '0.55rem 1.25rem',
                                        borderRadius: '10px',
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
                                        padding: '0.55rem 1.5rem',
                                        borderRadius: '10px',
                                        fontWeight: 800,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
                                    }}
                                >
                                    {saving ? 'Guardando...' : (editingVal ? 'Guardar Cambios' : 'Crear Acotación')}
                                </button>
                            </div>
                        </form>
                    ) : (
                        /* VALORACIONES LIST */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>
                                    Total Acotaciones configuradas: <strong style={{ color: '#f8fafc' }}>{valList.length}</strong>
                                </span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={handleResetDefaults}
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.05)',
                                            border: '1px solid rgba(255, 255, 255, 0.12)',
                                            color: '#cbd5e1',
                                            padding: '0.4rem 0.8rem',
                                            borderRadius: '8px',
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            cursor: 'pointer'
                                        }}
                                        title="Restablece los 4 valores por defecto (Ascenso, Val. Ascenso, Observación, Degrado)"
                                    >
                                        ↺ Restaurar Valores Por Defecto
                                    </button>
                                    <button
                                        type="button"
                                        onClick={openCreateForm}
                                        style={{
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                            border: 'none',
                                            color: '#ffffff',
                                            padding: '0.45rem 1rem',
                                            borderRadius: '8px',
                                            fontWeight: 800,
                                            fontSize: '0.80rem',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}
                                    >
                                        <span>➕</span>
                                        <span>Nueva Acotación</span>
                                    </button>
                                </div>
                            </div>

                            {valList.map((item, index) => (
                                <div
                                    key={item.id || item.name}
                                    style={{
                                        background: `linear-gradient(90deg, ${hexToRgba(item.color, 0.22)} 0%, rgba(30, 41, 59, 0.4) 100%)`,
                                        border: `1px solid ${hexToRgba(item.color, 0.4)}`,
                                        borderLeft: `5px solid ${item.color || '#10b981'}`,
                                        borderRadius: '12px',
                                        padding: '0.85rem 1.1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '12px',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        {/* Reorder arrows */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <button
                                                type="button"
                                                disabled={index === 0}
                                                onClick={() => handleMove(index, -1)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: index === 0 ? '#334155' : '#94a3b8',
                                                    cursor: index === 0 ? 'default' : 'pointer',
                                                    fontSize: '0.70rem',
                                                    padding: 0,
                                                    lineHeight: 1
                                                }}
                                            >
                                                ▲
                                            </button>
                                            <button
                                                type="button"
                                                disabled={index === valList.length - 1}
                                                onClick={() => handleMove(index, 1)}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: index === valList.length - 1 ? '#334155' : '#94a3b8',
                                                    cursor: index === valList.length - 1 ? 'default' : 'pointer',
                                                    fontSize: '0.70rem',
                                                    padding: 0,
                                                    lineHeight: 1
                                                }}
                                            >
                                                ▼
                                            </button>
                                        </div>

                                        {/* Color Badge Pill */}
                                        <div style={{
                                            background: hexToRgba(item.color, 0.35),
                                            border: `1px solid ${item.color}`,
                                            color: '#ffffff',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontWeight: 900,
                                            fontSize: '0.82rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                                            <span>{item.name}</span>
                                        </div>

                                        {/* Description / Motivo */}
                                        <div>
                                            <span style={{ fontSize: '0.80rem', color: '#cbd5e1', fontWeight: 600 }}>
                                                {item.description || 'Sin descripción'}
                                            </span>
                                            <span style={{ display: 'block', fontSize: '0.68rem', color: '#64748b' }}>
                                                Código Color: {item.color}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Edit / Delete actions */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <button
                                            type="button"
                                            onClick={() => openEditForm(item)}
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.08)',
                                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                                color: '#cbd5e1',
                                                padding: '0.35rem 0.65rem',
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ✏️ Editar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(item)}
                                            style={{
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                color: '#f87171',
                                                padding: '0.35rem 0.65rem',
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            🗑️ Eliminar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    background: 'rgba(15, 23, 42, 0.95)',
                    borderBottomLeftRadius: '20px',
                    borderBottomRightRadius: '20px'
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            color: '#cbd5e1',
                            padding: '0.5rem 1.5rem',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: 'pointer'
                        }}
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

