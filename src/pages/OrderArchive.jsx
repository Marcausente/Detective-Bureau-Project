import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { getProfileImage } from '../utils/imageStorage';
import '../index.css';

// SVG Icon Helper for Order Types
const renderOrderTypeIcon = (type, size = 16) => {
    switch (type) {
        case 'Orden de Registro (Casa)':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
            );
        case 'Orden de Registro (Coche)':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
            );
        case 'Orden de Arresto':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                </svg>
            );
        case 'Orden de Revision Telefonica':
        case 'Orden de Identificacion Telefono Movil':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                    <line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
            );
        case 'Orden de Revision Bancaria':
        case 'Inmovilizacion de Cuenta':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                    <line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
            );
        case 'Orden de Identificacion Red Social':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
            );
        case 'Orden de Decomiso':
        case 'Embargo de Vehiculo':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
            );
        case 'Orden de Alejamiento':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
            );
        case 'Orden de Precinto':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
            );
        case 'Ley Rico':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
                    <path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/>
                    <path d="M7 21h10"/>
                    <path d="M12 3v18"/>
                    <path d="M3 7h18"/>
                </svg>
            );
        case 'Revision de Camaras':
        case 'Solicitud Camaras de Seguridad':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m22 8-6 4 6 4V8z"/>
                    <rect x="2" y="6" width="14" height="12" rx="2" ry="2"/>
                </svg>
            );
        case 'Solicitud de informacion medica':
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
            );
        default:
            return (
                <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
            );
    }
};

