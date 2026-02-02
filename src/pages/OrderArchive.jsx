import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import '../index.css';

// Form Fields Configuration
const ORDER_TYPES = {
    'Orden de Registro': {
        label: 'Search Warrant (Registro)',
        fields: [
            { name: 'target_address', label: 'Target Address / Location', type: 'text' },
            { name: 'property_owner', label: 'Property Owner (if known)', type: 'text' },
            { name: 'expected_evidence', label: 'Expected Evidence to Seize', type: 'textarea' },
            { name: 'probable_cause', label: 'Probable Cause', type: 'textarea' }
        ]
    },
    'Orden de Arresto': {
        label: 'Arrest Warrant (Arresto)',
        fields: [
            { name: 'suspect_name', label: 'Suspect Name', type: 'text' },
            { name: 'charges', label: 'Charges / Crimes', type: 'textarea' },
            { name: 'risk_level', label: 'Risk Level', type: 'select', options: ['Low', 'Medium', 'High', 'Extreme'] },
            { name: 'last_known_location', label: 'Last Known Location', type: 'text' }
        ]
    },
    'Orden de Revision Telefonica': {
        label: 'Phone Surveillance (Revisión Telefónica)',
        fields: [
            { name: 'target_number', label: 'Target Phone Number', type: 'text' },
            { name: 'target_owner', label: 'Owner Name', type: 'text' },
            { name: 'duration_days', label: 'Duration (Days)', type: 'number' },
            { name: 'justification', label: 'Investigative Justification', type: 'textarea' }
        ]
    },
    'Orden de Revision Bancaria': {
        label: 'Bank Records (Revisión Bancaria)',
        fields: [
            { name: 'target_account', label: 'Account Number / Bank', type: 'text' },
            { name: 'target_owner', label: 'Account Holder Name', type: 'text' },
            { name: 'timeframe', label: 'Timeframe to Review', type: 'text', placeholder: 'e.g. Last 3 months' },
            { name: 'justification', label: 'Financial Justification', type: 'textarea' }
        ]
    },
    'Orden de Decomiso': {
        label: 'Seizure Order (Decomiso)',
        fields: [
            { name: 'target_items', label: 'Items to Seize', type: 'textarea' },
            { name: 'owner_name', label: 'Owner Name', type: 'text' },
            { name: 'location', label: 'Location of Items', type: 'text' },
            { name: 'reason', label: 'Reason for Seizure', type: 'textarea' }
        ]
    },
    'Orden de Alejamiento': {
        label: 'Restraining Order (Alejamiento)',
        fields: [
            { name: 'restricted_person', label: 'Restricted Person (Who must stay away)', type: 'text' },
            { name: 'protected_person', label: 'Protected Person', type: 'text' },
            { name: 'distance_meters', label: 'Distance (Meters)', type: 'number' },
            { name: 'details', label: 'Additional Details', type: 'textarea' }
        ]
    },
    'Orden de Precinto': {
        label: 'Sealing Order (Precinto)',
        fields: [
            { name: 'property_address', label: 'Property/Business to Seal', type: 'text' },
            { name: 'owner_name', label: 'Owner Name', type: 'text' },
            { name: 'duration', label: 'Duration / Until', type: 'text' },
            { name: 'reason', label: 'Reason for Sealing', type: 'textarea' }
        ]
    }
};

