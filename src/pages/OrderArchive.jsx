import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../index.css';
import { generateOrderPDF } from '../utils/orderPdfGenerator';

// --- CONFIGURATION ---
// Note: 'options' can now be a string key (starting with $$) to reference dynamic data
const ORDER_TYPES = {
    'Orden de Registro (Casa)': {
        label: 'Orden de Registro (Casa)',
        color: '#3b82f6', // Blue
        icon: '🏠',
        fields: [
            { name: 'request_date', label: 'Fecha Solicitud', type: 'readonly_date' },
            { 
                name: 'target_properties', 
                label: 'Propiedades a Registrar', 
                type: 'property_repeater', 
                subFields: [
                    { name: 'owner', label: 'Propietario', placeholder: 'Nombre Apellido' },
                    { name: 'address', label: 'Dirección', placeholder: '[12 Strawberry Avenue, Los Santos, San Andreas]' }
                ]
            },
            { name: 'probable_cause', label: 'Motivo de la Orden', type: 'textarea' },
            { name: 'linked_case_id', label: 'Vincular Caso (Opcional)', documentLabel: 'Caso Vinculado', type: 'select', options: '$$cases', optional: true },
            { name: 'linked_gang_id', label: 'Vincular Banda (Opcional)', documentLabel: 'Banda Vinculada', type: 'select', options: '$$gangs', optional: true }
        ]
    },
    'Orden de Registro (Coche)': {
        label: 'Orden de Registro (Coche)',
        color: '#0ea5e9', // Sky Blue
        icon: '🚗',
        fields: [
            { 
                name: 'target_vehicles', 
                label: 'Vehículos a Registrar', 
                type: 'vehicle_repeater', 
                subFields: [
                    { name: 'owner', label: 'Propietario', placeholder: 'Nombre Apellido' },
                    { name: 'model', label: 'Modelo', placeholder: 'ej. Oracle' },
                    { name: 'plate', label: 'Matrícula', placeholder: 'ej. 44ASD123' }
                ]
            },
            { name: 'probable_cause', label: 'Motivo del Registro', type: 'textarea' },
            { name: 'linked_case_id', label: 'Vincular Caso (Opcional)', documentLabel: 'Caso Vinculado', type: 'select', options: '$$cases', optional: true },
            { name: 'linked_gang_id', label: 'Vincular Banda (Opcional)', documentLabel: 'Banda Vinculada', type: 'select', options: '$$gangs', optional: true }
        ]
    },
    'Orden de Arresto': {
        label: 'Orden de Arresto',
        color: '#ef4444', // Red
        icon: '👮',
        fields: [
            { 
                name: 'target_suspects', 
                label: 'Personas a Arrestar', 
                type: 'person_repeater', 
                subFields: [
                    { name: 'name', label: 'Nombre de la Persona', placeholder: 'Nombre Apellido' },
                    { name: 'id', label: 'ID de la Persona', placeholder: 'ej. 12345' }
                ]
            },
            { name: 'warrant_reason', label: 'Motivo de la Orden', type: 'textarea' },
            { name: 'linked_case_id', label: 'Vincular Caso (Opcional)', documentLabel: 'Caso Vinculado', type: 'select', options: '$$cases', optional: true },
            { name: 'linked_gang_id', label: 'Vincular Banda (Opcional)', documentLabel: 'Banda Vinculada', type: 'select', options: '$$gangs', optional: true }
        ]
    },
    'Orden de Revision Telefonica': {
        label: 'Revisión Telefónica',
        color: '#8b5cf6', // Purple
        icon: '📱',
        fields: [
            { name: 'target_number', label: 'Número de Teléfono', type: 'text' },
            { name: 'target_owner', label: 'Titular de la Línea', type: 'text' },
            { name: 'duration_days', label: 'Duración (Días)', type: 'number' },
            { name: 'justification', label: 'Justificación Investigativa', type: 'textarea' }
        ]
    },
    'Orden de Revision Bancaria': {
        label: 'Revisión Bancaria',
        color: '#10b981', // Emerald
        icon: '💳',
        fields: [
            { name: 'target_account', label: 'Número de Cuenta / Banco', type: 'text' },
            { name: 'target_owner', label: 'Titular de la Cuenta', type: 'text' },
            { name: 'timeframe', label: 'Periodo de Tiempo', type: 'text', placeholder: 'ej. Últimos 3 meses' },
            { name: 'justification', label: 'Justificación Financiera', type: 'textarea' }
        ]
    },
    'Orden de Identificacion Red Social': {
        label: 'Identificación Red Social',
        color: '#8b5cf6', // Violet
        icon: '🌐',
        fields: [
            { name: 'social_network', label: 'Red Social (ej. Lifeinvader, Bleeter)', type: 'text' },
            { name: 'username_url', label: 'Nombre de Usuario / URL', type: 'text' },
            { name: 'target_owner', label: 'Posible Propietario (si se conoce)', type: 'text' },
            { name: 'justification', label: 'Justificación Investigativa', type: 'textarea' }
        ]
    },
    'Orden de Identificacion Telefono Movil': {
        label: 'Identificación Teléfono Móvil',
        color: '#60a5fa', // Light Blue
        icon: '📞',
        fields: [
            { name: 'target_number', label: 'Número de Teléfono (a identificar)', type: 'text' },
            { name: 'suspected_owner', label: 'Posible Propietario', type: 'text' },
            { name: 'justification', label: 'Motivo de la Identificación', type: 'textarea' }
        ]
    },
    'Orden de Decomiso': {
        label: 'Orden de Decomiso',
        color: '#f59e0b', // Amber
        icon: '📦',
        fields: [
            { name: 'target_items', label: 'Objetos a Decomisar', type: 'textarea' },
            { name: 'owner_name', label: 'Propietario', type: 'text' },
            { name: 'location', label: 'Ubicación de los Objetos', type: 'text' },
            { name: 'reason', label: 'Motivo del Decomiso', type: 'textarea' }
        ]
    },
    'Orden de Alejamiento': {
        label: 'Orden de Alejamiento',
        color: '#ec4899', // Pink
        icon: '🚫',
        fields: [
            { name: 'restricted_person', label: 'Persona Restringida', type: 'text' },
            { name: 'protected_person', label: 'Persona Protegida', type: 'text' },
            { name: 'distance_meters', label: 'Distancia Mínima (Metros)', type: 'number' },
            { name: 'details', label: 'Detalles Adicionales', type: 'textarea' }
        ]
    },
    'Orden de Precinto': {
        label: 'Orden de Precinto',
        color: '#6366f1', // Indigo
        icon: '🔒',
        fields: [
            { name: 'property_address', label: 'Propiedad/Negocio a Precintar', type: 'text' },
            { name: 'owner_name', label: 'Propietario', type: 'text' },
            { name: 'duration', label: 'Duración / Hasta cuándo', type: 'text' },
            { name: 'reason', label: 'Motivo del Precinto', type: 'textarea' }
        ]
    }
};

