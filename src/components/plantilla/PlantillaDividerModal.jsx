import { useState, useEffect } from 'react';
import { hexToRgba } from '../../services/plantillaService';

const PRESET_SECTIONS = [
    { title: 'JEFATURA SHERIFF', icon: '⭐', color: '#eab308' },
    { title: 'COMMAND', icon: '🏛️', color: '#3b82f6' },
    { title: 'SARGENTOS', icon: '🛡️', color: '#10b981' },
    { title: 'DETECTIVES', icon: '🕵️', color: '#8b5cf6' },
    { title: 'ESCALA BÁSICA', icon: '👮', color: '#06b6d4' },
    { title: 'UNIDAD K9', icon: '🐕', color: '#047857' },
    { title: 'ASUNTOS INTERNOS', icon: '⚖️', color: '#b91c1c' },
    { title: 'RESERVAS / PLAZAS', icon: '📌', color: '#d97706' }
];

const PRESET_COLORS = [
    '#eab308', // Dorado Jefatura
    '#3b82f6', // Azul Command
    '#10b981', // Verde Sargentos
    '#8b5cf6', // Púrpura Detectives
    '#06b6d4', // Cyan Básica
    '#f59e0b', // Ámbar
    '#ef4444', // Rojo
    '#ec4899', // Rosa
    '#64748b'  // Gris Slate
];

const PRESET_ICONS = ['📁', '🛡️', '🎖️', '👮', '🕵️', '🐕', '🚁', '⚖️', '📌', '🏷️', '⭐', '🏛️'];