function OrderArchive() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterCategory, setFilterCategory] = useState('Todas');
    const [showCreateModal, setShowCreateModal] = useState(false);
    
    // User Permissions
    const [currentUser, setCurrentUser] = useState(null);

    // Form State
    const [selectedType, setSelectedType] = useState('Orden de Registro');
    const [formData, setFormData] = useState({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadUserAndOrders();
    }, [filterCategory]);

    const loadUserAndOrders = async () => {
        setLoading(true);
        // Load User
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
            setCurrentUser(data);
        }

        // Load Orders
        const { data: oData, error } = await supabase.rpc('get_judicial_orders', { p_type_filter: filterCategory });
        if (error) console.error(error);
        else setOrders(oData || []);
        
        setLoading(false);
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        
        // Construct Title automatically based on Type + Key Field
        const config = ORDER_TYPES[selectedType];
        
        // Find a "primary" field for the title
        let primaryValue = 'Unknown';
        if (selectedType === 'Orden de Registro') primaryValue = formData.target_address;
        else if (selectedType === 'Orden de Arresto') primaryValue = formData.suspect_name;
        else if (selectedType.includes('Telefonica')) primaryValue = formData.target_number;
        else if (selectedType.includes('Bancaria')) primaryValue = formData.target_owner;
        else if (selectedType.includes('Alejamiento')) primaryValue = `${formData.restricted_person} -> ${formData.protected_person}`;
        else if (selectedType.includes('Precinto')) primaryValue = formData.property_address;
        else if (formData.target_items) primaryValue = formData.target_items.slice(0, 20); // Decomiso
        else primaryValue = Object.values(formData)[0] || 'Order';

        const autoTitle = `${selectedType} - ${primaryValue}`;

        try {
            const { error } = await supabase.rpc('create_judicial_order', {
                p_type: selectedType,
                p_title: autoTitle,
                p_content: formData
            });

            if (error) throw error;

            setShowCreateModal(false);
            setFormData({});
            loadUserAndOrders();
        } catch (err) {
            alert('Error creating order: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const isAyudante = currentUser && currentUser.rol === 'Ayudante';

    return (
        <div className="documentation-container" style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
            <div className="doc-header" style={{ marginBottom: '2rem' }}>
                <h2 className="page-title">ARCHIVO DE ORDENES JUDICIALES</h2>
                {!isAyudante && (
                    <button className="login-button" style={{ width: 'auto' }} onClick={() => setShowCreateModal(true)}>
                        + Generar Orden
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>
                {/* Sidebar Categories */}
                <div className="category-sidebar" style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', height: 'fit-content' }}>
                   <h4 style={{ marginTop: 0, color: 'var(--accent-gold)', borderBottom: '1px solid currentColor', paddingBottom: '0.5rem' }}>CATEGORIAS</h4>
                   <div 
                        className={`doc-category-item ${filterCategory === 'Todas' ? 'active' : ''}`}
                        onClick={() => setFilterCategory('Todas')}
                    >
                        Todas las Ordenes
                   </div>
                   {Object.keys(ORDER_TYPES).map(type => (
                       <div 
                            key={type}
                            className={`doc-category-item ${filterCategory === type ? 'active' : ''}`}
                            onClick={() => setFilterCategory(type)}
                            style={{ fontSize: '0.9rem' }}
                        >
                            {type}
                       </div>
                   ))}
                </div>

                {/* Orders Grid */}
                <div>
                   <h3 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                       {filterCategory === 'Todas' ? 'Todas las Ordenes' : filterCategory}
                       <span style={{ fontSize: '0.8rem', marginLeft: '1rem', opacity: 0.7 }}>({orders.length})</span>
                   </h3>

                    {loading ? (
                        <div className="loading-container">Cargando Archivo...</div>
                    ) : orders.length === 0 ? (
                        <div className="empty-list">No hay ordenes archivadas en esta categoría.</div>
                    ) : (
                        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            {orders.map(order => (
                                <div key={order.id} className="announcement-card" style={{
                                    borderLeft: '4px solid var(--accent-gold)',
                                    display: 'flex', flexDirection: 'column'
                                }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                                        {order.order_type}
                                    </div>
                                    <h4 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                                        {order.title}
                                    </h4>

                                    {/* Content Preview - Render key fields cleanly */}
                                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.8rem', borderRadius: '4px', marginBottom: '1rem', flex: 1, fontSize: '0.9rem' }}>
                                        {Object.entries(order.content).map(([key, val]) => {
                                            if (!val) return null;
                                            // Find label
                                            const typeConfig = ORDER_TYPES[order.order_type];
                                            const fieldConfig = typeConfig?.fields.find(f => f.name === key);
                                            const label = fieldConfig ? fieldConfig.label : key;
                                            return (
                                                <div key={key} style={{ marginBottom: '0.5rem' }}>
                                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>{label}:</span> <br/>
                                                    <span style={{ color: '#ddd' }}>{val}</span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 'auto', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                        <img src={order.author_avatar || '/anon.png'} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '10px' }} />
                                        <div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{order.author_rank} {order.author_name}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{new Date(order.created_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="cropper-modal-overlay">
                    <div className="cropper-modal-content" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 className="section-title">Generar Nueva Orden</h3>
                        
                        {/* Type Selector */}
                        <div className="form-group" style={{ marginBottom: '2rem' }}>
                            <label className="form-label" style={{ color: 'var(--accent-gold)' }}>Seleccionar Tipo de Orden</label>
                            <select 
                                className="form-input custom-select" 
                                value={selectedType} 
                                onChange={e => {
                                    setSelectedType(e.target.value);
                                    setFormData({}); // Clear form on type change
                                }}
                                style={{ fontSize: '1.1rem', padding: '0.8rem' }}
                            >
                                {Object.entries(ORDER_TYPES).map(([key, config]) => (
                                    <option key={key} value={key}>{config.label}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <h4 style={{ marginTop: 0, marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                                Datos de la Orden
                            </h4>
                            <form onSubmit={handleCreate}>
                                {ORDER_TYPES[selectedType].fields.map(field => (
                                    <div key={field.name} className="form-group">
                                        <label className="form-label">{field.label}</label>
                                        {field.type === 'textarea' ? (
                                            <textarea 
                                                className="eval-textarea" 
                                                rows="3" 
                                                required 
                                                value={formData[field.name] || ''}
                                                onChange={e => handleInputChange(field.name, e.target.value)}
                                            />
                                        ) : field.type === 'select' ? (
                                            <select
                                                className="form-input custom-select"
                                                required
                                                value={formData[field.name] || ''}
                                                onChange={e => handleInputChange(field.name, e.target.value)}
                                            >
                                                <option value="">-- Seleccionar --</option>
                                                {field.options.map(opt => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input 
                                                type={field.type} 
                                                className="form-input" 
                                                required 
                                                value={formData[field.name] || ''}
                                                onChange={e => handleInputChange(field.name, e.target.value)}
                                                placeholder={field.placeholder || ''}
                                            />
                                        )}
                                    </div>
                                ))}

                                <div className="cropper-actions" style={{ justifyContent: 'flex-end', marginTop: '2rem' }}>
                                    <button type="button" className="login-button btn-secondary" onClick={() => setShowCreateModal(false)} style={{ width: 'auto' }}>Cancelar</button>
                                    <button type="submit" className="login-button" disabled={submitting} style={{ width: 'auto' }}>
                                        {submitting ? 'Guardando...' : 'Generar y Archivar'}
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