// --- COMPONENTS ---

const CategoryItem = ({ type, config, active, onClick }) => (
    <button
        onClick={onClick}
        style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '12px 16px',
            marginBottom: '8px',
            background: active ? 'linear-gradient(90deg, rgba(212,175,55,0.2) 0%, transparent 100%)' : 'transparent',
            border: 'none',
            borderLeft: active ? '4px solid var(--accent-gold)' : '4px solid transparent',
            color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.2s ease',
            borderRadius: '0 8px 8px 0',
            fontWeight: active ? 'bold' : 'normal',
            fontSize: '0.95rem'
        }}
        className="category-hover"
    >
        <span style={{ marginRight: '12px', fontSize: '1.2rem' }}>{config ? config.icon : '📂'}</span>
        {config ? config.label : 'Todas las Ordenes'}
    </button>
);

const OrderCard = ({ order, onPreview }) => {
    const config = ORDER_TYPES[order.order_type];
    const color = config?.color || '#999';
    const icon = config?.icon || '📄';
    
    // Status Badge Logic
    const getStatusColor = (s) => {
        if (s === 'Aprobada') return '#10b981'; // Green
        if (s === 'Rechazada') return '#ef4444'; // Red
        return '#f59e0b'; // Amber (Pendiente)
    };
    const statusColor = getStatusColor(order.status || 'Pendiente');

    const renderContent = () => {
        return Object.entries(order.content).slice(0, 3).map(([key, val]) => {
            if (!val) return null;
            const field = config?.fields.find(f => f.name === key);
            
            // Convert value to string for display
            let displayValue = val;
            if (Array.isArray(val)) {
                // Handle arrays (vehicles, properties, persons)
                if (val.length > 0) {
                    if (val[0].plate) displayValue = `${val.length} vehículo${val.length > 1 ? 's' : ''}`;
                    else if (val[0].address) displayValue = `${val.length} propiedad${val.length > 1 ? 'es' : ''}`;
                    else if (val[0].name) displayValue = `${val.length} persona${val.length > 1 ? 's' : ''}`;
                    else displayValue = `${val.length} item${val.length > 1 ? 's' : ''}`;
                }
            } else if (typeof val === 'object') {
                displayValue = JSON.stringify(val);
            } else {
                displayValue = String(val);
            }
            
            return (
                <div key={key} style={{ marginBottom: '4px', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>{field?.label || key}:</span>
                    <span style={{ color: '#eee' }}>{displayValue.length > 50 ? displayValue.substring(0, 50) + '...' : displayValue}</span>
                </div>
            );
        });
    };

    return (
        <div className="glass-card" style={{
            padding: '1.5rem',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'default',
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: color }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                        background: `${color}22`, 
                        color: color, 
                        width: '32px', height: '32px', 
                        borderRadius: '8px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.2rem'
                    }}>
                        {icon}
                    </div>
                    <div>
                        <span style={{ fontSize: '0.8rem', color: color, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                            {order.order_type}
                        </span>
                        {/* Status Badge */}
                        <span style={{ 
                            fontSize: '0.65rem', 
                            background: `${statusColor}22`, 
                            color: statusColor, 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            border: `1px solid ${statusColor}44`,
                            marginTop: '2px',
                            display: 'inline-block'
                        }}>
                            {order.status || 'Pendiente'}
                        </span>
                    </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {new Date(order.created_at).toLocaleDateString()}
                </span>
            </div>

            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#fff', fontWeight: '600', lineHeight: '1.4' }}>
                {order.title.replace(order.order_type + ' - ', '')}
            </h3>

            <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '1rem' }}>
                {renderContent()}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <img 
                    src={order.author_avatar || '/anon.png'} 
                    alt="" 
                    style={{ width: '28px', height: '28px', borderRadius: '50%', marginRight: '10px', border: `1px solid ${color}44` }} 
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#ddd' }}>{order.author_rank} {order.author_name}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Detective Bureau</span>
                </div>
                
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                     <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onPreview(order);
                        }}
                        style={{ 
                            background: 'transparent', 
                            border: '1px solid rgba(255,255,255,0.2)', 
                            color: '#fff', 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontSize: '0.7rem', 
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '5px'
                        }}
                        title="Ver Vista Previa"
                        className="hover-bright"
                    >
                        <span>👁️</span>
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            import('../utils/orderPdfGenerator').then(mod => mod.generateOrderPDF(order, config));
                        }}
                        style={{ 
                            background: 'transparent', 
                            border: '1px solid rgba(255,255,255,0.2)', 
                            color: '#fff', 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontSize: '0.7rem', 
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '5px'
                        }}
                        title="Descargar PDF Oficial"
                        className="hover-bright"
                    >
                        <span>📄</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- PREVIEW MODAL ---
