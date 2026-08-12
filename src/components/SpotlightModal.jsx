import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function SpotlightModal({ isOpen, onClose, navItems, handleLogout }) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const navigate = useNavigate();

    // Auto-focus input when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    // Build searchable list
    const items = [
        ...navItems.map(item => ({
            id: item.path,
            title: item.name,
            subtitle: `Ir a ${item.name}`,
            type: 'navigation',
            path: item.path,
            action: () => {
                navigate(item.path);
                onClose();
            }
        })),
        {
            id: '/profile',
            title: 'Editar Perfil',
            subtitle: 'Configuración de cuenta y avatar',
            type: 'navigation',
            path: '/profile',
            action: () => {
                navigate('/profile');
                onClose();
            }
        },
        {
            id: 'logout',
            title: 'Cerrar Sesión',
            subtitle: 'Salir del sistema de forma segura',
            type: 'action',
            action: () => {
                onClose();
                handleLogout();
            }
        }
    ];

    // Filter items by query
    const filteredItems = items.filter(item => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return item.title.toLowerCase().includes(q) || (item.subtitle && item.subtitle.toLowerCase().includes(q));
    });

    // Reset selected index when search query changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Handle Keyboard Navigation
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredItems[selectedIndex]) {
                    filteredItems[selectedIndex].action();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredItems, selectedIndex]);

    if (!isOpen) return null;

    return (
        <div className="mac-spotlight-backdrop" onClick={onClose}>
            <div className="mac-spotlight-modal" onClick={(e) => e.stopPropagation()}>
                {/* Spotlight Header Search Input */}
                <div className="mac-spotlight-search-header">
                    <svg className="mac-spotlight-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        ref={inputRef}
                        type="text"
                        className="mac-spotlight-input"
                        placeholder="Buscar sección o comando en el sistema..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="mac-spotlight-esc-badge" onClick={onClose}>ESC</div>
                </div>

                {/* Search Results List */}
                <div className="mac-spotlight-results">
                    {filteredItems.length > 0 ? (
                        filteredItems.map((item, idx) => (
                            <div
                                key={item.id}
                                className={`mac-spotlight-item ${idx === selectedIndex ? 'selected' : ''}`}
                                onClick={item.action}
                                onMouseEnter={() => setSelectedIndex(idx)}
                            >
                                <div className="mac-spotlight-item-icon">
                                    {item.type === 'action' ? (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                                            <line x1="12" y1="2" x2="12" y2="12" />
                                        </svg>
                                    ) : (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <polyline points="12 8 12 12 14 14" />
                                        </svg>
                                    )}
                                </div>
                                <div className="mac-spotlight-item-content">
                                    <span className="mac-spotlight-item-title">{item.title}</span>
                                    <span className="mac-spotlight-item-sub">{item.subtitle}</span>
                                </div>
                                {idx === selectedIndex && (
                                    <span className="mac-spotlight-enter-hint">↵ Abrir</span>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="mac-spotlight-empty">
                            No se encontraron resultados para &quot;{query}&quot;
                        </div>
                    )}
                </div>

                {/* Footer Controls Info */}
                <div className="mac-spotlight-footer">
                    <span><kbd>↑</kbd> <kbd>↓</kbd> Navegar</span>
                    <span><kbd>↵</kbd> Seleccionar</span>
                    <span><kbd>ESC</kbd> Cerrar</span>
                </div>
            </div>
        </div>
    );
}

export default SpotlightModal;
