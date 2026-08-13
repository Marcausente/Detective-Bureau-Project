import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabaseClient';
import GTAVMap from '../assets/GTAV-HD-MAP-satellite.jpg';
import { useLanguage } from '../contexts/LanguageContext';
import '../doc_styles.css';

// Fix icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function CrimeMap() {
    const { t } = useLanguage();
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const layerGroupRef = useRef(null);
    const drawingLayerRef = useRef(null);

    // State
    const [zones, setZones] = useState([]);
    const [authorized, setAuthorized] = useState(false);
    const [isGU, setIsGU] = useState(false);
    const [mode, setMode] = useState('view'); // 'view', 'draw'
    const [drawingPoints, setDrawingPoints] = useState([]);

    // Form State
    const [tempZoneData, setTempZoneData] = useState({ name: '', description: '', color: '#ef4444', is_gang_zone: false, emoji: '', is_surveillance: false });
    const [showModal, setShowModal] = useState(false);
    const [editingZoneId, setEditingZoneId] = useState(null); // ID if editing, null if creating

    // Dropdown Data
    const [gangs, setGangs] = useState([]);
    const [cases, setCases] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [selectedGang, setSelectedGang] = useState('');
    const [selectedCase, setSelectedCase] = useState('');
    const [selectedIncident, setSelectedIncident] = useState('');

    // Refs for closure access
    const modeRef = useRef(mode);
    useEffect(() => { modeRef.current = mode; }, [mode]);
    const drawingPointsRef = useRef(drawingPoints);
    useEffect(() => { drawingPointsRef.current = drawingPoints; }, [drawingPoints]);

    // We need to access handleEditZone inside the popup click handler
    // Since popup HTML strings are not React components, we attach a global or custom event listener,
    // or we render the popup using ReactDOM (complex with Leaflet),
    // OR simplest: Assign a function to the window object (hacky but works for vanilla JS popups).
    // Better approach: Use event delegation on the map container for the 'edit-btn' class.

    useEffect(() => {
        checkAuth();
        fetchZones();
        fetchDropdownData();
    }, []);

    useEffect(() => {
        if (!mapInstanceRef.current && mapContainerRef.current) {
            // MAP CONFIGURATION
            const bounds = [[0, 0], [8192, 8192]];

            const map = L.map(mapContainerRef.current, {
                crs: L.CRS.Simple,
                minZoom: -3,
                maxZoom: 2,
                zoom: -1,
                center: [4096, 4096],
                zoomControl: false,
                attributionControl: false,
                maxBounds: bounds,
                maxBoundsViscosity: 1.0,
                bounceAtZoomLimits: false
            });

            mapContainerRef.current.style.background = '#0f172a';

            L.imageOverlay(GTAVMap, bounds).addTo(map);
            map.fitBounds(bounds);

            layerGroupRef.current = L.layerGroup().addTo(map);
            drawingLayerRef.current = L.layerGroup().addTo(map);

            map.on('click', (e) => {
                if (modeRef.current === 'draw') {
                    const newPoint = [e.latlng.lat, e.latlng.lng];
                    setDrawingPoints(prev => [...prev, newPoint]);
                }
            });

            map.on('contextmenu', (e) => {
                if (modeRef.current === 'draw') {
                    e.originalEvent.preventDefault();
                    setDrawingPoints(prev => prev.slice(0, -1));
                }
            });

            // Event delegation for popup buttons
            const container = map.getContainer();
            container.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-zone-btn')) {
                    const id = e.target.getAttribute('data-id');
                    handleDeleteZone(id);
                }
                if (e.target.classList.contains('edit-zone-btn')) {
                    const id = e.target.getAttribute('data-id');
                    // We need to find the zone data. 
                    // Since specific zone data isn't easily passed via HTML attribute, 
                    // we'll trigger a custom event or look it up in state.
                    // Accessing 'zones' state here directly might be stale if not careful, 
                    // but we can use a custom event dispatch to the component.
                    const event = new CustomEvent('edit-zone-click', { detail: { id } });
                    window.dispatchEvent(event);
                }
            });

            mapInstanceRef.current = map;
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Listen for the custom event to handle edit with fresh state
    useEffect(() => {
        const handleEditEvent = (e) => {
            const id = e.detail.id;
            const zoneToEdit = zones.find(z => z.id === id);
            if (zoneToEdit) {
                prepareEdit(zoneToEdit);
            }
        };
        window.addEventListener('edit-zone-click', handleEditEvent);
        return () => window.removeEventListener('edit-zone-click', handleEditEvent);
    }, [zones]); // Re-bind when zones change so we have fresh data


    // --- DATA FETCHING ---
    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.rpc('auth_is_gang_authorized');
            if (data) setAuthorized(true);
            const { data: guData } = await supabase.rpc('auth_is_gang_unit_member');
            if (guData) setIsGU(true);
        }
    };

    const fetchZones = async () => {
        const { data } = await supabase.rpc('get_map_zones');
        setZones(data || []);
    };

    const fetchDropdownData = async () => {
        const { data: g } = await supabase.rpc('get_gangs_data');
        if (g) setGangs(g);
        const { data: c } = await supabase.rpc('get_cases');
        if (c) setCases(c);
        const { data: i } = await supabase.rpc('get_incidents_v2');
        if (i) setIncidents(i);
    };


    // --- RENDERING MAP LAYERS ---
    useEffect(() => {
        if (mapInstanceRef.current && layerGroupRef.current) {
            layerGroupRef.current.clearLayers();

            zones.forEach(zone => {
                const isSurv = zone.is_surveillance;
                const poly = L.polygon(zone.coordinates, {
                    color: zone.color,
                    fillColor: zone.color,
                    fillOpacity: isSurv ? 0.2 : 0.35,
                    weight: isSurv ? 3 : 2,
                    dashArray: isSurv ? '8, 8' : undefined
                });

                let popupHTML = `
                    <h3 style="margin: 0 0 5px 0; color: #cfb53b; text-transform: uppercase;">${zone.emoji ? zone.emoji + ' ' : ''}${zone.name}</h3>
                    ${zone.is_surveillance ? `<div style="font-size: 0.8em; margin-bottom: 8px; color: var(--color-blue-light); font-weight: bold; border: 1px solid var(--color-blue); padding: 2px 5px; border-radius: 4px; display: inline-block;">🕵️ ZONA DE VIGILANCIA</div>` : ''}
                    <p style="margin: 0 0 10px 0; color: #ccc; font-size: 0.9em;">${zone.description || ''}</p>
                    ${zone.gang_name ? `<div style="font-size: 0.85em; margin-bottom: 2px;"><strong style="color: #fff;">${t('gangLabel')}</strong> ${zone.gang_name}</div>` : ''}
                    ${zone.case_title ? `<div style="font-size: 0.85em; margin-bottom: 2px;"><strong style="color: #fff;">${t('caseLabel')}</strong> ${authorized ? zone.case_title : `<span style="color: #ef4444; font-weight: bold;">${t('noAccessMap')}</span>`}</div>` : ''}
                    ${zone.incident_title ? `<div style="font-size: 0.85em; margin-bottom: 2px;"><strong style="color: #fff;">${t('incidentLabel')}</strong> ${zone.incident_title}</div>` : ''}
                    ${zone.is_gang_zone ? `<div style="font-size: 0.8em; margin-top: 5px; color: #ef4444; font-weight: bold; border: 1px solid #ef4444; padding: 2px 5px; border-radius: 4px; display: inline-block;">${t('gangDrogaZone')}</div>` : ''}
                `;

                if (authorized) {
                    popupHTML += `
                        <div style="display: flex; gap: 5px; margin-top: 10px;">
                            <button class="edit-zone-btn" data-id="${zone.id}" style="
                                flex: 1;
                                background: var(--color-blue); 
                                color: white; 
                                border: none; 
                                padding: 6px; 
                                cursor: pointer; 
                                border-radius: 4px;
                                font-size: 0.75rem;
                                font-weight: 600;
                                text-transform: uppercase;
                            ">${t('editMapBtn')}</button>
                            <button class="delete-zone-btn" data-id="${zone.id}" style="
                                flex: 1;
                                background: #ef4444; 
                                color: white; 
                                border: none; 
                                padding: 6px; 
                                cursor: pointer; 
                                border-radius: 4px;
                                font-size: 0.75rem;
                                font-weight: 600;
                                text-transform: uppercase;
                            ">${t('deleteMapBtn')}</button>
                        </div>
                    `;
                }

                poly.bindPopup(popupHTML, {
                    className: 'custom-popup-dark'
                });

                poly.on('mouseover', function () { this.setStyle({ fillOpacity: 0.6, weight: 3 }); });
                poly.on('mouseout', function () { this.setStyle({ fillOpacity: 0.35, weight: 2 }); });

                poly.addTo(layerGroupRef.current);

                // --- EMOJI LABEL centrado en el polígono ---
                if (zone.emoji && zone.emoji.trim() !== '') {
                    // Calcular el centroide del polígono
                    const coords = zone.coordinates;
                    let latSum = 0, lngSum = 0;
                    coords.forEach(pt => { latSum += pt[0]; lngSum += pt[1]; });
                    const centroid = [latSum / coords.length, lngSum / coords.length];

                    const emojiIcon = L.divIcon({
                        html: `<div style="
                            font-size: 3rem;
                            line-height: 1;
                            opacity: 0.35;
                            user-select: none;
                            pointer-events: none;
                            filter: drop-shadow(0 0 4px rgba(0,0,0,0.5));
                            text-align: center;
                        ">${zone.emoji}</div>`,
                        className: '',
                        iconSize: [60, 60],
                        iconAnchor: [30, 30]
                    });

                    L.marker(centroid, { icon: emojiIcon, interactive: false }).addTo(layerGroupRef.current);
                }
            });
        }
    }, [zones, authorized]);

    // --- DRAWING PREVIEW ---
    useEffect(() => {
        if (mapInstanceRef.current && drawingLayerRef.current) {
            drawingLayerRef.current.clearLayers();

            if (mode === 'draw' && drawingPoints.length > 0) {
                drawingPoints.forEach(pt => {
                    L.circleMarker(pt, { color: '#cfb53b', radius: 4, fillOpacity: 1 }).addTo(drawingLayerRef.current);
                });

                if (drawingPoints.length > 1) {
                    L.polyline(drawingPoints, { color: '#cfb53b', dashArray: '5, 10', weight: 2 }).addTo(drawingLayerRef.current);
                }

                if (drawingPoints.length > 2) {
                    L.polyline([drawingPoints[drawingPoints.length - 1], drawingPoints[0]], { color: '#cfb53b', dashArray: '5, 10', opacity: 0.5, weight: 2 }).addTo(drawingLayerRef.current);
                }
            }
        }
    }, [drawingPoints, mode]);


    // --- HANDLERS ---
    const handleDeleteZone = async (id) => {
        if (!confirm('Are you sure you want to delete this zone?')) return;
        const { error } = await supabase.rpc('delete_map_zone', { p_id: id });
        if (error) alert('Error: ' + error.message);
        else fetchZones();
    };

    const prepareEdit = (zone) => {
        setTempZoneData({
            name: zone.name,
            description: zone.description || '',
            color: zone.color || '#ef4444',
            is_gang_zone: zone.is_gang_zone || false,
            emoji: zone.emoji || '',
            is_surveillance: zone.is_surveillance || false
        });
        setSelectedGang(zone.gang_id || '');
        setSelectedCase(zone.case_id || '');
        setSelectedIncident(zone.incident_id || '');
        setEditingZoneId(zone.id);
        setShowModal(true);
    };

    const handleFinishDraw = () => {
        if (drawingPoints.length < 3) return alert("Zone must have at least 3 points");
        setEditingZoneId(null); // Ensure we are creating
        setTempZoneData({ name: '', description: '', color: '#ef4444', is_gang_zone: false, emoji: '', is_surveillance: false });
        setSelectedGang('');
        setSelectedCase('');
        setSelectedIncident('');
        setShowModal(true);
    };

    const handleSaveZone = async () => {
        if (!tempZoneData.name) return alert("Name is required");

        let error;

        if (editingZoneId) {
            // UPDATE EXISTING
            const payload = {
                p_id: editingZoneId,
                p_name: tempZoneData.name,
                p_description: tempZoneData.description,
                p_gang_id: selectedGang || null,
                p_case_id: selectedCase || null,
                p_incident_id: selectedIncident || null,
                p_color: tempZoneData.color,
                p_is_gang_zone: tempZoneData.is_gang_zone,
                p_emoji: tempZoneData.emoji || null,
                p_is_surveillance: tempZoneData.is_surveillance || false
            };
            const res = await supabase.rpc('update_map_zone', payload);
            error = res.error;
        } else {
            // CREATE NEW
            const payload = {
                p_name: tempZoneData.name,
                p_description: tempZoneData.description,
                p_coordinates: drawingPoints,
                p_type: 'polygon',
                p_gang_id: selectedGang || null,
                p_case_id: selectedCase || null,
                p_incident_id: selectedIncident || null,
                p_color: tempZoneData.color,
                p_is_gang_zone: tempZoneData.is_gang_zone,
                p_emoji: tempZoneData.emoji || null,
                p_is_surveillance: tempZoneData.is_surveillance || false
            };
            const res = await supabase.rpc('create_map_zone', payload);
            error = res.error;
        }

        if (error) {
            alert('Error: ' + error.message);
        } else {
            fetchZones();
            setMode('view');
            setDrawingPoints([]);
            setShowModal(false);
            setEditingZoneId(null);
            setTempZoneData({ name: '', description: '', color: '#ef4444', is_gang_zone: false, emoji: '' });
            setSelectedGang('');
            setSelectedCase('');
            setSelectedIncident('');
        }
    };


    // --- STYLES ---
    const toolbarStyle = {
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '1.2rem 1.4rem',
        borderRadius: '18px',
        border: '1px solid rgba(255,255,255,0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        minWidth: '270px'
    };

    return (
        <div style={{ width: '100%', height: 'calc(100vh - 140px)', padding: 0 }}>
            {/* Main Interactive Map Card Container */}
            <div className="mac-doc-card" style={{ position: 'relative', height: '100%', width: '100%', overflow: 'hidden', padding: 0, border: '1px solid rgba(255, 255, 255, 0.1)', background: '#0b1120', borderRadius: '16px', boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6)' }}>
                
                {/* Leaflet Map Renderer */}
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%', outline: 'none' }} />

                {/* macOS Floating Controls Widget */}
                <div style={toolbarStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '10px', height: '10px', background: mode === 'draw' ? '#f59e0b' : '#3b82f6', borderRadius: '50%', boxShadow: `0 0 10px ${mode === 'draw' ? '#f59e0b' : '#3b82f6'}` }}></div>
                        <h3 style={{ margin: 0, color: '#ffffff', fontSize: '1rem', fontWeight: 800, letterSpacing: '0.02em' }}>
                            {t('crimeMap') || 'Control del Mapa'}
                        </h3>
                    </div>

                    {authorized ? (
                        mode === 'view' ? (
                            <button
                                onClick={() => setMode('draw')}
                                className="mac-btn mac-btn-primary"
                                style={{
                                    width: '100%',
                                    padding: '0.65rem 1rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    justifyContent: 'center'
                                }}
                            >
                                ➕ {t('newRestrictedZone') || 'Nueva Zona Táctica'}
                            </button>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ fontSize: '0.8rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.5rem 0.75rem', borderRadius: '10px', lineHeight: 1.4 }}>
                                    {t('clickMapToPlacePoints') || 'Haz clic sobre el mapa para marcar los puntos del polígono. Clic derecho elimina el último punto.'}
                                </div>
                                {drawingPoints.length > 0 && (
                                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, textAlign: 'center' }}>
                                        Puntos seleccionados: <strong style={{ color: '#ffffff' }}>{drawingPoints.length}</strong> (mínimo 3)
                                    </div>
                                )}
                                <button
                                    onClick={handleFinishDraw}
                                    className="mac-btn mac-btn-primary"
                                    disabled={drawingPoints.length < 3}
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem 1rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        justifyContent: 'center',
                                        opacity: drawingPoints.length < 3 ? 0.5 : 1
                                    }}
                                >
                                    ✅ {t('finishAndSave') || 'Finalizar y Guardar'}
                                </button>
                                <button
                                    onClick={() => { setMode('view'); setDrawingPoints([]); }}
                                    className="mac-btn mac-btn-secondary"
                                    style={{
                                        width: '100%',
                                        padding: '0.6rem 1rem',
                                        fontSize: '0.85rem',
                                        justifyContent: 'center',
                                        color: '#f87171',
                                        borderColor: 'rgba(239, 68, 68, 0.3)'
                                    }}
                                >
                                    ✕ {t('cancelBtn') || 'Cancelar'}
                                </button>
                            </div>
                        )
                    ) : (
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            {t('viewAccessOnly') || 'Solo modo lectura. Requiere permisos para crear/editar zonas.'}
                        </div>
                    )}
                </div>
            </div>

            {/* Apple macOS Modal Overlay for Creating / Editing Zones */}
            {showModal && (
                <div className="mac-modal-backdrop">
                    <div className="mac-modal-container" style={{ maxWidth: '520px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
                            <span className="mac-status-dot" style={{ backgroundColor: '#3b82f6' }}></span>
                            <h3 className="mac-modal-title" style={{ margin: 0 }}>
                                {editingZoneId ? (t('editZone') || 'Editar Zona Táctica') : (t('defineNewZone') || 'Definir Nueva Zona Táctica')}
                            </h3>
                        </div>

                        <div className="mac-form-group">
                            <label className="mac-form-label">{t('zoneName') || 'Nombre / Designación de la Zona *'}</label>
                            <input
                                className="mac-form-input"
                                value={tempZoneData.name}
                                onChange={e => setTempZoneData({ ...tempZoneData, name: e.target.value })}
                                placeholder={t('designationPlaceholder') || 'Ej: Sector Norte - Los Santos'}
                            />
                        </div>

                        {/* Visibility Checkbox Toggle */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.85rem',
                            marginBottom: '1rem',
                            padding: '0.85rem 1rem',
                            background: 'rgba(255, 255, 255, 0.04)',
                            borderRadius: '14px',
                            border: '1px solid rgba(255, 255, 255, 0.08)'
                        }}>
                            <input
                                type="checkbox"
                                id="isGangZone"
                                checked={tempZoneData.is_gang_zone}
                                onChange={e => setTempZoneData({ ...tempZoneData, is_gang_zone: e.target.checked })}
                                style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#fbbf24' }}
                            />
                            <label htmlFor="isGangZone" style={{ color: '#ffffff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700 }}>
                                {t('showPublicLabel') || 'Mostrar en Mapa Público'}
                                <span style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 400, marginTop: '2px' }}>
                                    {t('visibleWithoutLogin') || 'Visible para ciudadanos sin iniciar sesión'}
                                </span>
                            </label>
                        </div>

                        {/* Gang Unit Surveillance Checkbox */}
                        {isGU && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.85rem',
                                marginBottom: '1rem',
                                padding: '0.85rem 1rem',
                                background: 'rgba(59, 130, 246, 0.12)',
                                borderRadius: '14px',
                                border: '1px solid rgba(59, 130, 246, 0.3)'
                            }}>
                                <input
                                    type="checkbox"
                                    id="isSurveillance"
                                    checked={tempZoneData.is_surveillance}
                                    onChange={e => setTempZoneData({ ...tempZoneData, is_surveillance: e.target.checked })}
                                    style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#3b82f6' }}
                                />
                                <label htmlFor="isSurveillance" style={{ color: '#ffffff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700 }}>
                                    🕵️ Zona de Vigilancia
                                    <span style={{ display: 'block', fontSize: '0.78rem', color: '#60a5fa', fontWeight: 400, marginTop: '2px' }}>
                                        (Exclusivo de la Gang Unit)
                                    </span>
                                </label>
                            </div>
                        )}

                        <div className="mac-form-group">
                            <label className="mac-form-label">{t('descriptionIntel') || 'Descripción e Inteligencia'}</label>
                            <textarea
                                className="mac-form-input"
                                rows="3"
                                value={tempZoneData.description}
                                onChange={e => setTempZoneData({ ...tempZoneData, description: e.target.value })}
                                placeholder="Escribe observaciones tácticas..."
                                style={{ resize: 'vertical' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="mac-form-group">
                                <label className="mac-form-label">{t('zoneColor') || 'Color de Zona'}</label>
                                <input
                                    type="color"
                                    className="mac-form-input"
                                    style={{ height: '42px', padding: '4px', cursor: 'pointer' }}
                                    value={tempZoneData.color}
                                    onChange={e => setTempZoneData({ ...tempZoneData, color: e.target.value })}
                                />
                            </div>

                            <div className="mac-form-group">
                                <label className="mac-form-label">Emoji de Zona</label>
                                <input
                                    type="text"
                                    className="mac-form-input"
                                    placeholder="Ej: 🔫 💊 🏠 ⚠️"
                                    value={tempZoneData.emoji}
                                    onChange={e => setTempZoneData({ ...tempZoneData, emoji: e.target.value })}
                                    style={{ fontSize: '1.3rem', textAlign: 'center', letterSpacing: '4px' }}
                                    maxLength={4}
                                />
                            </div>
                        </div>

                        <div className="mac-form-group">
                            <label className="mac-form-label">{t('linkedGang') || 'Banda Asociada'}</label>
                            <select
                                className="mac-form-input"
                                value={selectedGang}
                                onChange={e => setSelectedGang(e.target.value)}
                                style={{ cursor: 'pointer' }}
                            >
                                <option value="" style={{ background: '#0f172a' }}>{t('noneOption') || '-- Ninguna --'}</option>
                                {gangs.map(g => <option key={g.gang_id} value={g.gang_id} style={{ background: '#0f172a' }}>{g.name}</option>)}
                            </select>
                        </div>

                        <div className="mac-form-group">
                            <label className="mac-form-label">{t('linkedCase') || 'Caso Vinculado'}</label>
                            <select
                                className="mac-form-input"
                                value={selectedCase}
                                onChange={e => setSelectedCase(e.target.value)}
                                style={{ cursor: 'pointer' }}
                            >
                                <option value="" style={{ background: '#0f172a' }}>{t('noneOption') || '-- Ninguno --'}</option>
                                {cases.map(c => <option key={c.id} value={c.id} style={{ background: '#0f172a' }}>#{c.case_number} - {c.title}</option>)}
                            </select>
                        </div>

                        <div className="mac-form-group">
                            <label className="mac-form-label">{t('linkedIncident') || 'Incidente Vinculado'}</label>
                            <select
                                className="mac-form-input"
                                value={selectedIncident}
                                onChange={e => setSelectedIncident(e.target.value)}
                                style={{ cursor: 'pointer' }}
                            >
                                <option value="" style={{ background: '#0f172a' }}>{t('noneOption') || '-- Ninguno --'}</option>
                                {incidents.map(i => <option key={i.record_id} value={i.record_id} style={{ background: '#0f172a' }}>{i.tablet_incident_number ? `[${i.tablet_incident_number}] ` : ''}{i.title}</option>)}
                            </select>
                        </div>

                        <div className="mac-modal-actions" style={{ marginTop: '1.25rem' }}>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="mac-btn mac-btn-secondary"
                            >
                                {t('cancelBtn') || 'Cancelar'}
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveZone}
                                className="mac-btn mac-btn-primary"
                            >
                                {editingZoneId ? (t('updateBtn') || 'Actualizar Zona') : (t('saveBtn') || 'Guardar Zona')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