const PreviewModal = ({ order, isOpen, onClose, canManage, onUpdateStatus, onDelete }) => {
    if (!isOpen || !order) return null;
    const config = ORDER_TYPES[order.order_type];

    // Helper to render fields nicely in the preview
    const fields = Object.entries(order.content).map(([key, val]) => {
        const fieldConfig = config?.fields?.find(f => f.name === key);
        return { label: fieldConfig?.documentLabel || fieldConfig?.label || key, value: val };
    });

    return (
        <div className="cropper-modal-overlay" style={{ backdropFilter: 'blur(5px)', background: 'rgba(0,0,0,0.8)', zIndex: 9999 }}>
            <div className="cropper-modal-content" style={{ 
                maxWidth: '800px', 
                height: '90vh',
                padding: '0', 
                background: '#fff', // White paper background
                color: '#000', // Black text
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
                display: 'flex', flexDirection: 'column'
            }}>
                {/* Scrollable Paper Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '3rem' }}>
                    
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', borderBottom: '2px solid #000', paddingBottom: '1rem' }}>
                        <img src="/dblogo.png" alt="DB" style={{ width: '60px', height: '60px' }} />
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1.2rem' }}>Los Santos Police Department</h2>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'normal' }}>DETECTIVE BUREAU</h3>
                        </div>
                        <img src="/LOGO_SAPD.png" alt="LSPD" style={{ width: '60px', height: '60px' }} />
                    </div>

                    <h1 style={{ textAlign: 'center', textTransform: 'uppercase', fontSize: '1.8rem', margin: '2rem 0' }}>Solicitud de Orden Judicial</h1>
                    <h2 style={{ textAlign: 'center', color: '#555', fontSize: '1.2rem', margin: '0 0 3rem 0', textTransform: 'uppercase' }}>{order.order_type}</h2>

                    {/* Meta Info */}
                    <div style={{ marginBottom: '2rem', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between' }}>
                        <div><strong>SOLICITANTE:</strong> {order.author_rank} {order.author_name}</div>
                        <div><strong>FECHA:</strong> {new Date(order.created_at).toLocaleDateString()}</div>
                        <div><strong>ESTADO:</strong> {order.status}</div>
                    </div>

                    {/* Fields */}
                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                        {fields.map((f, i) => {
                            // Special handling for arrays with owner field
                            if (Array.isArray(f.value) && f.value.length > 0 && f.value[0].owner) {
                                // Check if it's a vehicle (has plate and model) or property (has address)
                                const isVehicle = f.value[0].plate && f.value[0].model;
                                
                                if (isVehicle) {
                                    return (
                                        <div key={i}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#444', marginBottom: '8px' }}>{f.label}</div>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                                                        <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Propietario</th>
                                                        <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Modelo</th>
                                                        <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Matrícula</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {f.value.map((v, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                                            <td style={{ padding: '6px' }}>{v.owner}</td>
                                                            <td style={{ padding: '6px' }}>{v.model}</td>
                                                            <td style={{ padding: '6px' }}>{v.plate}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                } else {
                                    // Property array
                                    return (
                                        <div key={i}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#444', marginBottom: '8px' }}>{f.label}</div>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                                                        <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Propietario</th>
                                                        <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Dirección</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {f.value.map((p, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                                            <td style={{ padding: '6px' }}>{p.owner}</td>
                                                            <td style={{ padding: '6px' }}>{p.address}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                }
                            }
                            
                            // Special handling for person arrays (has name and id)
                            if (Array.isArray(f.value) && f.value.length > 0 && f.value[0].name && f.value[0].id) {
                                return (
                                    <div key={i}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#444', marginBottom: '8px' }}>{f.label}</div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid #ddd' }}>
                                                    <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Nombre</th>
                                                    <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>ID</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {f.value.map((person, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                                        <td style={{ padding: '6px' }}>{person.name}</td>
                                                        <td style={{ padding: '6px' }}>{person.id}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            }
                            
                            return (
                                <div key={i}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#444', marginBottom: '4px' }}>{f.label}</div>
                                    <div style={{ fontSize: '1rem', lineHeight: '1.5', borderBottom: '1px dashed #ccc', paddingBottom: '4px' }}>{f.value || '-'}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Signature Area */}
                    <div style={{ marginTop: '4rem', textAlign: 'right' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{order.author_rank} {order.author_name}</div>
                        <div style={{ fontSize: '0.9rem' }}>Detective Bureau, LSPD</div>
                    </div>

                </div>

                {/* Footer Controls (Dark UI for contrast) */}
                <div style={{ padding: '1rem 2rem', background: '#1a1a1a', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     
                     <div style={{ display: 'flex', gap: '1rem' }}>
                        <button type="button" className="login-button btn-secondary" onClick={onClose} style={{ width: 'auto', padding: '0.6rem 1.2rem' }}>Cerrar</button>
                        {canManage && (
                             <button type="button" onClick={() => onDelete(order.id)} style={{ width: 'auto', padding: '0.6rem', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Eliminar Orden">
                                 🗑️
                             </button>
                        )}
                     </div>
                     
                     {canManage && (
                         <div style={{ display: 'flex', gap: '1rem' }}>
                             {order.status !== 'Rechazada' && (
                                 <button 
                                     onClick={() => onUpdateStatus(order.id, 'Rechazada')}
                                     style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                     RECHAZAR
                                 </button>
                             )}
                             {order.status !== 'Pendiente' && (
                                 <button 
                                     onClick={() => onUpdateStatus(order.id, 'Pendiente')}
                                     style={{ background: '#f59e0b', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                     PENDIENTE
                                 </button>
                             )}
                             {order.status !== 'Aprobada' && (
                                 <button 
                                     onClick={() => onUpdateStatus(order.id, 'Aprobada')}
                                     style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                     APROBAR
                                 </button>
                             )}
                         </div>
                     )}
                </div>
            </div>
        </div>
    );
};


// --- MAIN PAGE ---
function OrderArchive() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState('Todas');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    // Preview State
    const [previewOrder, setPreviewOrder] = useState(null);
    const [showPreview, setShowPreview] = useState(false);

    // Dynamic Lists
    const [agentsList, setAgentsList] = useState([]);
    const [casesList, setCasesList] = useState([]);
    const [gangsList, setGangsList] = useState([]);

    // Form State
    const [selectedType, setSelectedType] = useState('Orden de Registro (Casa)');
    const [formData, setFormData] = useState({});
    const [submitting, setSubmitting] = useState(false);
    
    // Vehicle Repeater State
    const [tempVehicle, setTempVehicle] = useState({});
    
    // Property Repeater State
    const [tempProperty, setTempProperty] = useState({});
    
    // Person Repeater State
    const [tempPerson, setTempPerson] = useState({});

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterCategory]);

    // ... (existing useEffect) ...

    const handleAddVehicle = (field) => {
        const currentList = formData[field.name] || [];
        // Validate required subfields (all required for now)
        const required = field.subFields.every(sf => tempVehicle[sf.name]);
        if (!required) {
            alert('Por favor, complete todos los campos del vehículo.');
            return;
        }
        
        const newList = [...currentList, { ...tempVehicle }];
        setFormData(prev => ({ ...prev, [field.name]: newList }));
        setTempVehicle({});
    };

    const handleRemoveVehicle = (fieldName, index) => {
        const currentList = formData[fieldName] || [];
        const newList = currentList.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, [fieldName]: newList }));
    };
    
    const handleAddProperty = (field) => {
        const currentList = formData[field.name] || [];
        const required = field.subFields.every(sf => tempProperty[sf.name]);
        if (!required) {
            alert('Por favor, complete todos los campos de la propiedad.');
            return;
        }
        
        const newList = [...currentList, { ...tempProperty }];
        setFormData(prev => ({ ...prev, [field.name]: newList }));
        setTempProperty({});
    };

    const handleRemoveProperty = (fieldName, index) => {
        const currentList = formData[fieldName] || [];
        const newList = currentList.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, [fieldName]: newList }));
    };
    
    const handleAddPerson = (field) => {
        const currentList = formData[field.name] || [];
        const required = field.subFields.every(sf => tempPerson[sf.name]);
        if (!required) {
            alert('Por favor, complete todos los campos de la persona.');
            return;
        }
        
        const newList = [...currentList, { ...tempPerson }];
        setFormData(prev => ({ ...prev, [field.name]: newList }));
        setTempPerson({});
    };

    const handleRemovePerson = (fieldName, index) => {
        const currentList = formData[fieldName] || [];
        const newList = currentList.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, [fieldName]: newList }));
    };

    // Initial load of Lists (only once)
    useEffect(() => {
        const fetchLists = async () => {
            // Agents
            const { data: users } = await supabase.from('users').select('id, nombre, apellido, rango');
            if (users) {
                const agents = users.map(u => ({ label: `${u.rango} ${u.nombre} ${u.apellido}`, value: `${u.rango} ${u.nombre} ${u.apellido}` })); 
                setAgentsList(agents);
            }
            // Cases
            const { data: cases } = await supabase.from('cases').select('id, title');
            if (cases) setCasesList(cases.map(c => ({ label: c.title, value: c.title }))); // Store title for readability in JSON
            
            // Gangs
            const { data: gangs } = await supabase.from('gangs').select('id, name');
            if (gangs) setGangsList(gangs.map(g => ({ label: g.name, value: g.name })));
        };
        fetchLists();
    }, []);

    const loadData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
            setCurrentUser(data);
        }

        const { data: oData, error } = await supabase.rpc('get_judicial_orders', { p_type_filter: filterCategory });
        if (error) {
            console.error('Error fetching orders:', error);
        } else {
            console.log('Fetched Orders:', oData);
            setOrders(oData || []);
        }
        
        setLoading(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        
        // Auto-Title Logic
        const config = ORDER_TYPES[selectedType];
        
        let primaryValue = 'Sin Titulo';
        // Priority checks
        if (formData.target_properties && formData.target_properties.length > 0) {
            const p = formData.target_properties[0];
            primaryValue = p.address;
            if (formData.target_properties.length > 1) primaryValue += ` +${formData.target_properties.length - 1} más`;
        }
        else if (formData.target_address) primaryValue = formData.target_address;
        else if (formData.target_vehicles && formData.target_vehicles.length > 0) {
            const v = formData.target_vehicles[0];
            primaryValue = `${v.plate} (${v.model})`;
            if (formData.target_vehicles.length > 1) primaryValue += ` +${formData.target_vehicles.length - 1} más`;
        }
        else if (formData.plate_number) primaryValue = `${formData.plate_number} (${formData.vehicle_model || ''})`;
        else if (formData.target_suspects && formData.target_suspects.length > 0) {
            const s = formData.target_suspects[0];
            primaryValue = s.name;
            if (formData.target_suspects.length > 1) primaryValue += ` +${formData.target_suspects.length - 1} más`;
        }
        else if (formData.suspect_name) primaryValue = formData.suspect_name;
        else if (formData.target_number) primaryValue = formData.target_number;
        else if (formData.target_account) primaryValue = formData.target_account;
        else if (formData.username_url) primaryValue = `${formData.username_url} (${formData.social_network || ''})`;
        else if (formData.restricted_person) primaryValue = `${formData.restricted_person} (vs ${formData.protected_person})`;
        else if (formData.property_address) primaryValue = formData.property_address;
        else if (formData.owner_name) primaryValue = formData.owner_name;
        else if (formData.suspected_owner) primaryValue = formData.suspected_owner;
        else if (formData.target_items) primaryValue = formData.target_items.slice(0, 30);

        const autoTitle = `${selectedType} - ${primaryValue}`;
        
        // Prepare Content: Ensure request_date is set if type matches
        const finalContent = { ...formData };
        if (selectedType === 'Orden de Registro (Casa)') {
            finalContent.request_date = new Date().toLocaleDateString();
        }

        try {
            const { error } = await supabase.rpc('create_judicial_order', {
                p_type: selectedType,
                p_title: autoTitle,
                p_content: finalContent
            });

            if (error) throw error;

            setShowCreateModal(false);
            setFormData({});
            loadData();
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };
    
    // Status Management
    const handleStatusUpdate = async (orderId, newStatus) => {
        try {
            const { error } = await supabase.rpc('update_judicial_order_status', {
                p_order_id: orderId,
                p_new_status: newStatus
            });
            
            if (error) throw error;
            
            // Refresh data and close preview (or update local state)
            await loadData();
            // Optionally update the preview order object so the modal reflects the change immediately
            if (previewOrder && previewOrder.id === orderId) {
                setPreviewOrder(prev => ({ ...prev, status: newStatus }));
            }
        } catch (err) {
            console.error(err);
            alert('Error actualizando estado: ' + err.message);
        }
    };

    const handleDelete = async (orderId) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar esta orden? Esta acción no se puede deshacer.')) return;
        
        try {
            const { error } = await supabase.rpc('delete_judicial_order', { p_order_id: orderId });
            if (error) throw error;
            
            setShowPreview(false);
            setPreviewOrder(null);
            loadData();
        } catch (err) {
            console.error(err);
            alert('Error eliminando orden: ' + err.message);
        }
    };

    // Open Preview
    const openPreview = (order) => {
        setPreviewOrder(order);
        setShowPreview(true);
    };

    // Helper to get options for a field
    const getOptions = (optionKey) => {
        if (Array.isArray(optionKey)) return optionKey;
        if (optionKey === '$$agents') return agentsList;
        if (optionKey === '$$cases') return casesList;
        if (optionKey === '$$gangs') return gangsList;
        return [];
    };

    const isAyudante = currentUser && currentUser.rol === 'Ayudante';
    const canManageOrders = currentUser && !isAyudante; // Detectives and up can manage orders

    return (
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '2rem', minHeight: '100vh', boxSizing: 'border-box' }}>
            
            {/* --- HEADER --- */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: '2.5rem', marginBottom: '0.5rem', background: 'linear-gradient(90deg, #fff, #aaa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        JUDICIAL ORDERS
                    </h1>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '1rem', letterSpacing: '0.5px' }}>
                        DETECTIVE BUREAU • ARCHIVO Y GESTIÓN
                    </div>
                </div>
                
                {!isAyudante && (
                    <button 
                        className="login-button" 
                        style={{ padding: '0.8rem 1.5rem', width: 'auto', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 15px rgba(212,175,55,0.2)' }} 
                        onClick={() => setShowCreateModal(true)}
                    >
                        <span style={{ fontSize: '1.2rem' }}>+</span> 
                        GENERAR ORDEN
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '3rem' }}>
                
                {/* --- SIDEBAR --- */}
                <div>
                    <div style={{ 
                        background: 'rgba(20, 20, 25, 0.6)', 
                        backdropFilter: 'blur(10px)', 
                        border: '1px solid rgba(255,255,255,0.05)', 
                        borderRadius: '16px', 
                        padding: '1.5rem 0',
                        position: 'sticky',
                        top: '2rem',
                        boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ padding: '0 1.5rem 1rem 1.5rem', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px' }}>
                            FILTRAR POR TIPO
                        </div>
                        
                        <CategoryItem 
                            active={filterCategory === 'Todas'} 
                            onClick={() => setFilterCategory('Todas')} 
                        />
                        
                        {Object.entries(ORDER_TYPES).map(([type, config]) => (
                            <CategoryItem 
                                key={type} 
                                type={type} 
                                config={config} 
                                active={filterCategory === type} 
                                onClick={() => setFilterCategory(type)} 
                            />
                        ))}
                    </div>
                </div>

                {/* --- CONTENT GRID --- */}
                <div>
                     {loading ? (
                        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                            <div className="loading-spinner"></div>
                        </div>
                    ) : orders.length === 0 ? (
                        <div style={{ 
                            background: 'rgba(255,255,255,0.02)', 
                            border: '2px dashed rgba(255,255,255,0.1)', 
                            borderRadius: '16px', 
                            height: '300px', 
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                            color: 'var(--text-secondary)' 
                        }}>
                            <span style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.5 }}>📂</span>
                            No se encontraron ordenes en esta categoría.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                            {orders.map(order => (
                                <OrderCard 
                                    key={order.id} 
                                    order={order} 
                                    onPreview={openPreview} 
                                />
                            ))}
                        </div>
                    )}
                </div>

            </div>

            {/* --- CREATE MODAL --- */}
            {showCreateModal && (
                <div className="cropper-modal-overlay" style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.7)', zIndex: 9000 }}>
                    <div className="cropper-modal-content" style={{ 
                        maxWidth: '800px', 
                        padding: '0', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        background: '#151515',
                        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
                    }}>
                        {/* Modal Header */}
                        <div style={{ padding: '2rem', background: 'linear-gradient(180deg, rgba(30,30,30,1) 0%, rgba(20,20,20,1) 100%)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>Generar Nueva Orden</h2>
                            <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>Complete los campos requeridos para archivar la orden judicial.</p>
                        </div>
                        
                        <div style={{ padding: '2rem', maxHeight: '70vh', overflowY: 'auto' }}>
                            {/* Type Selector */}
                            <div style={{ marginBottom: '2rem' }}>
                                <label className="form-label" style={{ color: 'var(--accent-gold)' }}>TIPO DE ORDEN</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                                    {Object.entries(ORDER_TYPES).map(([key, config]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => { setSelectedType(key); setFormData({}); }}
                                            style={{
                                                background: selectedType === key ? `${config.color}22` : 'rgba(255,255,255,0.05)',
                                                border: selectedType === key ? `1px solid ${config.color}` : '1px solid transparent',
                                                color: selectedType === key ? config.color : 'var(--text-secondary)',
                                                padding: '10px',
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ fontSize: '1.2rem', marginBottom: '5px' }}>{config.icon}</div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{config.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <form onSubmit={handleCreate}>
                                <div style={{ display: 'grid', gap: '1.2rem' }}>
                                    {ORDER_TYPES[selectedType].fields.map(field => {
                                        // Handle Date Field as Readonly
                                        if (field.type === 'readonly_date') {
                                           return (
                                               <div key={field.name} className="form-group">
                                                   <label className="form-label">{field.label}</label>
                                                   <input type="text" className="form-input" disabled value={new Date().toLocaleDateString()} style={{ opacity: 0.6, cursor: 'not-allowed', background: 'rgba(255,255,255,0.05)' }} />
                                               </div>
                                           );
                                        }

                                        // Render Vehicle Repeater
                                        if (field.type === 'vehicle_repeater') {
                                            const currentVehicles = formData[field.name] || [];
                                            return (
                                                <div key={field.name} className="form-group">
                                                    <label className="form-label">{field.label}</label>
                                                    
                                                    {/* Input Row for Adding Vehicle */}
                                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                                                        <div style={{ display: 'grid', gap: '0.8rem' }}>
                                                            {field.subFields.map(sf => (
                                                                <div key={sf.name}>
                                                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>{sf.label}</label>
                                                                    <input
                                                                        type="text"
                                                                        className="form-input"
                                                                        placeholder={sf.placeholder}
                                                                        value={tempVehicle[sf.name] || ''}
                                                                        onChange={(e) => setTempVehicle(prev => ({ ...prev, [sf.name]: e.target.value }))}
                                                                        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddVehicle(field)}
                                                            style={{ marginTop: '0.8rem', padding: '0.5rem 1rem', background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                                        >
                                                            + Añadir Vehículo
                                                        </button>
                                                    </div>

                                                    {/* List of Added Vehicles */}
                                                    {currentVehicles.length > 0 && (
                                                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1rem' }}>
                                                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--accent-gold)' }}>
                                                                Vehículos Añadidos ({currentVehicles.length})
                                                            </div>
                                                            {currentVehicles.map((v, idx) => (
                                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', marginBottom: '0.5rem' }}>
                                                                    <div style={{ fontSize: '0.85rem' }}>
                                                                        <strong>{v.plate}</strong> - {v.model} <span style={{ color: 'var(--text-secondary)' }}>({v.owner})</span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveVehicle(field.name, idx)}
                                                                        style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        // Render Property Repeater
                                        if (field.type === 'property_repeater') {
                                            const currentProperties = formData[field.name] || [];
                                            return (
                                                <div key={field.name} className="form-group">
                                                    <label className="form-label">{field.label}</label>
                                                    
                                                    {/* Input Row for Adding Property */}
                                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                                                        <div style={{ display: 'grid', gap: '0.8rem' }}>
                                                            {field.subFields.map(sf => (
                                                                <div key={sf.name}>
                                                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>{sf.label}</label>
                                                                    <input
                                                                        type="text"
                                                                        className="form-input"
                                                                        placeholder={sf.placeholder}
                                                                        value={tempProperty[sf.name] || ''}
                                                                        onChange={(e) => setTempProperty(prev => ({ ...prev, [sf.name]: e.target.value }))}
                                                                        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddProperty(field)}
                                                            style={{ marginTop: '0.8rem', padding: '0.5rem 1rem', background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                                        >
                                                            + Añadir Propiedad
                                                        </button>
                                                    </div>

                                                    {/* List of Added Properties */}
                                                    {currentProperties.length > 0 && (
                                                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1rem' }}>
                                                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--accent-gold)' }}>
                                                                Propiedades Añadidas ({currentProperties.length})
                                                            </div>
                                                            {currentProperties.map((p, idx) => (
                                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', marginBottom: '0.5rem' }}>
                                                                    <div style={{ fontSize: '0.85rem' }}>
                                                                        <strong>{p.address}</strong> <span style={{ color: 'var(--text-secondary)' }}>({p.owner})</span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveProperty(field.name, idx)}
                                                                        style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        // Render Person Repeater
                                        if (field.type === 'person_repeater') {
                                            const currentPeople = formData[field.name] || [];
                                            return (
                                                <div key={field.name} className="form-group">
                                                    <label className="form-label">{field.label}</label>
                                                    
                                                    {/* Input Row for Adding Person */}
                                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                                                        <div style={{ display: 'grid', gap: '0.8rem' }}>
                                                            {field.subFields.map(sf => (
                                                                <div key={sf.name}>
                                                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>{sf.label}</label>
                                                                    <input
                                                                        type="text"
                                                                        className="form-input"
                                                                        placeholder={sf.placeholder}
                                                                        value={tempPerson[sf.name] || ''}
                                                                        onChange={(e) => setTempPerson(prev => ({ ...prev, [sf.name]: e.target.value }))}
                                                                        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddPerson(field)}
                                                            style={{ marginTop: '0.8rem', padding: '0.5rem 1rem', background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                                        >
                                                            + Añadir Persona
                                                        </button>
                                                    </div>

                                                    {/* List of Added People */}
                                                    {currentPeople.length > 0 && (
                                                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1rem' }}>
                                                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--accent-gold)' }}>
                                                                Personas Añadidas ({currentPeople.length})
                                                            </div>
                                                            {currentPeople.map((p, idx) => (
                                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', marginBottom: '0.5rem' }}>
                                                                    <div style={{ fontSize: '0.85rem' }}>
                                                                        <strong>{p.name}</strong> <span style={{ color: 'var(--text-secondary)' }}>(ID: {p.id})</span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemovePerson(field.name, idx)}
                                                                        style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        // Render Select Fields
                                        if (field.type === 'select') {
                                            const opts = getOptions(field.options);
                                            return (
                                                <div key={field.name} className="form-group">
                                                    <label className="form-label">{field.label}</label>
                                                    <select
                                                        className="form-input custom-select"
                                                        required={!field.optional}
                                                        value={formData[field.name] || ''}
                                                        onChange={e => handleInputChange(field.name, e.target.value)}
                                                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                    >
                                                        <option value="">-- Seleccionar --</option>
                                                        {opts.map((opt, idx) => (
                                                             <option key={idx} value={typeof opt === 'string' ? opt : opt.value}>
                                                                 {typeof opt === 'string' ? opt : opt.label}
                                                             </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            );
                                        }

                                        // Default Text/Textarea
                                        return (
                                            <div key={field.name} className="form-group">
                                                <label className="form-label">{field.label}</label>
                                                {field.type === 'textarea' ? (
                                                    <textarea 
                                                        className="eval-textarea" 
                                                        rows="3" 
                                                        required={!field.optional}
                                                        value={formData[field.name] || ''}
                                                        onChange={e => handleInputChange(field.name, e.target.value)}
                                                        placeholder={field.placeholder}
                                                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                    />
                                                ) : (
                                                    <input 
                                                        type={field.type} 
                                                        className="form-input" 
                                                        required={!field.optional} 
                                                        value={formData[field.name] || ''}
                                                        onChange={e => handleInputChange(field.name, e.target.value)}
                                                        placeholder={field.placeholder}
                                                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="cropper-actions" style={{ justifyContent: 'flex-end', marginTop: '2.5rem', gap: '1rem' }}>
                                    <button type="button" className="login-button btn-secondary" onClick={() => setShowCreateModal(false)} style={{ width: 'auto', padding: '0.8rem 1.5rem' }}>Cancelar</button>
                                    <button type="submit" className="login-button" disabled={submitting} style={{ width: 'auto', padding: '0.8rem 2rem' }}>
                                        {submitting ? 'Procesando...' : 'Archivar Orden'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Preview Modal */}
            <PreviewModal 
                order={previewOrder} 
                isOpen={showPreview} 
                onClose={() => setShowPreview(false)}
                canManage={canManageOrders}
                onUpdateStatus={handleStatusUpdate}
                onDelete={handleDelete}
            />
        </div>
    );
};

export default OrderArchive;
