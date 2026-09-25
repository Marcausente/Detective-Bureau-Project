import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabaseClient';
import GTAVMap from '../assets/GTAV-HD-MAP-satellite.jpg';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import '../doc_styles.css';

// Fix default icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function PublicGangMap() {
    const { t } = useLanguage();
    const { isLSSD, branding } = useTheme();
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const layerGroupRef = useRef(null);
    const polygonsMapRef = useRef({});

    const [zones, setZones] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSidebar, setShowSidebar] = useState(true);
    const [selectedZoneId, setSelectedZoneId] = useState(null);

    useEffect(() => {
        if (!mapInstanceRef.current && mapContainerRef.current) {
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
                maxBoundsViscosity: 0.9,
                bounceAtZoomLimits: false
            });

            L.imageOverlay(GTAVMap, bounds).addTo(map);

            layerGroupRef.current = L.layerGroup().addTo(map);
            mapInstanceRef.current = map;
        }

        fetchPublicZones();

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    const fetchPublicZones = async () => {
        try {
            const { data, error } = await supabase.rpc('get_public_gang_zones');
            if (error) throw error;
            setZones(data || []);
        } catch (e) {
            console.error("Error fetching public zones:", e);
        }
    };

    // Render Layers
    useEffect(() => {
        if (!mapInstanceRef.current || !layerGroupRef.current) return;

        layerGroupRef.current.clearLayers();
        polygonsMapRef.current = {};

        zones.forEach(zone => {
            if (!zone.coordinates || zone.coordinates.length < 3) return;

            const color = zone.color || '#ef4444';
            const poly = L.polygon(zone.coordinates, {
                color: color,
                fillColor: color,
                fillOpacity: 0.35,
                weight: 2.5,
                className: 'tactical-zone-polygon'
            });

            // Modern Public Popup
            const popupContent = document.createElement('div');
            popupContent.className = 'tactical-popup-container';
            popupContent.innerHTML = `
                <div class="tactical-popup-header" style="border-left: 4px solid ${color};">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span class="tactical-emoji-icon">${zone.emoji || '⚠️'}</span>
                        <h4 class="tactical-popup-title" style="color: #f87171;">${zone.name}</h4>
                    </div>
                    <div class="tactical-badge-group">
                        <span class="tactical-badge gang">🚨 ZONA DE ALTO RIESGO</span>
                    </div>
                </div>
                ${zone.description ? `<p class="tactical-popup-desc" style="color: #cbd5e1;">${zone.description}</p>` : '<p class="tactical-popup-desc" style="color: #64748b;">Se recomienda extrema precaución en este perímetro.</p>'}
                <div class="tactical-popup-meta" style="color: #94a3b8;">
                    <span>ADVERTENCIA CIUDADANA • LSPD / LSSD</span>
                </div>
            `;

            poly.bindPopup(popupContent, {
                className: 'tactical-popup',
                maxWidth: 300
            });

            poly.on('mouseover', function () {
                this.setStyle({ fillOpacity: 0.55, weight: 3.5 });
            });
            poly.on('mouseout', function () {
                this.setStyle({ fillOpacity: 0.35, weight: 2.5 });
            });
            poly.on('click', () => {
                setSelectedZoneId(zone.id);
            });

            poly.addTo(layerGroupRef.current);
            polygonsMapRef.current[zone.id] = poly;

            // Semi-transparent center emoji marker on public map
            const emojiToDisplay = zone.emoji || '⚠️';
            const center = poly.getBounds().getCenter();
            const emojiIcon = L.divIcon({
                className: 'tactical-map-center-emoji',
                html: `<span class="tactical-map-emoji-inner" title="${zone.name || 'Zona de Riesgo'}">${emojiToDisplay}</span>`,
                iconSize: [0, 0]
            });
            const emojiMarker = L.marker(center, { icon: emojiIcon });
            emojiMarker.on('click', () => {
                poly.openPopup();
                setSelectedZoneId(zone.id);
            });
            emojiMarker.addTo(layerGroupRef.current);
        });
    }, [zones]);

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

    const recenterMap = () => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([4096, 4096], -1, { animate: true });
        }
    };

    const filteredZones = useMemo(() => {
        if (!searchQuery) return zones;
        const q = searchQuery.toLowerCase();
        return zones.filter(z =>
            (z.name && z.name.toLowerCase().includes(q)) ||
            (z.description && z.description.toLowerCase().includes(q))
        );
    }, [zones, searchQuery]);

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: '#070b12', color: '#f1f5f9', fontFamily: 'var(--font-family, system-ui, sans-serif)', userSelect: 'none' }}>
            {/* MAP CONTAINER */}
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', outline: 'none', background: '#070b12' }} />

            {/* TOP BRANDING / PUBLIC ADVISORY HUD */}
            <div className="tactical-public-advisory-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {branding?.public_map_logo ? (
                        <img 
                            src={branding.public_map_logo} 
                            alt="Logo" 
                            style={{ height: '36px', width: 'auto', objectFit: 'contain', borderRadius: '4px' }} 
                        />
                    ) : (
                        <span className="tactical-danger-dot"></span>
                    )}
                    <div>
                        <h1 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>🛡️</span> {branding?.public_map_title || t('publicDangerMap') || 'MAPA DE ADVERTENCIA DE RIESGO'}
                        </h1>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500 }}>
                            {branding?.public_map_dept || (isLSSD ? "Los Santos County Sheriff's Department" : 'Los Santos Police Department')} • Seguridad Pública
                        </p>
                    </div>
                </div>

                <p style={{ margin: 0, fontSize: '0.75rem', color: '#e2e8f0', lineHeight: '1.4', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                    {t('publicMapDesc') || 'Este mapa delimita zonas de riesgo prioritario y actividad delictiva registrada. Se recomienda a la ciudadanía mantener la cautela al transitar por estos perímetros.'}
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '8px', fontSize: '0.72rem' }}>
                    <span style={{ color: '#f87171', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>⚠️</span> {zones.length} ZONAS DE ALERTA
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowSidebar(prev => !prev)}
                        className="tactical-btn tactical-btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                    >
                        {showSidebar ? 'Ocultar Lista' : 'Ver Zonas'}
                    </button>
                </div>
            </div>

            {/* FLOATING NAVIGATION DOCK */}
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
                    title="Vista General de la Ciudad"
                >
                    🌍
                </button>
            </div>

            {/* SIDEBAR: DANGER ZONES DIRECTORY */}
            {showSidebar && (
                <aside className="tactical-sidebar">
                    <div className="tactical-sidebar-header">
                        <div className="tactical-sidebar-title-row">
                            <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <span style={{ color: '#f87171' }}>🚨</span> Zonas de Riesgo
                            </h3>
                            <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', fontFamily: 'monospace' }}>
                                {filteredZones.length} / {zones.length}
                            </span>
                        </div>

                        {/* Search */}
                        <div className="tactical-search-wrap">
                            <span className="tactical-search-icon">🔍</span>
                            <input
                                type="text"
                                placeholder="Filtrar por nombre o calle..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="tactical-search-input"
                            />
                        </div>
                    </div>

                    {/* Zone Cards */}
                    <div className="tactical-sidebar-list custom-scrollbar">
                        {filteredZones.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 10px', color: '#64748b', fontSize: '0.78rem' }}>
                                No se encontraron zonas que coincidan con la búsqueda.
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
                                                    {zone.name}
                                                </span>
                                                <span style={{ fontSize: '0.68rem', color: '#f87171', fontFamily: 'monospace', flexShrink: 0 }}>
                                                    Explorar ↗
                                                </span>
                                            </div>

                                            {zone.description && (
                                                <p style={{ margin: '3px 0 0 0', fontSize: '0.72rem', color: '#94a3b8', lineHeight: '1.3' }}>
                                                    {zone.description}
                                                </p>
                                            )}

                                            <div style={{ marginTop: '6px' }}>
                                                <span className="tactical-badge gang">
                                                    PRECAUCIÓN
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </aside>
            )}

            {/* BOTTOM EMERGENCY FOOTER */}
            <div className="tactical-public-footer">
                <span style={{ color: '#ef4444', fontWeight: 800 }}>📞 EMERGENCIA:</span>
                <span style={{ color: '#ffffff', fontWeight: 700 }}>911</span>
                <span style={{ color: '#475569' }}>|</span>
                <span>
                    {isLSSD ? "Sheriff Criminal Unit Bureau Public Advisory" : "Detective Bureau Public Information Service"}
                </span>
            </div>
        </div>
    );
}
