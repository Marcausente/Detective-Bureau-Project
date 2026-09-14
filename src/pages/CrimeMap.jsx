import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabaseClient';
import GTAVMap from '../assets/GTAV-HD-MAP-satellite.jpg';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import '../doc_styles.css';

// Fix default Leaflet icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const EMOJI_PRESETS = [
    '🔫', '💊', '🚗', '🏠', '⚠️', '🕵️', '💀', '⚔️', '💰', '👑', '🎯', '🛡️', '📍', '🚨',
    '🩸', '🔥', '🔪', '🧨', '🚁', '📦', '🏢', '🏴', '🛑', '👀', '⚖️', '🎲', '🏍️', '💉'
];
const COLOR_PRESETS = [
    { name: 'Rojo Peligro', hex: '#ef4444' },
    { name: 'Naranja Alerta', hex: '#f97316' },
    { name: 'Amarillo Cautela', hex: '#eab308' },
    { name: 'Verde Seguro', hex: '#10b981' },
    { name: 'Cian Táctico', hex: '#06b6d4' },
    { name: 'Azul Vigilancia', hex: '#3b82f6' },
    { name: 'Púrpura Especial', hex: '#a855f7' },
    { name: 'Rosa Cártel', hex: '#ec4899' },
    { name: 'Blanco Neutro', hex: '#ffffff' }
];

