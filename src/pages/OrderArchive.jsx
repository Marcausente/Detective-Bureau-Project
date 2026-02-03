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
            { name: 'author_agent', label: 'Agente Solicitante', type: 'select', options: '$$agents' },
            { name: 'request_date', label: 'Fecha Solicitud', type: 'readonly_date' },
            { name: 'property_owner', label: 'Propietario de la Vivienda', type: 'text' },
            { name: 'target_address', label: 'Ubicación de la Vivienda', type: 'text', placeholder: '[12 Strawberry Avenue, Los Santos, San Andreas]' },
            { name: 'probable_cause', label: 'Motivo de la Orden', type: 'textarea' },
            { name: 'linked_case_id', label: 'Vincular Caso (Opcional)', type: 'select', options: '$$cases', optional: true },
            { name: 'linked_gang_id', label: 'Vincular Banda (Opcional)', type: 'select', options: '$$gangs', optional: true }
        ]
    },
    'Orden de Registro (Coche)': {
        label: 'Orden de Registro (Coche)',
        color: '#0ea5e9', // Sky Blue
        icon: '🚗',
        fields: [
            { name: 'vehicle_model', label: 'Modelo del Vehículo', type: 'text', placeholder: 'ej. Ubermacht Oracle' },
            { name: 'plate_number', label: 'Matrícula', type: 'text', placeholder: 'ej. 44ASD123' },
            { name: 'vehicle_owner', label: 'Propietario del Vehículo', type: 'text' },
            { name: 'expected_evidence', label: 'Evidencia Esperada', type: 'textarea' },
            { name: 'probable_cause', label: 'Causa Probable', type: 'textarea' }
        ]
    },
    'Orden de Arresto': {
        label: 'Orden de Arresto',
        color: '#ef4444', // Red
        icon: '👮',
        fields: [
            { name: 'suspect_name', label: 'Nombre del Sospechoso', type: 'text' },
            { name: 'charges', label: 'Cargos / Delitos', type: 'textarea' },
            { name: 'risk_level', label: 'Nivel de Riesgo', type: 'select', options: ['Bajo', 'Medio', 'Alto', 'Extremo'] },
            { name: 'last_known_location', label: 'Última Ubicación Conocida', type: 'text' }
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

const OrderCard = ({ order }) => {
    const config = ORDER_TYPES[order.order_type];
    const color = config?.color || '#999';
    const icon = config?.icon || '📄';
    
    const renderContent = () => {
        return Object.entries(order.content).slice(0, 3).map(([key, val]) => {
            if (!val) return null;
            const field = config?.fields.find(f => f.name === key);
            // Hide IDs if they are select values (optional improvement, for now showing ID or Value is fine, but labels are better)
            // Ideally we'd map ID to Name, but for simplicity showing value.
            return (
                <div key={key} style={{ marginBottom: '4px', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>{field?.label || key}:</span>
                    <span style={{ color: '#eee' }}>{val.length > 50 ? val.substring(0, 50) + '...' : val}</span>
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
                    <span style={{ fontSize: '0.8rem', color: color, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {order.order_type}
                    </span>
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
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        // Import dynamically to avoid top-level issues if any, or just call imported function
                        import('../utils/orderPdfGenerator').then(mod => mod.generateOrderPDF(order, config));
                    }}
                    style={{ 
                        marginLeft: 'auto', 
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
                    <span>📄</span> PDF
                </button>
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

    // Dynamic Lists
    const [agentsList, setAgentsList] = useState([]);
    const [casesList, setCasesList] = useState([]);
    const [gangsList, setGangsList] = useState([]);

    // Form State
    const [selectedType, setSelectedType] = useState('Orden de Registro (Casa)');
    const [formData, setFormData] = useState({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterCategory]);

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
        if (error) console.error(error);
        else setOrders(oData || []);
        
        setLoading(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        
        // Auto-Title Logic
        const config = ORDER_TYPES[selectedType];
        
        let primaryValue = 'Sin Titulo';
        // Priority checks
        if (formData.target_address) primaryValue = formData.target_address;
        else if (formData.plate_number) primaryValue = `${formData.plate_number} (${formData.vehicle_model || ''})`;
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

    // Helper to get options for a field
    const getOptions = (optionKey) => {
        if (Array.isArray(optionKey)) return optionKey;
        if (optionKey === '$$agents') return agentsList;
        if (optionKey === '$$cases') return casesList;
        if (optionKey === '$$gangs') return gangsList;
        return [];
    };

    const isAyudante = currentUser && currentUser.rol === 'Ayudante';

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
                                <OrderCard key={order.id} order={order} />
                            ))}
                        </div>
                    )}
                </div>

            </div>

            {/* --- MODAL --- */}
            {showCreateModal && (
                <div className="cropper-modal-overlay" style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.7)' }}>
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
        </div>
    );
}

export default OrderArchive;