export default function PlantillaDividerModal({
    isOpen,
    divider,
    initialInsertIndex = null,
    agents = [],
    onSave,
    onClose
}) {
    const isEditing = Boolean(divider && divider.id);

    const [title, setTitle] = useState('');
    const [color, setColor] = useState('#3b82f6');
    const [icon, setIcon] = useState('📁');
    const [insertPosition, setInsertPosition] = useState('end'); // 'start' | 'end' | number (index)

    useEffect(() => {
        if (!isOpen) return;

        if (divider) {
            setTitle(divider.title || divider.nombre || '');
            setColor(divider.color || '#3b82f6');
            setIcon(divider.icon || '📁');
            setInsertPosition('current');
        } else {
            setTitle('');
            setColor('#3b82f6');
            setIcon('📁');
            if (typeof initialInsertIndex === 'number' && initialInsertIndex >= 0) {
                setInsertPosition(initialInsertIndex);
            } else {
                setInsertPosition('end');
            }
        }
    }, [isOpen, divider, initialInsertIndex]);

    if (!isOpen) return null;

    const handleApplyPreset = (preset) => {
        setTitle(preset.title);
        setColor(preset.color);
        setIcon(preset.icon);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const cleanTitle = title.trim().toUpperCase();
        if (!cleanTitle) {
            alert('Por favor introduce un nombre o título para la sección / barra divisoria.');
            return;
        }

        const dividerPayload = {
            ...(divider ? { id: divider.id } : {}),
            is_divider: true,
            title: cleanTitle,
            nombre: cleanTitle,
            color,
            icon
        };

        onSave(dividerPayload, insertPosition);
        onClose();
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
        }}>
            <div style={{
                background: '#0f172a',
                border: `1px solid ${hexToRgba(color, 0.6)}`,
                borderRadius: '16px',
                width: '100%',
                maxWidth: '520px',
                boxShadow: `0 20px 50px rgba(0, 0, 0, 0.7), 0 0 25px ${hexToRgba(color, 0.25)}`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(30, 41, 59, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                                {isEditing ? 'Editar Barra Divisoria' : 'Nueva Barra Divisoria / Sección'}
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8' }}>
                                Divide y organiza la plantilla en apartados (Jefatura, Sargentos, Detectives...)
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                            padding: '4px',
                            lineHeight: 1
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Quick Presets */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.70rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
                            Plantillas Rápidas:
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {PRESET_SECTIONS.map(preset => (
                                <button
                                    key={preset.title}
                                    type="button"
                                    onClick={() => handleApplyPreset(preset)}
                                    style={{
                                        background: title === preset.title ? hexToRgba(preset.color, 0.35) : 'rgba(30, 41, 59, 0.8)',
                                        border: title === preset.title ? `1px solid ${preset.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                                        color: title === preset.title ? '#ffffff' : '#cbd5e1',
                                        borderRadius: '6px',
                                        padding: '3px 8px',
                                        fontSize: '0.68rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <span>{preset.icon}</span>
                                    <span>{preset.title}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section Title Input */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                            Título de la Sección / Apartado *
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value.toUpperCase())}
                            placeholder="Ej. SARGENTOS, DETECTIVES, COMMAND..."
                            required
                            autoFocus
                            style={{
                                width: '100%',
                                background: 'rgba(15, 23, 42, 0.85)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                borderRadius: '8px',
                                padding: '0.5rem 0.75rem',
                                color: '#f8fafc',
                                fontSize: '0.85rem',
                                fontWeight: 800,
                                letterSpacing: '0.04em'
                            }}
                        />
                    </div>

                    {/* Icon & Color Selection */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1rem' }}>
                        {/* Icon Picker */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                Icono
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', background: 'rgba(15, 23, 42, 0.6)', padding: '6px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                {PRESET_ICONS.map(ic => (
                                    <button
                                        key={ic}
                                        type="button"
                                        onClick={() => setIcon(ic)}
                                        style={{
                                            width: '28px',
                                            height: '28px',
                                            background: icon === ic ? hexToRgba(color, 0.35) : 'transparent',
                                            border: icon === ic ? `1px solid ${color}` : '1px solid transparent',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontSize: '0.95rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.12s ease'
                                        }}
                                    >
                                        {ic}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Color Picker */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                Color del Borde / Indicador
                            </label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                {PRESET_COLORS.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '6px',
                                            background: c,
                                            border: color === c ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.3)',
                                            boxShadow: color === c ? `0 0 10px ${c}` : 'none',
                                            cursor: 'pointer',
                                            transform: color === c ? 'scale(1.15)' : 'scale(1)',
                                            transition: 'all 0.15s ease'
                                        }}
                                    />
                                ))}
                                <input
                                    type="color"
                                    value={color}
                                    onChange={e => setColor(e.target.value)}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        padding: 0,
                                        border: 'none',
                                        borderRadius: '6px',
                                        background: 'transparent',
                                        cursor: 'pointer'
                                    }}
                                    title="Elegir color personalizado"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Position Selector (when creating a new divider) */}
                    {!isEditing && (
                        <div>
                            <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                                Ubicación / Posición de la Barra:
                            </label>
                            <select
                                value={insertPosition}
                                onChange={e => setInsertPosition(e.target.value === 'start' || e.target.value === 'end' ? e.target.value : Number(e.target.value))}
                                style={{
                                    width: '100%',
                                    background: 'rgba(15, 23, 42, 0.85)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    borderRadius: '8px',
                                    padding: '0.45rem 0.65rem',
                                    color: '#f8fafc',
                                    fontSize: '0.78rem'
                                }}
                            >
                                <option value="start">⬆️ Al principio de la plantilla (Fila 1)</option>
                                <option value="end">⬇️ Al final de la plantilla</option>
                                {agents.map((ag, idx) => {
                                    if (ag.is_divider) {
                                        return (
                                            <option key={ag.id || idx} value={idx}>
                                                Debajo de Sección: [{ag.title || ag.nombre}]
                                            </option>
                                        );
                                    }
                                    const name = ag.nombre || ag.apellido ? `${ag.nombre} ${ag.apellido}` : (ag.username || `Placa #${ag.no_placa}`);
                                    const rank = ag.rank_name ? `(${ag.rank_name})` : '';
                                    return (
                                        <option key={ag.id || idx} value={idx}>
                                            Debajo de: #{ag.no_placa || idx + 1} {name} {rank}
                                        </option>
                                    );
                                })}
                            </select>
                            <div style={{ fontSize: '0.66rem', color: '#64748b', marginTop: '0.25rem' }}>
                                💡 Consejo: Una vez insertada, también podrás mover la barra arriba o abajo con las flechas ▲ / ▼ en cualquier momento.
                            </div>
                        </div>
                    )}

                    {/* Live Preview */}
                    <div>
                        <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                            Vista Previa en la Tabla:
                        </div>
                        <div style={{
                            background: `linear-gradient(90deg, ${hexToRgba(color, 0.22)} 0%, rgba(15, 23, 42, 0.95) 45%, rgba(15, 23, 42, 0.98) 100%)`,
                            borderTop: `2px solid ${color}`,
                            borderBottom: `1px solid ${hexToRgba(color, 0.4)}`,
                            borderRadius: '6px',
                            padding: '0.45rem 0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.05rem' }}>{icon}</span>
                                <span style={{
                                    fontSize: '0.82rem',
                                    fontWeight: 900,
                                    letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                    color: '#ffffff',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.5)'
                                }}>
                                    {title || 'TITULO DE SECCIÓN'}
                                </span>
                                <span style={{
                                    fontSize: '0.60rem',
                                    fontWeight: 800,
                                    padding: '2px 6px',
                                    borderRadius: '10px',
                                    background: hexToRgba(color, 0.3),
                                    color: '#e2e8f0',
                                    border: `1px solid ${hexToRgba(color, 0.6)}`
                                }}>
                                    X agentes
                                </span>
                                <div style={{
                                    width: '35px',
                                    height: '2px',
                                    background: `linear-gradient(90deg, ${color}, transparent)`,
                                    borderRadius: '2px'
                                }} />
                            </div>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Acciones ✏️ 🗑️</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '0.4rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#94a3b8',
                                padding: '0.45rem 1rem',
                                borderRadius: '8px',
                                fontSize: '0.80rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            style={{
                                background: `linear-gradient(135deg, ${color}, ${hexToRgba(color, 0.8)})`,
                                border: `1px solid ${color}`,
                                color: '#ffffff',
                                padding: '0.45rem 1.25rem',
                                borderRadius: '8px',
                                fontSize: '0.80rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                boxShadow: `0 4px 14px ${hexToRgba(color, 0.4)}`
                            }}
                        >
                            {isEditing ? 'Actualizar Sección' : 'Añadir Barra Divisoria'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