// --- CONFIGURATION ---
const ORDER_TYPES = {
    'Orden de Registro (Casa)': {
        label: 'Orden de Registro (Casa)',
        color: 'var(--color-blue, #3b82f6)',
        fields: [
            { name: 'request_date', label: 'Fecha Solicitud', type: 'readonly_date' },
            { 
                name: 'target_properties', 
                label: 'Propiedades a Registrar', 
                type: 'property_repeater', 
                subFields: [
                    { name: 'owner', label: 'Propietario', placeholder: 'Nombre Apellido' },
                    { name: 'id', label: 'ID de la Persona', placeholder: 'ej. 12345' },
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
        color: '#0ea5e9',
        fields: [
            { 
                name: 'target_vehicles', 
                label: 'Vehículos a Registrar', 
                type: 'vehicle_repeater', 
                subFields: [
                    { name: 'owner', label: 'Propietario', placeholder: 'Nombre Apellido' },
                    { name: 'id', label: 'ID de la Persona', placeholder: 'ej. 12345' },
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
        color: '#ef4444',
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
        color: '#8b5cf6',
        fields: [
            { 
                name: 'target_persons_phone_review', 
                label: 'Personas a Revisar', 
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
    'Orden de Revision Bancaria': {
        label: 'Revisión Bancaria',
        color: '#10b981',
        fields: [
            { 
                name: 'target_persons', 
                label: 'Personas a Revisar', 
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
    'Orden de Identificacion Red Social': {
        label: 'Identificación Red Social',
        color: '#a855f7',
        fields: [
            { 
                name: 'target_social_accounts', 
                label: 'Cuentas a Identificar', 
                type: 'social_media_repeater', 
                subFields: [
                    { name: 'username', label: 'Usuario', placeholder: 'ej. @usuario123' },
                    { name: 'social_network', label: 'Red Social', placeholder: 'ej. Lifeinvader, Bleeter' }
                ]
            },
            { name: 'warrant_reason', label: 'Motivo de la Orden', type: 'textarea' },
            { name: 'linked_case_id', label: 'Vincular Caso (Opcional)', documentLabel: 'Caso Vinculado', type: 'select', options: '$$cases', optional: true },
            { name: 'linked_gang_id', label: 'Vincular Banda (Opcional)', documentLabel: 'Banda Vinculada', type: 'select', options: '$$gangs', optional: true }
        ]
    },
    'Orden de Identificacion Telefono Movil': {
        label: 'Identificación Teléfono Móvil',
        color: '#38bdf8',
        fields: [
            { 
                name: 'target_phone_numbers', 
                label: 'Números de Teléfono a Identificar', 
                type: 'phone_repeater', 
                subFields: [
                    { name: 'number', label: 'Número de Teléfono', placeholder: 'ej. 555-1234' }
                ]
            },
            { name: 'warrant_reason', label: 'Motivo de la Orden', type: 'textarea' },
            { name: 'linked_case_id', label: 'Vincular Caso (Opcional)', documentLabel: 'Caso Vinculado', type: 'select', options: '$$cases', optional: true },
            { name: 'linked_gang_id', label: 'Vincular Banda (Opcional)', documentLabel: 'Banda Vinculada', type: 'select', options: '$$gangs', optional: true }
        ]
    },
    'Orden de Decomiso': {
        label: 'Orden de Decomiso',
        color: '#f59e0b',
        fields: [
            { 
                name: 'seizure_vehicles', 
                label: 'Vehículos a Decomisar', 
                type: 'vehicle_seizure_repeater', 
                subFields: [
                    { name: 'owner_name', label: 'Nombre de la Persona', placeholder: 'Nombre Apellido' },
                    { name: 'owner_id', label: 'ID de la Persona', placeholder: 'ej. 12345' },
                    { name: 'vehicle', label: 'Vehículo a Decomisar', placeholder: 'ej. Sultan RS' },
                    { name: 'plate', label: 'Patente del Vehículo', placeholder: 'ej. ABC123' }
                ]
            },
            { name: 'warrant_reason', label: 'Motivo de la Orden', type: 'textarea' },
            { name: 'linked_case_id', label: 'Vincular Caso (Opcional)', documentLabel: 'Caso Vinculado', type: 'select', options: '$$cases', optional: true },
            { name: 'linked_gang_id', label: 'Vincular Banda (Opcional)', documentLabel: 'Banda Vinculada', type: 'select', options: '$$gangs', optional: true }
        ]
    },
    'Orden de Alejamiento': {
        label: 'Orden de Alejamiento',
        color: '#ec4899',
        fields: [
            { 
                name: 'protected_persons', 
                label: 'Personas Protegidas', 
                type: 'person_repeater', 
                subFields: [
                    { name: 'name', label: 'Nombre de la Persona Protegida', placeholder: 'Nombre Apellido' },
                    { name: 'id', label: 'ID de la Persona Protegida', placeholder: 'ej. 12345' }
                ]
            },
            { 
                name: 'restricted_persons', 
                label: 'Personas Restringidas', 
                type: 'person_repeater', 
                subFields: [
                    { name: 'name', label: 'Nombre de la Persona Restringida', placeholder: 'Nombre Apellido' },
                    { name: 'id', label: 'ID de la Persona Restringida', placeholder: 'ej. 12345' }
                ]
            },
            { name: 'distance_meters', label: 'Distancia Mínima (Metros)', type: 'number', placeholder: 'ej. 100' },
            { name: 'additional_details', label: 'Detalles Adicionales', type: 'textarea', optional: true },
            { name: 'warrant_reason', label: 'Motivo de la Solicitud', type: 'textarea' },
            { name: 'linked_case_id', label: 'Vincular Caso (Opcional)', documentLabel: 'Caso Vinculado', type: 'select', options: '$$cases', optional: true },
            { name: 'linked_gang_id', label: 'Vincular Banda (Opcional)', documentLabel: 'Banda Vinculada', type: 'select', options: '$$gangs', optional: true }
        ]
    },
    'Orden de Precinto': {
        label: 'Orden de Precinto',
        color: '#6366f1',
        fields: [
            { 
                name: 'property_owners', 
                label: 'Propietarios', 
                type: 'person_repeater', 
                subFields: [
                    { name: 'name', label: 'Nombre del Propietario', placeholder: 'Nombre Apellido' },
                    { name: 'id', label: 'ID del Propietario', placeholder: 'ej. 12345' }
                ]
            },
            { name: 'business_name', label: 'Nombre del Local', type: 'text', placeholder: 'ej. Tienda XYZ' },
            { name: 'business_location', label: 'Ubicación del Local', type: 'text', placeholder: 'ej. Calle Principal 123' },
            { name: 'warrant_reason', label: 'Motivo de la Solicitud', type: 'textarea' },
            { name: 'linked_case_id', label: 'Vincular Caso (Opcional)', documentLabel: 'Caso Vinculado', type: 'select', options: '$$cases', optional: true },
            { name: 'linked_gang_id', label: 'Vincular Banda (Opcional)', documentLabel: 'Banda Vinculada', type: 'select', options: '$$gangs', optional: true }
        ]
    },
    'Ley Rico': {
        label: 'Ley Rico',
        color: '#dc2626',
        fields: [
            { 
                name: 'target_persons_rico', 
                label: 'Personas Objetivo', 
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
    'Revision de Camaras': {
        label: 'Revisión de Cámaras',
        color: '#0ea5e9',
        fields: [
            { name: 'camera_location', label: 'Ubicación de la Cámara', type: 'text', placeholder: 'ej. Calle Principal esquina con Avenida Central' },
            { name: 'camera_owner', label: 'Propietario de la Cámara', type: 'text', placeholder: 'ej. Propietario del Comercio, del inmueble, ayuntamiento...' },
            { name: 'warrant_reason', label: 'Motivo de la Orden', type: 'textarea' },
            { name: 'linked_case_id', label: 'Vincular Caso (Opcional)', documentLabel: 'Caso Vinculado', type: 'select', options: '$$cases', optional: true },
            { name: 'linked_gang_id', label: 'Vincular Banda (Opcional)', documentLabel: 'Banda Vinculada', type: 'select', options: '$$gangs', optional: true }
        ]
    },
    'Solicitud de informacion medica': {
        label: 'Solicitud de Información Médica',
        color: '#06b6d4',
        fields: [
            { name: 'requested_department', label: 'Departamento al que se solicita', type: 'text', defaultValue: 'SAED' },
            { name: 'person_name', label: 'Nombre de la Persona', placeholder: 'Nombre Apellido', type: 'text' },
            { name: 'person_id', label: 'ID de la Persona', placeholder: 'ej. 12345', type: 'text' },
            { name: 'requested_document_type', label: 'Tipo de documento a solicitar', placeholder: 'ej. Historial clínico, autopsia, etc.', type: 'text' },
            { name: 'order_reason', label: 'Motivo de la Orden', type: 'textarea' },
            { name: 'linked_case_id', label: 'Vincular Caso (Opcional)', documentLabel: 'Caso Vinculado', type: 'select', options: '$$cases', optional: true },
            { name: 'linked_gang_id', label: 'Vincular Banda (Opcional)', documentLabel: 'Banda Vinculada', type: 'select', options: '$$gangs', optional: true }
        ]
    }
};

// --- COMPONENTS ---
const CategoryItem = ({ type, config, active, onClick }) => {
    const { isLSSD } = useTheme();
    const activeColor = isLSSD ? '#10b981' : 'var(--color-blue, #3b82f6)';

    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: '10px 14px',
                marginBottom: '6px',
                background: active ? `rgba(var(--color-blue-rgb, 59, 130, 246), 0.15)` : 'transparent',
                border: 'none',
                borderLeft: active ? `3px solid ${activeColor}` : '3px solid transparent',
                color: active ? activeColor : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s ease',
                borderRadius: '0 10px 10px 0',
                fontWeight: active ? '700' : '500',
                fontSize: '0.86rem',
                gap: '10px'
            }}
            className="category-hover"
        >
            <span style={{ display: 'flex', alignItems: 'center', color: active ? activeColor : 'var(--text-secondary)' }}>
                {config ? renderOrderTypeIcon(type, 16) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                    </svg>
                )}
            </span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {config ? config.label : 'Todas las Ordenes'}
            </span>
        </button>
    );
};

const OrderCard = ({ order, onPreview, onOpenExecutionModal }) => {
    const { isLSSD } = useTheme();
    const config = ORDER_TYPES[order.order_type];
    const cardAccentColor = config?.color || (isLSSD ? '#10b981' : '#3b82f6');
    
    // Status Badge Logic
    const getStatusColor = (s) => {
        if (s === 'Aprobada') return '#4ade80';
        if (s === 'Rechazada') return '#f87171';
        return '#fbbf24';
    };
    const statusColor = getStatusColor(order.status || 'Pendiente');

    const renderContent = () => {
        return Object.entries(order.content || {}).slice(0, 3).map(([key, val]) => {
            if (!val) return null;
            const field = config?.fields?.find(f => f.name === key);
            
            let displayValue = val;
            if (Array.isArray(val)) {
                if (val.length > 0) {
                    if (val[0].plate && val[0].model) displayValue = `${val.length} vehículo${val.length > 1 ? 's' : ''}`;
                    else if (val[0].plate && val[0].vehicle) displayValue = `${val.length} decomiso${val.length > 1 ? 's' : ''}`;
                    else if (val[0].address) displayValue = `${val.length} propiedad${val.length > 1 ? 'es' : ''}`;
                    else if (val[0].name && val[0].id) displayValue = `${val.length} persona${val.length > 1 ? 's' : ''}`;
                    else if (val[0].number) displayValue = `${val.length} teléfono${val.length > 1 ? 's' : ''}`;
                    else if (val[0].username) displayValue = `${val.length} cuenta${val.length > 1 ? 's' : ''}`;
                    else displayValue = `${val.length} item${val.length > 1 ? 's' : ''}`;
                }
            } else if (typeof val === 'object') {
                displayValue = JSON.stringify(val);
            } else {
                displayValue = String(val);
            }
            
            return (
                <div key={key} style={{ marginBottom: '4px', fontSize: '0.82rem', display: 'flex', gap: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{field?.label || key}:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {displayValue.length > 50 ? displayValue.substring(0, 50) + '...' : displayValue}
                    </span>
                </div>
            );
        });
    };

    return (
        <div style={{
            background: 'var(--glass-bg, rgba(15, 23, 42, 0.65))',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            padding: '1.25rem',
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%'
        }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: cardAccentColor }} />

            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                            background: `rgba(var(--color-blue-rgb, 59, 130, 246), 0.15)`, 
                            color: cardAccentColor, 
                            width: '34px',
                            height: '34px', 
                            borderRadius: '10px', 
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `1px solid ${cardAccentColor}33`
                        }}>
                            {renderOrderTypeIcon(order.order_type, 18)}
                        </div>
                        <div>
                            <span style={{ fontSize: '0.74rem', color: cardAccentColor, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                                {order.order_type}
                            </span>
                            <span style={{ 
                                fontSize: '0.68rem', 
                                background: `${statusColor}18`, 
                                color: statusColor, 
                                padding: '2px 8px', 
                                borderRadius: '12px',
                                border: `1px solid ${statusColor}44`,
                                marginTop: '3px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontWeight: 800
                            }}>
                                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusColor }}></span>
                                {order.status || 'Pendiente'}
                            </span>
                        </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        {new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                </div>

                <h3 style={{ margin: '0 0 0.85rem 0', fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 800, lineHeight: '1.35', letterSpacing: '-0.01em' }}>
                    {order.title.replace(order.order_type + ' - ', '')}
                </h3>

                <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '10px 12px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.04)' }}>
                    {renderContent()}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--glass-border, rgba(255,255,255,0.06))' }}>
                <img 
                    src={getProfileImage(order.author_avatar, '/logowebp/anon.webp')} 
                    alt="" 
                    style={{ width: '30px', height: '30px', borderRadius: '50%', marginRight: '8px', objectFit: 'cover', border: `1px solid ${cardAccentColor}44` }} 
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{order.author_rank} {order.author_name}</span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Detective Bureau</span>
                </div>
                
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px' }}>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onPreview(order);
                        }}
                        style={{ 
                            background: 'rgba(255,255,255,0.06)', 
                            border: '1px solid var(--glass-border, rgba(255,255,255,0.12))', 
                            color: 'var(--text-primary)', 
                            padding: '4px 7px', 
                            borderRadius: '7px', 
                            fontSize: '0.72rem', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontWeight: 600
                        }}
                        title="Ver Vista Previa del Expediente"
                        className="hover-bright"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        <span>Ver</span>
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            import('../utils/orderPdfGenerator').then(mod => mod.generateOrderPDF(order, config, isLSSD, 'solicitud'));
                        }}
                        style={{ 
                            background: 'rgba(255,255,255,0.06)', 
                            border: '1px solid var(--glass-border, rgba(255,255,255,0.12))', 
                            color: 'var(--text-secondary)', 
                            padding: '4px 7px', 
                            borderRadius: '7px', 
                            fontSize: '0.72rem', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontWeight: 600
                        }}
                        title="Exportar PDF de Solicitud Interna (Expediente Completo)"
                        className="hover-bright"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span>Solicitud</span>
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenExecutionModal(order);
                        }}
                        style={{ 
                            background: `rgba(var(--color-blue-rgb, 59, 130, 246), 0.18)`, 
                            border: `1px solid ${cardAccentColor}55`, 
                            color: cardAccentColor, 
                            padding: '4px 7px', 
                            borderRadius: '7px', 
                            fontSize: '0.72rem', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontWeight: 700
                        }}
                        title="Exportar Mandamiento / Orden de Ejecución (Para Entregar a la Persona)"
                        className="hover-bright"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        <span>Orden</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- PREVIEW MODAL ---
const PreviewModal = ({ order, isOpen, onClose, canManage, onUpdateStatus, onDelete, onOpenExecutionModal }) => {
    const { isLSSD } = useTheme();

    if (!isOpen || !order) return null;
    const config = ORDER_TYPES[order.order_type];
    const accentColor = isLSSD ? '#10b981' : 'var(--color-blue, #3b82f6)';

    // Helper to render fields nicely in the preview
    const fields = Object.entries(order.content || {})
        .filter(([key]) => key !== 'execution_details')
        .map(([key, val]) => {
            const fieldConfig = config?.fields?.find(f => f.name === key);
            return { key, label: fieldConfig?.documentLabel || fieldConfig?.label || key, value: val };
        });

    return (
        <div className="mac-modal-overlay" onClick={onClose}>
            <div className="mac-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', width: '92vw', height: '90vh', display: 'flex', flexDirection: 'column' }}>
                <div className="mac-modal-header">
                    <div className="mac-window-dots">
                        <div className="mac-window-dot close" onClick={onClose} title="Cerrar"></div>
                        <div className="mac-window-dot min"></div>
                        <div className="mac-window-dot max"></div>
                    </div>
                    <span className="mac-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                        <span>Vista Previa de Expediente Judicial</span>
                    </span>
                    <div style={{ width: 52 }} />
                </div>

                {/* Scrollable Paper Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '2.5rem', background: '#ffffff', color: '#0f172a' }}>
                    
                    {/* Document Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '2px solid #0f172a', paddingBottom: '1rem' }}>
                        <img src={isLSSD ? "/logowebp/SCUB.webp" : "/logowebp/dblogo.webp"} alt="DB" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1.15rem', color: '#0f172a', fontWeight: 800 }}>{isLSSD ? "Los Santos Sheriff's Department" : "Los Santos Police Department"}</h2>
                            <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '0.9rem', fontWeight: 700, color: '#475569' }}>{isLSSD ? "SHERIFF CRIMINAL UNIT BUREAU" : "DETECTIVE BUREAU"}</h3>
                        </div>
                        <img src={isLSSD ? "/logowebp/LSSDlogo.webp" : "/logowebp/LSSDlogo.webp"} alt="LSPD" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
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
                                                        <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>ID</th>
                                                        <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Modelo</th>
                                                        <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Matrícula</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {f.value.map((v, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                                            <td style={{ padding: '6px' }}>{v.owner}</td>
                                                            <td style={{ padding: '6px' }}>{v.id || '-'}</td>
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
                                                        <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>ID</th>
                                                        <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Dirección</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {f.value.map((p, idx) => (
                                                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                                            <td style={{ padding: '6px' }}>{p.owner}</td>
                                                            <td style={{ padding: '6px' }}>{p.id || '-'}</td>
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
                            
                            // Special handling for phone arrays (has number)
                            if (Array.isArray(f.value) && f.value.length > 0 && f.value[0].number) {
                                return (
                                    <div key={i}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#444', marginBottom: '8px' }}>{f.label}</div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid #ddd' }}>
                                                    <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Número de Teléfono</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {f.value.map((phone, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                                        <td style={{ padding: '6px' }}>{phone.number}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            }
                            
                            // Special handling for social media account arrays (has username and social_network)
                            if (Array.isArray(f.value) && f.value.length > 0 && f.value[0].username && f.value[0].social_network) {
                                return (
                                    <div key={i}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#444', marginBottom: '8px' }}>{f.label}</div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid #ddd' }}>
                                                    <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Usuario</th>
                                                    <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Red Social</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {f.value.map((acc, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                                        <td style={{ padding: '6px' }}>{acc.username}</td>
                                                        <td style={{ padding: '6px' }}>{acc.social_network}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            }
                            
                            // Special handling for seizure vehicle arrays (has owner_name, owner_id, vehicle, plate)
                            if (Array.isArray(f.value) && f.value.length > 0 && f.value[0].owner_name && f.value[0].vehicle && f.value[0].plate) {
                                return (
                                    <div key={i}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#444', marginBottom: '8px' }}>{f.label}</div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid #ddd' }}>
                                                    <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Propietario</th>
                                                    <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>ID</th>
                                                    <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Vehículo</th>
                                                    <th style={{ textAlign: 'left', padding: '6px', fontWeight: 'bold' }}>Patente</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {f.value.map((sz, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                                        <td style={{ padding: '6px' }}>{sz.owner_name}</td>
                                                        <td style={{ padding: '6px' }}>{sz.owner_id}</td>
                                                        <td style={{ padding: '6px' }}>{sz.vehicle}</td>
                                                        <td style={{ padding: '6px' }}>{sz.plate}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            }
                            
                            const renderVal = typeof f.value === 'object' && f.value !== null ? JSON.stringify(f.value) : String(f.value || '-');
                            return (
                                <div key={i}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#444', marginBottom: '4px' }}>{f.label}</div>
                                    <div style={{ fontSize: '1rem', lineHeight: '1.5', borderBottom: '1px dashed #ccc', paddingBottom: '4px' }}>{renderVal}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Saved Execution Details Section (If present) */}
                    {order.content?.execution_details && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.2rem', marginTop: '2rem' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', color: '#1e3a8a', marginBottom: '0.6rem', letterSpacing: '0.04em' }}>
                                📜 Disposiciones y Términos Adicionales de Ejecución Judicial (Impresos en Orden Entregable)
                            </div>
                            {order.content.execution_details.notes && (
                                <div style={{ marginBottom: '0.5rem', fontSize: '0.88rem', color: '#334155' }}>
                                    <strong style={{ color: '#0f172a' }}>Cláusulas Especiales:</strong> {order.content.execution_details.notes}
                                </div>
                            )}
                            {order.content.execution_details.instructions && (
                                <div style={{ marginBottom: '0.5rem', fontSize: '0.88rem', color: '#334155' }}>
                                    <strong style={{ color: '#0f172a' }}>Instrucciones de Notificación:</strong> {order.content.execution_details.instructions}
                                </div>
                            )}
                            {order.content.execution_details.validity && (
                                <div style={{ fontSize: '0.88rem', color: '#334155' }}>
                                    <strong style={{ color: '#0f172a' }}>Plazo de Vigencia:</strong> {order.content.execution_details.validity}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Signature Area */}
                    <div style={{ marginTop: '4rem', textAlign: 'right' }}>
                        <div style={{ 
                            fontFamily: "'Alex Brush', cursive", 
                            fontSize: '2rem', 
                            color: '#1e293b',
                            marginBottom: '0.2rem'
                        }}>{order.content.author_agent || order.author_name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{isLSSD ? "SCUB, LSSD" : "Detective Bureau, LSPD"}</div>
                    </div>

                </div>

                {/* Footer Controls */}
                <div style={{ padding: '0.85rem 1.35rem', background: 'rgba(0, 0, 0, 0.25)', borderTop: '1px solid var(--glass-border, rgba(255,255,255,0.08))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                     <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                        <button type="button" className="mac-btn mac-btn-secondary" onClick={onClose}>
                            Cerrar
                        </button>
                        <button 
                            type="button" 
                            className="mac-btn"
                            onClick={() => import('../utils/orderPdfGenerator').then(mod => mod.generateOrderPDF(order, config, isLSSD, 'solicitud'))}
                            style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)', border: '1px solid var(--glass-border, rgba(255,255,255,0.15))', display: 'flex', alignItems: 'center', gap: '5px' }}
                            title="Exportar Expediente de Solicitud Interna (PDF)"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <span>PDF Solicitud</span>
                        </button>
                        <button 
                            type="button" 
                            className="mac-btn"
                            onClick={() => {
                                onClose();
                                onOpenExecutionModal(order);
                            }}
                            style={{ background: isLSSD ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: isLSSD ? '#34d399' : '#60a5fa', border: `1px solid ${isLSSD ? '#10b981' : '#3b82f6'}55`, display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}
                            title="Exportar Mandamiento / Orden Judicial de Ejecución (Para Entregar al Ciudadano)"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            <span>PDF Orden Entregable</span>
                        </button>
                        {canManage && (
                             <button 
                                type="button" 
                                className="mac-btn"
                                onClick={() => onDelete(order.id)} 
                                style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)', padding: '0.45rem 0.85rem' }} 
                                title="Eliminar Orden"
                             >
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                     <polyline points="3 6 5 6 21 6"/>
                                     <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                 </svg>
                             </button>
                        )}
                     </div>
                     
                     {canManage && (
                         <div style={{ display: 'flex', gap: '0.6rem' }}>
                             {order.status !== 'Rechazada' && (
                                 <button 
                                     className="mac-btn"
                                     onClick={() => onUpdateStatus(order.id, 'Rechazada')}
                                     style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', fontWeight: 700 }}>
                                     Rechazar
                                 </button>
                             )}
                             {order.status !== 'Pendiente' && (
                                 <button 
                                     className="mac-btn"
                                     onClick={() => onUpdateStatus(order.id, 'Pendiente')}
                                     style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', fontWeight: 700 }}>
                                     Marcar Pendiente
                                 </button>
                             )}
                             {order.status !== 'Aprobada' && (
                                 <button 
                                     className="mac-btn"
                                     onClick={() => onUpdateStatus(order.id, 'Aprobada')}
                                     style={{ background: 'rgba(34, 197, 94, 0.2)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.4)', fontWeight: 700 }}>
                                     Aprobar Orden
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
    const { isLSSD } = useTheme();

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
    
    // Phone Repeater State
    const [tempPhone, setTempPhone] = useState({});
    
    // Social Media Repeater State
    const [tempSocialMedia, setTempSocialMedia] = useState({});
    
    // Vehicle Seizure Repeater State
    const [tempSeizureVehicle, setTempSeizureVehicle] = useState({});

    // Execution Details Modal State (Only for Execution Order PDF)
    const [showExecutionModal, setShowExecutionModal] = useState(false);
    const [selectedOrderForExecution, setSelectedOrderForExecution] = useState(null);
    const [execForm, setExecForm] = useState({
        notes: '',
        instructions: '',
        validity: '48 Horas desde su expedición'
    });
    const [savingExecDetails, setSavingExecDetails] = useState(false);

    const handleOpenExecutionModal = (order) => {
        setSelectedOrderForExecution(order);
        const existing = order.content?.execution_details || {};
        setExecForm({
            notes: existing.notes || '',
            instructions: existing.instructions || '',
            validity: existing.validity || '48 Horas desde su expedición'
        });
        setShowExecutionModal(true);
    };

    const handleSaveAndExportExecutionPDF = async (e) => {
        e.preventDefault();
        if (!selectedOrderForExecution) return;
        setSavingExecDetails(true);

        try {
            const config = ORDER_TYPES[selectedOrderForExecution.order_type];
            const updatedContent = {
                ...(selectedOrderForExecution.content || {}),
                execution_details: { ...execForm }
            };

            // Persist to Supabase
            const { error } = await supabase
                .from('judicial_orders')
                .update({ content: updatedContent })
                .eq('id', selectedOrderForExecution.id);

            if (error) throw error;

            // Update local order object
            const updatedOrder = { ...selectedOrderForExecution, content: updatedContent };
            setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
            if (previewOrder && previewOrder.id === updatedOrder.id) {
                setPreviewOrder(updatedOrder);
            }

            // Generate and download Execution Order PDF
            const mod = await import('../utils/orderPdfGenerator');
            await mod.generateOrderPDF(updatedOrder, config, isLSSD, 'orden');

            setShowExecutionModal(false);
        } catch (err) {
            console.error("Error saving execution details:", err);
            alert("Error al guardar los detalles de la orden: " + err.message);
        } finally {
            setSavingExecDetails(false);
        }
    };

    const selectOrderType = (type) => {
        setSelectedType(type);
        const defaults = {};
        const config = ORDER_TYPES[type];
        if (config && config.fields) {
            config.fields.forEach(field => {
                if (field.defaultValue !== undefined) {
                    defaults[field.name] = field.defaultValue;
                }
            });
        }
        setFormData(defaults);
    };

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
    //Error en caso de que no complete todos los campos de la persona
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
    
    const handleAddPhone = (field) => {
        const currentList = formData[field.name] || [];
        const required = field.subFields.every(sf => tempPhone[sf.name]);
        if (!required) {
            alert('Por favor, complete el número de teléfono.');
            return;
        }
        
        const newList = [...currentList, { ...tempPhone }];
        setFormData(prev => ({ ...prev, [field.name]: newList }));
        setTempPhone({});
    };

    const handleRemovePhone = (fieldName, index) => {
        const currentList = formData[fieldName] || [];
        const newList = currentList.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, [fieldName]: newList }));
    };
    
    const handleAddSocialMedia = (field) => {
        const currentList = formData[field.name] || [];
        const required = field.subFields.every(sf => tempSocialMedia[sf.name]);
        if (!required) {
            alert('Por favor, complete todos los campos de la cuenta.');
            return;
        }
        
        const newList = [...currentList, { ...tempSocialMedia }];
        setFormData(prev => ({ ...prev, [field.name]: newList }));
        setTempSocialMedia({});
    };

    const handleRemoveSocialMedia = (fieldName, index) => {
        const currentList = formData[fieldName] || [];
        const newList = currentList.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, [fieldName]: newList }));
    };
    
    const handleAddSeizureVehicle = (field) => {
        const currentList = formData[field.name] || [];
        const required = field.subFields.every(sf => tempSeizureVehicle[sf.name]);
        if (!required) {
            alert('Por favor, complete todos los campos del vehículo.');
            return;
        }
        
        const newList = [...currentList, { ...tempSeizureVehicle }];
        setFormData(prev => ({ ...prev, [field.name]: newList }));
        setTempSeizureVehicle({});
    };

    const handleRemoveSeizureVehicle = (fieldName, index) => {
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
        else if (formData.target_phones && formData.target_phones.length > 0) {
            const phone = formData.target_phones[0];
            primaryValue = phone.number;
            if (formData.target_phones.length > 1) primaryValue += ` +${formData.target_phones.length - 1} más`;
        }
        else if (formData.target_persons_phone_review && formData.target_persons_phone_review.length > 0) {
            const p = formData.target_persons_phone_review[0];
            primaryValue = p.name;
            if (formData.target_persons_phone_review.length > 1) primaryValue += ` +${formData.target_persons_phone_review.length - 1} más`;
        }
        else if (formData.target_phone_numbers && formData.target_phone_numbers.length > 0) {
            const phone = formData.target_phone_numbers[0];
            primaryValue = phone.number;
            if (formData.target_phone_numbers.length > 1) primaryValue += ` +${formData.target_phone_numbers.length - 1} más`;
        }
        else if (formData.target_persons_phone && formData.target_persons_phone.length > 0) {
            const p = formData.target_persons_phone[0];
            primaryValue = p.name;
            if (formData.target_persons_phone.length > 1) primaryValue += ` +${formData.target_persons_phone.length - 1} más`;
        }
        else if (formData.target_number) primaryValue = formData.target_number;
        else if (formData.target_persons && formData.target_persons.length > 0) {
            const p = formData.target_persons[0];
            primaryValue = p.name;
            if (formData.target_persons.length > 1) primaryValue += ` +${formData.target_persons.length - 1} más`;
        }
        else if (formData.target_persons_rico && formData.target_persons_rico.length > 0) {
            const p = formData.target_persons_rico[0];
            primaryValue = p.name;
            if (formData.target_persons_rico.length > 1) primaryValue += ` +${formData.target_persons_rico.length - 1} más`;
        }
        else if (formData.target_account) primaryValue = formData.target_account;
        else if (formData.target_social_accounts && formData.target_social_accounts.length > 0) {
            const acc = formData.target_social_accounts[0];
            primaryValue = `${acc.username} (${acc.social_network})`;
            if (formData.target_social_accounts.length > 1) primaryValue += ` +${formData.target_social_accounts.length - 1} más`;
        }
        else if (formData.username_to_identify) primaryValue = `${formData.username_to_identify} (${formData.social_network || 'Red Social'})`;
        else if (formData.username_url) primaryValue = `${formData.username_url} (${formData.social_network || ''})`;
        else if (formData.protected_persons && formData.restricted_persons && formData.protected_persons.length > 0 && formData.restricted_persons.length > 0) {
            const protectedName = formData.protected_persons[0].name;
            const restrictedName = formData.restricted_persons[0].name;
            primaryValue = `${protectedName} vs ${restrictedName}`;
            const totalExtra = (formData.protected_persons.length - 1) + (formData.restricted_persons.length - 1);
            if (totalExtra > 0) primaryValue += ` +${totalExtra} más`;
        }
        else if (formData.restricted_person) primaryValue = `${formData.restricted_person} (vs ${formData.protected_person})`;
        else if (formData.property_address) primaryValue = formData.property_address;
        else if (formData.business_name) primaryValue = formData.business_name;
        else if (formData.seizure_vehicles && formData.seizure_vehicles.length > 0) {
            const sv = formData.seizure_vehicles[0];
            primaryValue = `${sv.owner_name} - ${sv.vehicle}`;
            if (formData.seizure_vehicles.length > 1) primaryValue += ` +${formData.seizure_vehicles.length - 1} más`;
        }
        else if (formData.person_name) primaryValue = formData.person_name;
        else if (formData.owner_name) primaryValue = formData.owner_name;
        else if (formData.camera_location) primaryValue = formData.camera_location;
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
    const canManageOrders = currentUser && !isAyudante;

    const accentColor = isLSSD ? '#10b981' : 'var(--color-blue, #3b82f6)';
    const accentGlow = isLSSD ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)';

    // Stats
    const totalCount = orders.length;
    const approvedCount = orders.filter(o => o.status === 'Aprobada').length;
    const pendingCount = orders.filter(o => !o.status || o.status === 'Pendiente').length;
    const rejectedCount = orders.filter(o => o.status === 'Rechazada').length;

    return (
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '1.5rem', color: 'var(--text-primary)', minHeight: '100vh' }}>
            
            {/* --- APPLE HERO CONTROL BANNER --- */}
            <div style={{
                marginBottom: '1.75rem',
                background: 'var(--glass-bg, rgba(15, 23, 42, 0.6))',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.1))',
                padding: '1.5rem 1.75rem',
                boxShadow: '0 12px 35px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '14px',
                            background: `linear-gradient(135deg, ${accentColor}, var(--color-blue-dark, #1e3a8a))`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: `0 6px 20px ${accentGlow}`,
                            color: '#ffffff'
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                <path d="m9 12 2 2 4-4"/>
                            </svg>
                        </div>

                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                                    ÓRDENES Y SENTENCIAS JUDICIALES
                                </h1>
                                <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 800,
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '20px',
                                    background: `rgba(var(--color-blue-rgb, 59, 130, 246), 0.15)`,
                                    color: accentColor,
                                    border: `1px solid ${accentColor}44`,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Warrants & Judicial Orders Archive
                                </span>
                            </div>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {isLSSD ? "SHERIFF CRIMINAL UNIT BUREAU • Registro y consulta de expedientes" : "DETECTIVE BUREAU • Registro y consulta de expedientes"}
                            </p>
                        </div>
                    </div>

                    {!isAyudante && (
                        <button 
                            className="mac-btn mac-btn-primary" 
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.7rem 1.35rem',
                                fontSize: '0.88rem',
                                borderRadius: '12px',
                                background: isLSSD 
                                    ? 'linear-gradient(135deg, #10b981, #059669)' 
                                    : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                color: '#ffffff',
                                fontWeight: 700,
                                border: '1px solid rgba(255,255,255,0.2)',
                                boxShadow: `0 4px 16px ${accentGlow}`,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }} 
                            onClick={() => { selectOrderType('Orden de Registro (Casa)'); setShowCreateModal(true); }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19"/>
                                <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                            <span>Generar Nueva Orden</span>
                        </button>
                    )}
                </div>

                {/* KPI Metrics Widgets Bar */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '0.85rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))'
                }}>
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '12px',
                        padding: '0.85rem 1.1rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>TOTAL REGISTRADAS</span>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: accentColor, marginTop: '0.1rem' }}>{totalCount}</div>
                        </div>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: `rgba(var(--color-blue-rgb, 59, 130, 246), 0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                            </svg>
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '12px',
                        padding: '0.85rem 1.1rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>APROBADAS</span>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ade80', marginTop: '0.1rem' }}>{approvedCount}</div>
                        </div>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(34, 197, 94, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                                <polyline points="22 4 12 14.01 9 11.01"/>
                            </svg>
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '12px',
                        padding: '0.85rem 1.1rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>PENDIENTES</span>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.1rem' }}>{pendingCount}</div>
                        </div>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fbbf24' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <polyline points="12 6 12 12 16 14"/>
                            </svg>
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '12px',
                        padding: '0.85rem 1.1rem',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>RECHAZADAS</span>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171', marginTop: '0.1rem' }}>{rejectedCount}</div>
                        </div>
                        <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="15" y1="9" x2="9" y2="15"/>
                                <line x1="9" y1="9" x2="15" y2="15"/>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '290px 1fr', gap: '1.75rem' }}>
                
                {/* --- APPLE GLASS SIDEBAR --- */}
                <div>
                    <div style={{ 
                        background: 'var(--glass-bg, rgba(15, 23, 42, 0.65))', 
                        backdropFilter: 'blur(16px)', 
                        border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.08))', 
                        borderRadius: '18px', 
                        padding: '1.25rem 0',
                        position: 'sticky',
                        top: '1.5rem',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.25)'
                    }}>
                        <div style={{ padding: '0 1.25rem 0.85rem 1.25rem', marginBottom: '0.5rem', borderBottom: '1px solid var(--glass-border, rgba(255, 255, 255, 0.06))', color: 'var(--text-secondary)', fontSize: '0.72rem', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            Categoría de Órdenes
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
                        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', gap: '0.6rem' }}>
                            <span style={{ display: 'inline-block', width: '16px', height: '16px', border: `2px solid ${accentColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                            <span>Cargando archivo de órdenes judiciales...</span>
                        </div>
                    ) : orders.length === 0 ? (
                        <div style={{ 
                            background: 'var(--glass-bg, rgba(15, 23, 42, 0.4))', 
                            border: '1px dashed var(--glass-border, rgba(255, 255, 255, 0.1))', 
                            borderRadius: '18px', 
                            padding: '4rem 2rem', 
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
                            color: 'var(--text-secondary)' 
                        }}>
                            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.75rem', opacity: 0.6 }}>
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14 2 14 8 20 8"/>
                            </svg>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>No se encontraron órdenes registradas</div>
                            <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>No existen archivos bajo esta categoría.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
                            {orders.map(order => (
                                <OrderCard 
                                    key={order.id} 
                                    order={order} 
                                    onPreview={openPreview} 
                                    onOpenExecutionModal={handleOpenExecutionModal}
                                />
                            ))}
                        </div>
                    )}
                </div>

            </div>

            {/* --- CREATE MODAL --- */}
            {showCreateModal && (
                <div className="mac-modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="mac-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '820px', width: '92vw' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowCreateModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                </svg>
                                <span>Generar Nueva Orden Judicial</span>
                            </span>
                            <div style={{ width: 52 }} />
                        </div>
                        
                        <div className="mac-modal-body" style={{ padding: '1.5rem', maxHeight: '75vh', overflowY: 'auto' }}>
                            {/* Type Selector */}
                            <div style={{ marginBottom: '1.75rem' }}>
                                <label className="form-label" style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem', display: 'block' }}>
                                    TIPO DE ORDEN JUDICIAL
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                                    {Object.entries(ORDER_TYPES).map(([key, config]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => selectOrderType(key)}
                                            style={{
                                                background: selectedType === key ? `rgba(var(--color-blue-rgb, 59, 130, 246), 0.18)` : 'rgba(0,0,0,0.25)',
                                                border: selectedType === key ? `1px solid ${accentColor}` : '1px solid var(--glass-border, rgba(255,255,255,0.08))',
                                                color: selectedType === key ? accentColor : 'var(--text-secondary)',
                                                padding: '10px 12px',
                                                borderRadius: '12px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'center',
                                                gap: '6px',
                                                textAlign: 'center'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedType === key ? accentColor : 'var(--text-secondary)' }}>
                                                {renderOrderTypeIcon(key, 20)}
                                            </div>
                                            <div style={{ fontSize: '0.78rem', fontWeight: 700, lineHeight: '1.2' }}>{config.label}</div>
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

                                        // Render Phone Repeater
                                        if (field.type === 'phone_repeater') {
                                            const currentPhones = formData[field.name] || [];
                                            return (
                                                <div key={field.name} className="form-group">
                                                    <label className="form-label">{field.label}</label>
                                                    
                                                    {/* Input Row for Adding Phone */}
                                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                                                        <div style={{ display: 'grid', gap: '0.8rem' }}>
                                                            {field.subFields.map(sf => (
                                                                <div key={sf.name}>
                                                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>{sf.label}</label>
                                                                    <input
                                                                        type="text"
                                                                        className="form-input"
                                                                        placeholder={sf.placeholder}
                                                                        value={tempPhone[sf.name] || ''}
                                                                        onChange={(e) => setTempPhone(prev => ({ ...prev, [sf.name]: e.target.value }))}
                                                                        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddPhone(field)}
                                                            style={{ marginTop: '0.8rem', padding: '0.5rem 1rem', background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                                        >
                                                            + Añadir Teléfono
                                                        </button>
                                                    </div>

                                                    {/* List of Added Phones */}
                                                    {currentPhones.length > 0 && (
                                                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1rem' }}>
                                                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--accent-gold)' }}>
                                                                Teléfonos Añadidos ({currentPhones.length})
                                                            </div>
                                                            {currentPhones.map((phone, idx) => (
                                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', marginBottom: '0.5rem' }}>
                                                                    <div style={{ fontSize: '0.85rem' }}>
                                                                        <strong>{phone.number}</strong>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemovePhone(field.name, idx)}
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

                                        // Render Social Media Repeater
                                        if (field.type === 'social_media_repeater') {
                                            const currentAccounts = formData[field.name] || [];
                                            return (
                                                <div key={field.name} className="form-group">
                                                    <label className="form-label">{field.label}</label>
                                                    
                                                    {/* Input Row for Adding Account */}
                                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                                                        <div style={{ display: 'grid', gap: '0.8rem' }}>
                                                            {field.subFields.map(sf => (
                                                                <div key={sf.name}>
                                                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>{sf.label}</label>
                                                                    <input
                                                                        type="text"
                                                                        className="form-input"
                                                                        placeholder={sf.placeholder}
                                                                        value={tempSocialMedia[sf.name] || ''}
                                                                        onChange={(e) => setTempSocialMedia(prev => ({ ...prev, [sf.name]: e.target.value }))}
                                                                        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddSocialMedia(field)}
                                                            style={{ marginTop: '0.8rem', padding: '0.5rem 1rem', background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                                        >
                                                            + Añadir Cuenta
                                                        </button>
                                                    </div>

                                                    {/* List of Added Accounts */}
                                                    {currentAccounts.length > 0 && (
                                                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1rem' }}>
                                                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--accent-gold)' }}>
                                                                Cuentas Añadidas ({currentAccounts.length})
                                                            </div>
                                                            {currentAccounts.map((acc, idx) => (
                                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', marginBottom: '0.5rem' }}>
                                                                    <div style={{ fontSize: '0.85rem' }}>
                                                                        <strong>{acc.username}</strong> <span style={{ color: 'var(--text-secondary)' }}>({acc.social_network})</span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveSocialMedia(field.name, idx)}
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

                                        // Render Vehicle Seizure Repeater
                                        if (field.type === 'vehicle_seizure_repeater') {
                                            const currentSeizures = formData[field.name] || [];
                                            return (
                                                <div key={field.name} className="form-group">
                                                    <label className="form-label">{field.label}</label>
                                                    
                                                    {/* Input Row for Adding Seizure Vehicle */}
                                                    <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                                                            {field.subFields.map(sf => (
                                                                <div key={sf.name}>
                                                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>{sf.label}</label>
                                                                    <input
                                                                        type="text"
                                                                        className="form-input"
                                                                        placeholder={sf.placeholder}
                                                                        value={tempSeizureVehicle[sf.name] || ''}
                                                                        onChange={(e) => setTempSeizureVehicle(prev => ({ ...prev, [sf.name]: e.target.value }))}
                                                                        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddSeizureVehicle(field)}
                                                            style={{ marginTop: '0.8rem', padding: '0.5rem 1rem', background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                                        >
                                                            + Añadir Vehículo
                                                        </button>
                                                    </div>

                                                    {/* List of Added Seizures */}
                                                    {currentSeizures.length > 0 && (
                                                        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1rem' }}>
                                                            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--accent-gold)' }}>
                                                                Vehículos Añadidos ({currentSeizures.length})
                                                            </div>
                                                            {currentSeizures.map((sz, idx) => (
                                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.7rem', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', marginBottom: '0.5rem' }}>
                                                                    <div style={{ fontSize: '0.85rem' }}>
                                                                        <strong>{sz.owner_name}</strong> (ID: {sz.owner_id}) - <span style={{ color: 'var(--text-secondary)' }}>{sz.vehicle} ({sz.plate})</span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveSeizureVehicle(field.name, idx)}
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

                                <div style={{
                                    padding: '1rem 1.5rem',
                                    borderTop: '1px solid var(--glass-border, rgba(255,255,255,0.08))',
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    gap: '0.75rem',
                                    background: 'rgba(0, 0, 0, 0.25)',
                                    margin: '1.5rem -1.5rem -1.5rem -1.5rem'
                                }}>
                                    <button 
                                        type="button" 
                                        className="mac-btn mac-btn-secondary" 
                                        onClick={() => setShowCreateModal(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="mac-btn mac-btn-primary" 
                                        disabled={submitting}
                                        style={{
                                            background: isLSSD 
                                                ? 'linear-gradient(135deg, #10b981, #059669)' 
                                                : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                            color: '#ffffff',
                                            fontWeight: 700,
                                            border: 'none'
                                        }}
                                    >
                                        {submitting ? 'Archivando...' : 'Archivar Orden Judicial'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
            
            {/* --- EXECUTION DETAILS MODAL (PUBLIC EXECUTION ORDER PDF) --- */}
            {showExecutionModal && selectedOrderForExecution && (
                <div className="mac-modal-overlay" onClick={() => setShowExecutionModal(false)}>
                    <div className="mac-modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '680px', width: '92vw' }}>
                        <div className="mac-modal-header">
                            <div className="mac-window-dots">
                                <div className="mac-window-dot close" onClick={() => setShowExecutionModal(false)} title="Cerrar"></div>
                                <div className="mac-window-dot min"></div>
                                <div className="mac-window-dot max"></div>
                            </div>
                            <span className="mac-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                <span>Detalles Adicionales de Ejecución Judicial</span>
                            </span>
                            <div style={{ width: 52 }} />
                        </div>

                        <div className="mac-modal-body" style={{ padding: '1.5rem', maxHeight: '75vh', overflowY: 'auto' }}>
                            <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '12px', padding: '1rem', marginBottom: '1.25rem' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '0.2rem' }}>
                                    Mandamiento Judicial de Ejecución (Para Entregar al Ciudadano)
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                    Complete los términos o cláusulas adicionales de actuación. Estos datos se guardarán permanentemente en el expediente de esta orden y figurarán impresos únicamente en el PDF de la orden entregable.
                                </div>
                            </div>

                            <form onSubmit={handleSaveAndExportExecutionPDF}>
                                <div style={{ display: 'grid', gap: '1.2rem' }}>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                                            Cláusulas Especiales de Ejecución / Términos de Actuación
                                        </label>
                                        <textarea
                                            className="eval-textarea"
                                            rows="3"
                                            placeholder="Ej: Se autoriza el uso de la fuerza necesaria en caso de no obtener respuesta. Franja horaria de ejecución: de 06:00 a 22:00."
                                            value={execForm.notes}
                                            onChange={e => setExecForm(prev => ({ ...prev, notes: e.target.value }))}
                                            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border, rgba(255,255,255,0.1))' }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                                            Instrucciones / Indicaciones de Notificación
                                        </label>
                                        <textarea
                                            className="eval-textarea"
                                            rows="3"
                                            placeholder="Ej: Notificación entregada en mano al propietario. Entrega de copia cotejada del presente mandamiento."
                                            value={execForm.instructions}
                                            onChange={e => setExecForm(prev => ({ ...prev, instructions: e.target.value }))}
                                            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border, rgba(255,255,255,0.1))' }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                                            Plazo de Vigencia / Validez de la Orden
                                        </label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="Ej: 48 Horas desde su expedición"
                                            value={execForm.validity}
                                            onChange={e => setExecForm(prev => ({ ...prev, validity: e.target.value }))}
                                            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border, rgba(255,255,255,0.1))' }}
                                        />
                                    </div>
                                </div>

                                <div style={{
                                    padding: '1rem 1.5rem',
                                    borderTop: '1px solid var(--glass-border, rgba(255,255,255,0.08))',
                                    display: 'flex',
                                    justify: 'flex-end',
                                    gap: '0.75rem',
                                    background: 'rgba(0, 0, 0, 0.25)',
                                    margin: '1.5rem -1.5rem -1.5rem -1.5rem'
                                }}>
                                    <button
                                        type="button"
                                        className="mac-btn mac-btn-secondary"
                                        onClick={() => setShowExecutionModal(false)}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="mac-btn mac-btn-primary"
                                        disabled={savingExecDetails}
                                        style={{
                                            background: isLSSD 
                                                ? 'linear-gradient(135deg, #10b981, #059669)' 
                                                : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                            color: '#ffffff',
                                            fontWeight: 700,
                                            border: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                            <polyline points="7 10 12 15 17 10"/>
                                            <line x1="12" y1="15" x2="12" y2="3"/>
                                        </svg>
                                        <span>{savingExecDetails ? 'Guardando e Imprimiendo...' : 'Guardar e Imprimir Orden'}</span>
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
                onOpenExecutionModal={handleOpenExecutionModal}
            />
        </div>
    );
}

export default OrderArchive;