export default function CrimeMap() {
    const { t } = useLanguage();
    const { isLSSD } = useTheme();
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const layerGroupRef = useRef(null);
    const drawingLayerRef = useRef(null);
    const polygonsMapRef = useRef({});

    // State
    const [zones, setZones] = useState([]);
    const [authorized, setAuthorized] = useState(false);
    const [isGU, setIsGU] = useState(false);
    const [mode, setMode] = useState('view'); // 'view', 'draw'
    const [drawingPoints, setDrawingPoints] = useState([]);
    const [cursorCoords, setCursorCoords] = useState(null);

    // Navigation & UI States
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all'); // 'all' | 'gang' | 'surveillance' | 'public' | 'cases'
    const [showSidebar, setShowSidebar] = useState(true);
    const [selectedZoneId, setSelectedZoneId] = useState(null);

    // Form State for Create/Edit Modal
    const [tempZoneData, setTempZoneData] = useState({
        name: '',
        description: '',
        color: '#ef4444',
        is_gang_zone: false,
        emoji: '',
        is_surveillance: false
    });
    const [showModal, setShowModal] = useState(false);
    const [editingZoneId, setEditingZoneId] = useState(null);

    // Dropdown Data
    const [gangs, setGangs] = useState([]);
    const [cases, setCases] = useState([]);
    const [incidents, setIncidents] = useState([]);
    const [selectedGang, setSelectedGang] = useState('');
    const [selectedCase, setSelectedCase] = useState('');
    const [selectedIncident, setSelectedIncident] = useState('');

    // Refs for closures
    const modeRef = useRef(mode);
    useEffect(() => { modeRef.current = mode; }, [mode]);
    const drawingPointsRef = useRef(drawingPoints);
    useEffect(() => { drawingPointsRef.current = drawingPoints; }, [drawingPoints]);

    useEffect(() => {
        checkAuth();
        fetchZones();
        fetchDropdownData();
    }, []);

    // Initialize Leaflet Map
    useEffect(() => {
        if (!mapInstanceRef.current && mapContainerRef.current) {
            const bounds = [[0, 0], [8192, 8192]];

            const map = L.map(mapContainerRef.current, {
                crs: L.CRS.Simple,
                minZoom: -3,
                maxZoom: 2,
                zoom: -1,
                center: [4096, 4096],
                maxBounds: bounds,
                maxBoundsViscosity: 0.8,
                zoomControl: false,
                attributionControl: false
            });

            L.imageOverlay(GTAVMap, bounds).addTo(map);

            layerGroupRef.current = L.layerGroup().addTo(map);
            drawingLayerRef.current = L.layerGroup().addTo(map);

            // Live Coordinate Tracker
            map.on('mousemove', (e) => {
                const y = Math.round(e.latlng.lat);
                const x = Math.round(e.latlng.lng);
                setCursorCoords({ y, x });
            });

            map.on('mouseout', () => {
                setCursorCoords(null);
            });

            // Map Click for Drawing
            map.on('click', (e) => {
                if (modeRef.current === 'draw') {
                    const newPoint = [e.latlng.lat, e.latlng.lng];
                    setDrawingPoints(prev => [...prev, newPoint]);
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

    const checkAuth = async () => {
        try {
            const { data: authData } = await supabase.rpc('auth_is_gang_authorized');
            setAuthorized(!!authData);

            const { data: guData } = await supabase.rpc('auth_is_gang_unit_member');
            setIsGU(!!guData);
        } catch (e) {
            console.error('Auth error:', e);
        }
    };

    const fetchZones = async () => {
        try {
            const { data, error } = await supabase.rpc('get_map_zones');
            if (error) throw error;
            setZones(data || []);
        } catch (e) {
            console.error('Error fetching zones:', e);
        }
    };

    const fetchDropdownData = async () => {
        try {
            const { data: gangsData } = await supabase.rpc('get_gangs_data');
            if (gangsData) setGangs(gangsData);

            const { data: casesData } = await supabase.rpc('get_cases');
            if (casesData) setCases(casesData);

            const { data: incidentsData } = await supabase.rpc('get_incidents_v2');
            if (incidentsData) setIncidents(incidentsData);
        } catch (e) {
            console.error('Error fetching dropdowns:', e);
        }
    };

    // Render Polygons when zones or auth changes
    useEffect(() => {
        if (!mapInstanceRef.current || !layerGroupRef.current) return;

        layerGroupRef.current.clearLayers();
        polygonsMapRef.current = {};

        zones.forEach(zone => {
            if (!zone.coordinates || zone.coordinates.length < 3) return;

            const isSurveillance = zone.is_surveillance;
            const color = zone.color || '#ef4444';

            // Custom Polygon Style
            const poly = L.polygon(zone.coordinates, {
                color: color,
                weight: isSurveillance ? 2 : 2.5,
                dashArray: isSurveillance ? '6, 8' : null,
                fillColor: color,
                fillOpacity: isSurveillance ? 0.15 : 0.28,
                className: 'tactical-zone-polygon'
            });

            // Hover interactions
            poly.on('mouseover', function () {
                this.setStyle({
                    weight: 3.5,
                    fillOpacity: isSurveillance ? 0.35 : 0.45
                });
            });

            poly.on('mouseout', function () {
                this.setStyle({
                    weight: isSurveillance ? 2 : 2.5,
                    fillOpacity: isSurveillance ? 0.15 : 0.28
                });
            });

            poly.on('click', () => {
                setSelectedZoneId(zone.id);
            });

            // Rich Popup Content
            const popupContent = document.createElement('div');
            popupContent.className = 'tactical-popup-container';

            const gangBadge = zone.is_gang_zone ? `<span class="tactical-badge gang">🚨 BANDA PÚBLICA</span>` : '';
            const survBadge = zone.is_surveillance ? `<span class="tactical-badge surveillance">📡 VIGILANCIA</span>` : '';
            const caseBadge = zone.case_name ? `<span class="tactical-badge case">📁 ${zone.case_name}</span>` : '';
            const incidentBadge = zone.incident_name ? `<span class="tactical-badge incident">⚡ ${zone.incident_name}</span>` : '';
            const gangNameBadge = zone.gang_name ? `<span class="tactical-badge gang-name">🏴 ${zone.gang_name}</span>` : '';

            popupContent.innerHTML = `
                <div class="tactical-popup-header" style="border-left: 4px solid ${color};">
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${zone.emoji ? `<span class="tactical-emoji-icon">${zone.emoji}</span>` : ''}
                        <h4 class="tactical-popup-title">${zone.name || 'Zona Sin Título'}</h4>
                    </div>
                    <div class="tactical-badge-group">
                        ${gangBadge}
                        ${survBadge}
                        ${gangNameBadge}
                        ${caseBadge}
                        ${incidentBadge}
                    </div>
                </div>
                ${zone.description ? `<p class="tactical-popup-desc">${zone.description}</p>` : ''}
                <div class="tactical-popup-meta">
                    <span>POLÍGONO: ${zone.coordinates.length} VÉRTICES</span>
                </div>
            `;

            if (authorized) {
                const actionsContainer = document.createElement('div');
                actionsContainer.className = 'tactical-popup-actions';

                const editBtn = document.createElement('button');
                editBtn.className = 'tactical-popup-btn edit';
                editBtn.innerHTML = `✏️ Modificar`;
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    poly.closePopup();
                    handleEditZone(zone);
                };

                const delBtn = document.createElement('button');
                delBtn.className = 'tactical-popup-btn delete';
                delBtn.innerHTML = `🗑️ Eliminar`;
                delBtn.onclick = (e) => {
                    e.stopPropagation();
                    poly.closePopup();
                    handleDeleteZone(zone.id);
                };

                actionsContainer.appendChild(editBtn);
                actionsContainer.appendChild(delBtn);
                popupContent.appendChild(actionsContainer);
            }

            poly.bindPopup(popupContent, {
                className: 'tactical-popup',
                maxWidth: 320
            });

            poly.addTo(layerGroupRef.current);
            polygonsMapRef.current[zone.id] = poly;

            // Semi-transparent center emoji marker on map
            if (zone.emoji) {
                const center = poly.getBounds().getCenter();
                const emojiIcon = L.divIcon({
                    className: 'tactical-map-center-emoji',
                    html: `<span class="tactical-map-emoji-inner" title="${zone.name || 'Zona'}">${zone.emoji}</span>`,
                    iconSize: [0, 0]
                });
                const emojiMarker = L.marker(center, { icon: emojiIcon });
                emojiMarker.on('click', () => {
                    poly.openPopup();
                    setSelectedZoneId(zone.id);
                });
                emojiMarker.addTo(layerGroupRef.current);
            }
        });
    }, [zones, authorized]);

    // Handle Active Drawing Visuals
    useEffect(() => {
        if (!drawingLayerRef.current) return;
        drawingLayerRef.current.clearLayers();

        if (drawingPoints.length > 0) {
            // Draw points
            drawingPoints.forEach((pt, idx) => {
                const marker = L.circleMarker(pt, {
                    radius: 5,
                    color: '#06b6d4',
                    fillColor: '#38bdf8',
                    fillOpacity: 1,
                    weight: 2
                });
                marker.bindTooltip(`Punto #${idx + 1}`, { permanent: false, direction: 'top' });
                marker.addTo(drawingLayerRef.current);
            });

            // Draw connecting lines or polygon preview
            if (drawingPoints.length >= 2) {
                const polyline = L.polyline(drawingPoints, {
                    color: '#38bdf8',
                    weight: 3,
                    dashArray: '6, 6'
                });
                polyline.addTo(drawingLayerRef.current);
            }
            if (drawingPoints.length >= 3) {
                const polygon = L.polygon(drawingPoints, {
                    color: '#38bdf8',
                    fillColor: '#38bdf8',
                    fillOpacity: 0.25,
                    weight: 2
                });
                polygon.addTo(drawingLayerRef.current);
            }
        }
    }, [drawingPoints]);

    // Fly to zone
    const handleFlyToZone = (zoneId) => {
        setSelectedZoneId(zoneId);
        const poly = polygonsMapRef.current[zoneId];
        if (poly && mapInstanceRef.current) {
            mapInstanceRef.current.fitBounds(poly.getBounds(), {
                padding: [80, 80],
                maxZoom: 0.5,
                animate: true,
                duration: 0.8
            });
            setTimeout(() => {
                poly.openPopup();
            }, 400);
        }
    };

    // Filtered Zones List
    const filteredZones = useMemo(() => {
        return zones.filter(z => {
            const matchesSearch = !searchQuery ||
                (z.name && z.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (z.description && z.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (z.gang_name && z.gang_name.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;

            if (filterType === 'gang') return z.is_gang_zone || !!z.gang_name;
            if (filterType === 'surveillance') return z.is_surveillance;
            if (filterType === 'public') return z.is_gang_zone;
            if (filterType === 'cases') return !!z.case_name || !!z.incident_name;
            return true;
        });
    }, [zones, searchQuery, filterType]);

    // Drawing Controls
    const startDrawing = () => {
        setDrawingPoints([]);
        setMode('draw');
    };

    const cancelDrawing = () => {
        setDrawingPoints([]);
        setMode('view');
    };

    const undoLastPoint = () => {
        setDrawingPoints(prev => prev.slice(0, -1));
    };

    const finishDrawing = () => {
        if (drawingPoints.length < 3) {
            alert('Se necesitan al menos 3 puntos para formar un polígono válido.');
            return;
        }
        setEditingZoneId(null);
        setTempZoneData({
            name: '',
            description: '',
            color: '#ef4444',
            is_gang_zone: false,
            emoji: '⚠️',
            is_surveillance: false
        });
        setSelectedGang('');
        setSelectedCase('');
        setSelectedIncident('');
        setShowModal(true);
    };

    const handleEditZone = (zone) => {
        setEditingZoneId(zone.id);
        setTempZoneData({
            name: zone.name || '',
            description: zone.description || '',
            color: zone.color || '#ef4444',
            is_gang_zone: !!zone.is_gang_zone,
            emoji: zone.emoji || '',
            is_surveillance: !!zone.is_surveillance
        });
        setSelectedGang(zone.gang_id || '');
        setSelectedCase(zone.case_id || '');
        setSelectedIncident(zone.incident_id || '');
        setShowModal(true);
    };

    const handleDeleteZone = async (id) => {
        if (!window.confirm('¿Confirmas que deseas eliminar esta zona táctica? Esta acción no se puede deshacer.')) return;
        try {
            const { error } = await supabase.rpc('delete_map_zone', { p_id: id });
            if (error) throw error;
            await fetchZones();
        } catch (e) {
            console.error('Error deleting zone:', e);
            alert('Error al eliminar la zona: ' + e.message);
        }
    };

    const handleSaveZoneModal = async (e) => {
        e.preventDefault();
        try {
            if (editingZoneId) {
                // Update
                const { error } = await supabase.rpc('update_map_zone', {
                    p_id: editingZoneId,
                    p_name: tempZoneData.name,
                    p_description: tempZoneData.description,
                    p_color: tempZoneData.color,
                    p_is_gang_zone: tempZoneData.is_gang_zone,
                    p_emoji: tempZoneData.emoji,
                    p_is_surveillance: tempZoneData.is_surveillance,
                    p_gang_id: selectedGang || null,
                    p_case_id: selectedCase || null,
                    p_incident_id: selectedIncident || null
                });
                if (error) throw error;
            } else {
                // Create
                const { error } = await supabase.rpc('create_map_zone', {
                    p_name: tempZoneData.name,
                    p_description: tempZoneData.description,
                    p_color: tempZoneData.color,
                    p_coordinates: drawingPoints,
                    p_is_gang_zone: tempZoneData.is_gang_zone,
                    p_emoji: tempZoneData.emoji,
                    p_is_surveillance: tempZoneData.is_surveillance,
                    p_gang_id: selectedGang || null,
                    p_case_id: selectedCase || null,
                    p_incident_id: selectedIncident || null
                });
                if (error) throw error;
            }

            setShowModal(false);
            setMode('view');
            setDrawingPoints([]);
            await fetchZones();
        } catch (e) {
            console.error('Error saving zone:', e);
            alert('Error al guardar la zona: ' + e.message);
        }
    };

    const recenterMap = () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([4096, 4096], -1, { animate: true });
        }
    };

    return (
        <div className="tactical-map-wrapper">
            {/* TACTICAL HUD TOP BAR */}
            <header className="tactical-hud-bar">
                <div className="tactical-hud-left">
                    <div className="tactical-sat-badge">
                        <span className="tactical-live-dot"></span>
                        SATÉLITE INTEL SAN ANDREAS
                    </div>

                    {cursorCoords && (
                        <div className="tactical-coords-chip">
                            <span style={{ color: '#38bdf8' }}>Y:</span> {cursorCoords.y}
                            <span style={{ color: '#38bdf8', marginLeft: '6px' }}>X:</span> {cursorCoords.x}
                        </div>
                    )}
                </div>

                <div className="tactical-hud-right">
                    {/* Zones Counter */}
                    <div className="tactical-badge-counter">
                        <span style={{ color: '#94a3b8' }}>Zonas Activas:</span>
                        <strong style={{ color: '#38bdf8' }}>{zones.length}</strong>
                    </div>

                    {/* Recenter button */}
                    <button
                        onClick={recenterMap}
                        className="tactical-btn tactical-btn-secondary"
                        title="Centrar Mapa"
                    >
                        <span>🎯</span> Centrar
                    </button>

                    {/* Toggle Sidebar */}
                    <button
                        onClick={() => setShowSidebar(prev => !prev)}
                        className={`tactical-btn ${showSidebar ? 'tactical-btn-active' : 'tactical-btn-secondary'}`}
                    >
                        <span>📂</span> {showSidebar ? 'Ocultar Panel' : 'Directorio de Zonas'}
                    </button>

                    {/* Draw Zone Button (Auth only) */}
                    {authorized && mode === 'view' && (
                        <button
                            onClick={startDrawing}
                            className="tactical-btn tactical-btn-primary"
                        >
                            <span>➕</span> Trazar Zona
                        </button>
                    )}
                </div>
            </header>

            {/* MAIN MAP WORKSPACE */}
            <div className="tactical-map-viewport">
                {/* LEAFLET CANVAS */}
                <div ref={mapContainerRef} className="tactical-map-canvas" />

                {/* DRAWING MODE HUD BANNER */}
                {mode === 'draw' && (
                    <div className="tactical-drawing-banner">
                        <div className="tactical-drawing-pill">
                            <span>📐</span>
                            <span>
                                Modo Trazado Activo: Haz clic en el mapa para marcar vértices ({drawingPoints.length} puntos)
                            </span>
                        </div>
                        <div className="tactical-drawing-actions">
                            <button
                                onClick={undoLastPoint}
                                disabled={drawingPoints.length === 0}
                                className="tactical-btn tactical-btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '0.72rem', opacity: drawingPoints.length === 0 ? 0.4 : 1 }}
                            >
                                ↩️ Deshacer Punto
                            </button>
                            <button
                                onClick={finishDrawing}
                                disabled={drawingPoints.length < 3}
                                className="tactical-btn"
                                style={{
                                    padding: '4px 12px',
                                    fontSize: '0.72rem',
                                    background: '#059669',
                                    color: '#ffffff',
                                    opacity: drawingPoints.length < 3 ? 0.4 : 1
                                }}
                            >
                                ✅ Finalizar y Guardar
                            </button>
                            <button
                                onClick={cancelDrawing}
                                className="tactical-btn"
                                style={{
                                    padding: '4px 10px',
                                    fontSize: '0.72rem',
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    borderColor: 'rgba(239, 68, 68, 0.5)',
                                    color: '#f87171'
                                }}
                            >
                                ✖ Cancelar
                            </button>
                        </div>
                    </div>
                )}

                {/* FLOATING ZOOM & QUICK ACTIONS DOCK */}
                <div className="tactical-zoom-dock">
                    <button
                        onClick={() => mapInstanceRef.current?.zoomIn()}
                        className="tactical-dock-btn"
                        title="Acercar Satélite"
                    >
                        ➕
                    </button>
                    <button
                        onClick={() => mapInstanceRef.current?.zoomOut()}
                        className="tactical-dock-btn"
                        title="Alejar Satélite"
                    >
                        ➖
                    </button>
                    <button
                        onClick={recenterMap}
                        className="tactical-dock-btn"
                        style={{ fontSize: '13px' }}
                        title="Vista General"
                    >
                        🌍
                    </button>
                </div>

                {/* COLLAPSIBLE ZONE DIRECTORY SIDEBAR */}
                {showSidebar && (
                    <aside className="tactical-sidebar">
                        <div className="tactical-sidebar-header">
                            <div className="tactical-sidebar-title-row">
                                <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <span style={{ color: '#38bdf8' }}>🗺️</span> Zonas & Jurisdicciones
                                </h3>
                                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.4)', color: '#38bdf8', fontFamily: 'monospace' }}>
                                    {filteredZones.length} / {zones.length}
                                </span>
                            </div>

                            {/* Search bar */}
                            <div className="tactical-search-wrap">
                                <span className="tactical-search-icon">🔍</span>
                                <input
                                    type="text"
                                    placeholder="Buscar zona, banda o caso..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="tactical-search-input"
                                />
                            </div>

                            {/* Filter Pills */}
                            <div className="tactical-filter-container">
                                {[
                                    { id: 'all', label: 'Todas' },
                                    { id: 'gang', label: 'Bandas' },
                                    { id: 'surveillance', label: 'Vigilancia' },
                                    { id: 'public', label: 'Públicas' },
                                    { id: 'cases', label: 'Casos/Inc.' }
                                ].map(f => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setFilterType(f.id)}
                                        className={`tactical-filter-pill ${filterType === f.id ? 'active' : ''}`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Zone List Scrollable */}
                        <div className="tactical-sidebar-list custom-scrollbar">
                            {filteredZones.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b', fontSize: '0.78rem' }}>
                                    No se encontraron zonas coincidentes.
                                </div>
                            ) : (
                                filteredZones.map(zone => {
                                    const isSelected = selectedZoneId === zone.id;
                                    return (
                                        <div
                                            key={zone.id}
                                            onClick={() => handleFlyToZone(zone.id)}
                                            className={`tactical-zone-row ${isSelected ? 'active' : ''}`}
                                        >
                                            <div
                                                style={{
                                                    width: '12px',
                                                    height: '12px',
                                                    borderRadius: '50%',
                                                    marginTop: '3px',
                                                    flexShrink: 0,
                                                    backgroundColor: zone.color || '#ef4444',
                                                    border: '1px solid rgba(255,255,255,0.3)',
                                                    boxShadow: '0 0 6px ' + (zone.color || '#ef4444')
                                                }}
                                            />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {zone.emoji && <span style={{ marginRight: '4px' }}>{zone.emoji}</span>}
                                                        {zone.name || 'Sin Título'}
                                                    </span>
                                                    <span style={{ fontSize: '0.68rem', color: '#38bdf8', fontFamily: 'monospace', flexShrink: 0 }}>
                                                        Ir ↗
                                                    </span>
                                                </div>

                                                {zone.description && (
                                                    <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {zone.description}
                                                    </p>
                                                )}

                                                {/* Tags */}
                                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                                                    {zone.is_gang_zone && (
                                                        <span className="tactical-badge gang">
                                                            PÚBLICA
                                                        </span>
                                                    )}
                                                    {zone.is_surveillance && (
                                                        <span className="tactical-badge surveillance">
                                                            VIGILANCIA
                                                        </span>
                                                    )}
                                                    {zone.gang_name && (
                                                        <span className="tactical-badge gang-name" style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            🏴 {zone.gang_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </aside>
                )}
            </div>

            {/* CREATE / EDIT ZONE MODAL (macOS Window Style) */}
            {showModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '16px',
                    background: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(8px)',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div className="apple-window-mac modal-animate" style={{
                        width: '100%',
                        maxWidth: '520px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
                        background: '#0f172a',
                        borderRadius: '16px'
                    }}>
                        {/* Apple Title Bar */}
                        <div className="apple-mac-titlebar" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            background: 'rgba(15, 23, 42, 0.95)',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                        }}>
                            <div className="apple-mac-dots" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button onClick={() => setShowModal(false)} className="apple-dot apple-dot-close" title="Cerrar" />
                                <button className="apple-dot apple-dot-minimize" />
                                <button className="apple-dot apple-dot-expand" />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>
                                {editingZoneId ? '⚙️ MODIFICAR ZONA TÁCTICA' : '➕ REGISTRAR NUEVA ZONA'}
                            </span>
                            <div style={{ width: '48px' }}></div>
                        </div>

                        <form onSubmit={handleSaveZoneModal} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '80vh', overflowY: 'auto' }} className="custom-scrollbar">
                            {/* Name & Emoji */}
                            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '10px' }}>
                                <div className="mac-form-group">
                                    <label className="mac-form-label">Nombre de la Zona *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ej. Barrio Davis - Territorio Aztecas"
                                        value={tempZoneData.name}
                                        onChange={(e) => setTempZoneData({ ...tempZoneData, name: e.target.value })}
                                        className="mac-form-input"
                                    />
                                </div>
                                <div className="mac-form-group">
                                    <label className="mac-form-label">Emoji / Icono</label>
                                    <input
                                        type="text"
                                        maxLength={4}
                                        placeholder="⚠️"
                                        value={tempZoneData.emoji}
                                        onChange={(e) => setTempZoneData({ ...tempZoneData, emoji: e.target.value })}
                                        className="mac-form-input"
                                        style={{ textAlign: 'center', fontSize: '1.1rem' }}
                                    />
                                </div>
                            </div>

                            {/* Quick Emoji Presets */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                {EMOJI_PRESETS.map((em) => (
                                    <button
                                        key={em}
                                        type="button"
                                        onClick={() => setTempZoneData({ ...tempZoneData, emoji: em })}
                                        style={{
                                            width: '32px',
                                            height: '32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1rem',
                                            borderRadius: '6px',
                                            background: tempZoneData.emoji === em ? 'rgba(6, 182, 212, 0.25)' : 'rgba(255,255,255,0.05)',
                                            border: tempZoneData.emoji === em ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.1)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {em}
                                    </button>
                                ))}
                            </div>

                            {/* Description */}
                            <div className="mac-form-group">
                                <label className="mac-form-label">Descripción / Observaciones</label>
                                <textarea
                                    rows={2}
                                    placeholder="Actividades delictivas frecuentes, puntos de control, información adicional..."
                                    value={tempZoneData.description}
                                    onChange={(e) => setTempZoneData({ ...tempZoneData, description: e.target.value })}
                                    className="mac-form-input"
                                    style={{ resize: 'vertical' }}
                                />
                            </div>

                            {/* Color Selector */}
                            <div className="mac-form-group">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <label className="mac-form-label" style={{ margin: 0 }}>Color Táctico</label>
                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                                        {tempZoneData.color || '#ef4444'}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {COLOR_PRESETS.map(c => (
                                        <button
                                            key={c.hex}
                                            type="button"
                                            onClick={() => setTempZoneData({ ...tempZoneData, color: c.hex })}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer',
                                                background: tempZoneData.color?.toLowerCase() === c.hex.toLowerCase() ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.4)',
                                                border: tempZoneData.color?.toLowerCase() === c.hex.toLowerCase() ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                                                color: '#f1f5f9'
                                            }}
                                        >
                                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: c.hex }} />
                                            <span>{c.name}</span>
                                        </button>
                                    ))}

                                    {/* Custom Color Picker Button */}
                                    <label
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '4px 10px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            cursor: 'pointer',
                                            background: !COLOR_PRESETS.some(c => c.hex.toLowerCase() === tempZoneData.color?.toLowerCase()) ? 'rgba(56, 189, 248, 0.2)' : 'rgba(0, 0, 0, 0.4)',
                                            border: !COLOR_PRESETS.some(c => c.hex.toLowerCase() === tempZoneData.color?.toLowerCase()) ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                                            color: '#f1f5f9',
                                            userSelect: 'none'
                                        }}
                                        title="Elegir cualquier color personalizado"
                                    >
                                        <input
                                            type="color"
                                            value={tempZoneData.color || '#ef4444'}
                                            onChange={(e) => setTempZoneData({ ...tempZoneData, color: e.target.value })}
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                padding: 0,
                                                border: 'none',
                                                borderRadius: '50%',
                                                cursor: 'pointer',
                                                background: 'transparent'
                                            }}
                                        />
                                        <span>🎨 Personalizado</span>
                                    </label>
                                </div>
                            </div>

                            {/* Linking Dropdowns */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                <div className="mac-form-group">
                                    <label className="mac-form-label">Banda Asociada</label>
                                    <select
                                        value={selectedGang}
                                        onChange={(e) => setSelectedGang(e.target.value)}
                                        className="mac-form-input"
                                    >
                                        <option value="" style={{ background: '#0f172a' }}>-- Ninguna --</option>
                                        {gangs.map(g => (
                                            <option key={g.id || g.gang_id} value={g.id || g.gang_id} style={{ background: '#0f172a' }}>{g.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">Caso Vinculado</label>
                                    <select
                                        value={selectedCase}
                                        onChange={(e) => setSelectedCase(e.target.value)}
                                        className="mac-form-input"
                                    >
                                        <option value="" style={{ background: '#0f172a' }}>-- Ninguno --</option>
                                        {cases.map(c => (
                                            <option key={c.id} value={c.id} style={{ background: '#0f172a' }}>#{c.case_number || c.id} {c.title || ''}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="mac-form-group">
                                    <label className="mac-form-label">Incidente</label>
                                    <select
                                        value={selectedIncident}
                                        onChange={(e) => setSelectedIncident(e.target.value)}
                                        className="mac-form-input"
                                    >
                                        <option value="" style={{ background: '#0f172a' }}>-- Ninguno --</option>
                                        {incidents.map(i => (
                                            <option key={i.id || i.record_id} value={i.id || i.record_id} style={{ background: '#0f172a' }}>{i.title || `Incidente #${i.id || i.record_id}`}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Flags */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={tempZoneData.is_gang_zone}
                                        onChange={(e) => setTempZoneData({ ...tempZoneData, is_gang_zone: e.target.checked })}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                    <div>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>Zona Pública</span>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '0.68rem', color: '#94a3b8' }}>Visible en el portal ciudadano</p>
                                    </div>
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={tempZoneData.is_surveillance}
                                        onChange={(e) => setTempZoneData({ ...tempZoneData, is_surveillance: e.target.checked })}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                    <div>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ffffff' }}>Vigilancia Especial</span>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '0.68rem', color: '#94a3b8' }}>Perímetro discontinuo encubierto</p>
                                    </div>
                                </label>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '6px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="mac-btn mac-btn-secondary"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="mac-btn mac-btn-primary"
                                >
                                    {editingZoneId ? 'Guardar Cambios' : 'Confirmar y Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
