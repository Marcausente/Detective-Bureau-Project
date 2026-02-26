import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { dtpService } from '../../services/dtpService';
import '../../index.css';

function PracticeSchedule() {
    const [events, setEvents] = useState([]);
    const [practices, setPractices] = useState([]); // For the dropdown
    const [users, setUsers] = useState([]);         // For organizer selection
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    
    // View state
    const [viewMode, setViewMode] = useState('list'); // 'list', 'create', 'details'
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [attendees, setAttendees] = useState([]);
    
    // Form state -> event scheduling
    const [formData, setFormData] = useState({
        practice_id: '',
        event_date: '',
        event_time: '',
        organizer_id: '',
        notes: ''
    });

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setCurrentUser(session.user);
            }
            if (viewMode === 'list') {
                loadEvents();
            } else if (viewMode === 'create') {
                loadFormData();
            }
        };
        fetchInitialData();
    }, [viewMode]);

    const loadFormData = async () => {
        setLoading(true);
        try {
            const [practicesData, { data: usersData, error: usersError }] = await Promise.all([
                dtpService.getPractices(),
                supabase.from('users').select('id, nombre, apellido, rango, no_placa, rol').order('rango', { ascending: true })
            ]);
            
            if (usersError) throw usersError;
            
            setPractices(practicesData);
            setUsers(usersData);
            
            if (currentUser) {
                setFormData(prev => ({ ...prev, organizer_id: currentUser.id }));
            }
        } catch (err) {
            console.error('Error loading form data:', err);
            setError('Error al cargar datos para programar práctica.');
        } finally {
            setLoading(false);
        }
    };

    const loadEvents = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await dtpService.getEvents();
            setEvents(data);
        } catch (err) {
            console.error('Error loading events:', err);
            setError('Error al cargar la programación.');
        } finally {
            setLoading(false);
        }
    };

    const loadAttendees = async (eventId) => {
        try {
            const data = await dtpService.getEventAttendees(eventId);
            setAttendees(data);
        } catch (err) {
            console.error('Error loading attendees:', err);
            setError('Error al cargar asistentes.');
        }
    };

    const handleActionClick = async (action, eventId) => {
        if (action === 'view') {
            const event = events.find(e => e.id === eventId);
            setSelectedEvent(event);
            await loadAttendees(eventId);
            setViewMode('details');
        } else if (action === 'delete') {
            if (window.confirm('¿Seguro que deseas cancelar/eliminar este evento?')) {
                try {
                    await dtpService.deleteEvent(eventId);
                    setSuccessMessage('Evento eliminado con éxito.');
                    setTimeout(() => setSuccessMessage(null), 3000);
                    loadEvents();
                } catch (err) {
                    console.error('Error deleting event:', err);
                    setError('Error al eliminar evento.');
                }
            }
        }
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        
        if (!formData.practice_id || !formData.event_date || !formData.event_time || !formData.organizer_id) {
            setError('Por favor, rellena todos los campos obligatorios.');
            return;
        }

        try {
            const combinedDateTime = `${formData.event_date}T${formData.event_time}:00`;
            const newEvent = {
                practice_id: formData.practice_id,
                event_date: new Date(combinedDateTime).toISOString(),
                organizer_id: formData.organizer_id,
                status: 'SCHEDULED',
                notes: formData.notes
            };
            
            await dtpService.createEvent(newEvent);
            setSuccessMessage('Práctica programada con éxito.');
            
            setTimeout(() => {
                setSuccessMessage(null);
                setViewMode('list');
            }, 1500);
            
        } catch (err) {
            console.error('Error scheduling event:', err);
            setError('Error al programar la práctica.');
        }
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRegisterToggle = async (eventId, isRegistered) => {
        if (!currentUser) return;
        
        setLoading(true);
        try {
            if (isRegistered) {
                await dtpService.removeAttendee(eventId, currentUser.id);
                setSuccessMessage('Te has dado de baja de la práctica.');
            } else {
                await dtpService.registerAttendee(eventId, currentUser.id);
                setSuccessMessage('Te has apuntado a la práctica.');
            }
            
            setTimeout(() => setSuccessMessage(null), 2000);
            
            // Reload the view data
            if (viewMode === 'details') {
                await loadAttendees(eventId);
            } else {
                await loadEvents();
            }
        } catch (err) {
            console.error('Error toggling registration:', err);
            setError('Error al procesar tu inscripción.');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateAttendeeStatus = async (attendeeId, newStatus) => {
        try {
            await dtpService.updateAttendeeStatus(attendeeId, newStatus);
            if (selectedEvent) {
                await loadAttendees(selectedEvent.id);
            }
        } catch (err) {
            console.error('Error updating status:', err);
            setError('Error al actualizar la asistencia.');
        }
    };

    // Helper functions
    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const isUpcoming = (dateString) => {
        return new Date(dateString) > new Date();
    };

    const upcomingEvents = events.filter(e => isUpcoming(e.event_date));
    const pastEvents = events.filter(e => !isUpcoming(e.event_date));

    // Checks if the current user is registered for a specific event
    const isUserRegistered = (event) => {
        // Since we load events, we don't have attendees data for all in the list view immediately,
        // unless we join it at the DB level. For simplicity, we'll allow registering from the Detail view mostly.
        return attendees.some(a => a.user_id === currentUser?.id && a.event_id === event.id);
    };

    const isUserOrganizer = (userId) => {
      return currentUser && currentUser.id === userId;
    };

    return (
        <div className="practice-schedule-container">
            {error && <div className="error-message">{error}</div>}
            {successMessage && <div className="success-message">{successMessage}</div>}

            {viewMode === 'list' && (
                <>
                    <div className="schedule-header" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                        <button className="primary-btn" onClick={() => setViewMode('create')}>
                            + Programar Práctica
                        </button>
                    </div>

                    {loading ? (
                        <div className="loading-spinner">Cargando eventos...</div>
                    ) : (
                        <div className="events-lists" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            
                            {/* Upcoming Events */}
                            <div className="upcoming-events">
                                <h3 style={{ borderBottom: '1px solid #2d3748', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#e2e8f0' }}>Próximas Prácticas</h3>
                                {upcomingEvents.length === 0 ? (
                                    <p style={{ color: '#a0aec0', fontStyle: 'italic' }}>No hay prácticas programadas próximamente.</p>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
                                        {upcomingEvents.map(event => (
                                            <div key={event.id} className="event-card upcoming" style={{ backgroundColor: '#1e2532', padding: '1.5rem', borderRadius: '8px', borderLeft: '4px solid #48bb78' }}>
                                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#48bb78' }}>{event.practice?.title || 'Práctica Desconocida'}</h4>
                                                <div style={{ color: '#cbd5e0', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                                    <p style={{ margin: '0.2rem 0' }}>📅 {formatDate(event.event_date)}</p>
                                                    <p style={{ margin: '0.2rem 0' }}>👤 Org: {event.organizer ? `${event.organizer.rango} ${event.organizer.nombre} ${event.organizer.apellido}` : 'Sin asignar'}</p>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                    <button className="secondary-btn" onClick={() => handleActionClick('view', event.id)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                                                        Ver Detalles
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Past Events */}
                            <div className="past-events">
                                <h3 style={{ borderBottom: '1px solid #2d3748', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#a0aec0' }}>Historial de Prácticas</h3>
                                {pastEvents.length === 0 ? (
                                    <p style={{ color: '#718096', fontStyle: 'italic' }}>No hay registro de prácticas anteriores.</p>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
                                        {pastEvents.map(event => (
                                            <div key={event.id} className="event-card past" style={{ backgroundColor: '#1a202c', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #718096', opacity: 0.8 }}>
                                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#a0aec0' }}>{event.practice?.title || 'Práctica Desconocida'}</h4>
                                                <div style={{ color: '#718096', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                                    <p style={{ margin: '0.1rem 0' }}>📅 {formatDate(event.event_date)} - Estado: {event.status}</p>
                                                    <p style={{ margin: '0.1rem 0' }}>👤 Org: {event.organizer?.apellido || 'N/A'}</p>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                    <button className="secondary-btn" onClick={() => handleActionClick('view', event.id)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
                                                        Detalles
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {viewMode === 'create' && (
                <div className="create-event-form" style={{ backgroundColor: '#1a1d24', padding: '2rem', borderRadius: '8px', border: '1px solid #2d3748', maxWidth: '600px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ margin: 0, color: '#e2e8f0' }}>Programar Nueva Práctica</h3>
                        <button className="secondary-btn" onClick={() => setViewMode('list')} style={{ padding: '0.4rem 0.8rem' }}>
                            Cancelar
                        </button>
                    </div>

                    <form onSubmit={handleCreateSubmit}>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e0' }}>Seleccionar Práctica del Archivo *</label>
                            <select
                                name="practice_id"
                                value={formData.practice_id}
                                onChange={handleFormChange}
                                required
                                style={{ width: '100%', padding: '0.8rem', backgroundColor: '#0f1115', border: '1px solid #2d3748', color: 'white', borderRadius: '4px' }}
                            >
                                <option value="">-- Selecciona una Práctica --</option>
                                {practices.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e0' }}>Fecha *</label>
                                <input
                                    type="date"
                                    name="event_date"
                                    value={formData.event_date}
                                    onChange={handleFormChange}
                                    required
                                    style={{ width: '100%', padding: '0.8rem', backgroundColor: '#0f1115', border: '1px solid #2d3748', color: 'white', borderRadius: '4px' }}
                                />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e0' }}>Hora *</label>
                                <input
                                    type="time"
                                    name="event_time"
                                    value={formData.event_time}
                                    onChange={handleFormChange}
                                    required
                                    style={{ width: '100%', padding: '0.8rem', backgroundColor: '#0f1115', border: '1px solid #2d3748', color: 'white', borderRadius: '4px' }}
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e0' }}>Organizador Principal *</label>
                            <select
                                name="organizer_id"
                                value={formData.organizer_id}
                                onChange={handleFormChange}
                                required
                                style={{ width: '100%', padding: '0.8rem', backgroundColor: '#0f1115', border: '1px solid #2d3748', color: 'white', borderRadius: '4px' }}
                            >
                                <option value="">-- Selecciona el Organizador --</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.rango} {u.nombre} {u.apellido}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e0' }}>Lugar o Notas Especiales</label>
                            <input
                                type="text"
                                name="notes"
                                value={formData.notes}
                                onChange={handleFormChange}
                                style={{ width: '100%', padding: '0.8rem', backgroundColor: '#0f1115', border: '1px solid #2d3748', color: 'white', borderRadius: '4px' }}
                                placeholder="Ej: Cantera, Requisito Radio, etc."
                            />
                        </div>

                        <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="primary-btn" disabled={loading}>
                                Guardar Programación
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {viewMode === 'details' && selectedEvent && (
                <div className="event-details" style={{ backgroundColor: '#1a1d24', padding: '2rem', borderRadius: '8px', border: '1px solid #2d3748' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid #2d3748', paddingBottom: '1rem' }}>
                        <div>
                            <h2 style={{ margin: '0 0 0.5rem 0', color: '#e2e8f0' }}>{selectedEvent.practice?.title}</h2>
                            <p style={{ margin: 0, color: '#a0aec0' }}>📅 {formatDate(selectedEvent.event_date)}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {isUserOrganizer(selectedEvent.organizer_id) && (
                                <button className="danger-btn" onClick={() => handleActionClick('delete', selectedEvent.id)} style={{ padding: '0.4rem 0.8rem' }}>
                                    Cancelar Evento
                                </button>
                            )}
                            <button className="secondary-btn" onClick={() => setViewMode('list')} style={{ padding: '0.4rem 0.8rem' }}>
                                Volver
                            </button>
                        </div>
                    </div>

                    <div className="details-content" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        {/* Info Column */}
                        <div className="info-column">
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ color: '#cbd5e0', marginBottom: '0.5rem' }}>Detalles de la Práctica</h4>
                                <p style={{ color: '#a0aec0', fontSize: '0.9rem', lineHeight: '1.5' }}>
                                    {selectedEvent.practice?.description || 'Sin descripción detallada.'}
                                </p>
                                {selectedEvent.notes && (
                                    <div style={{ marginTop: '1rem', padding: '0.8rem', backgroundColor: '#2d3748', borderRadius: '4px', borderLeft: '3px solid #4299e1' }}>
                                        <strong style={{ color: '#e2e8f0' }}>Notas del Evento:</strong> <br/>
                                        <span style={{ color: '#cbd5e0' }}>{selectedEvent.notes}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ color: '#cbd5e0', marginBottom: '0.5rem' }}>Organizado Por</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#0f1115', padding: '1rem', borderRadius: '4px', border: '1px solid #2d3748' }}>
                                    <div style={{ fontSize: '1.5rem' }}>👮</div>
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: '#e2e8f0' }}>
                                            {selectedEvent.organizer ? `${selectedEvent.organizer.rango} ${selectedEvent.organizer.nombre} ${selectedEvent.organizer.apellido}` : 'Desconocido'}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#a0aec0' }}>
                                            Placa: {selectedEvent.organizer?.no_placa || 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Materials */}
                            {selectedEvent.practice?.documents_urls && selectedEvent.practice.documents_urls.length > 0 && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <h4 style={{ color: '#cbd5e0', marginBottom: '0.5rem' }}>Material de Apoyo</h4>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                        {selectedEvent.practice.documents_urls.map((url, idx) => (
                                            <li key={idx} style={{ marginBottom: '0.5rem' }}>
                                                <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: '#4299e1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', backgroundColor: '#2d3748', borderRadius: '4px' }}>
                                                    📄 <span>Material de Estudio {idx + 1}</span>
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Attendees Column */}
                        <div className="attendees-column" style={{ backgroundColor: '#0f1115', padding: '1.5rem', borderRadius: '8px', border: '1px solid #2d3748' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h4 style={{ margin: 0, color: '#cbd5e0' }}>Asistentes ({attendees.length})</h4>
                                
                                {isUpcoming(selectedEvent.event_date) && (
                                    <button 
                                        className={isUserRegistered(selectedEvent) ? 'danger-btn' : 'primary-btn'}
                                        onClick={() => handleRegisterToggle(selectedEvent.id, isUserRegistered(selectedEvent))}
                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                    >
                                        {isUserRegistered(selectedEvent) ? 'Me doy de Baja' : '¡Me Apunto!'}
                                    </button>
                                )}
                            </div>

                            {loading ? (
                                <div style={{ textAlign: 'center', color: '#a0aec0', padding: '1rem' }}>Cargando lista...</div>
                            ) : attendees.length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#a0aec0', padding: '2rem 0', fontStyle: 'italic' }}>
                                    Aún no hay agentes apuntados a esta práctica.
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #2d3748', color: '#a0aec0', textAlign: 'left' }}>
                                            <th style={{ padding: '0.5rem' }}>Agente</th>
                                            <th style={{ padding: '0.5rem' }}>Estado</th>
                                            {isUserOrganizer(selectedEvent.organizer_id) && <th style={{ padding: '0.5rem', textAlign: 'right' }}>Acción</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendees.map(a => (
                                            <tr key={a.id} style={{ borderBottom: '1px solid #1a202c', color: '#e2e8f0' }}>
                                                <td style={{ padding: '0.8rem 0.5rem' }}>
                                                    {a.user ? `${a.user.rango} ${a.user.apellido}` : 'Agente'}
                                                </td>
                                                <td style={{ padding: '0.8rem 0.5rem' }}>
                                                    <span style={{ 
                                                        padding: '0.2rem 0.5rem', 
                                                        borderRadius: '4px', 
                                                        fontSize: '0.8rem',
                                                        backgroundColor: a.status === 'ATTENDED' ? '#22543d' : a.status === 'ABSENT' ? '#742a2a' : '#2a4365',
                                                        color: a.status === 'ATTENDED' ? '#9ae6b4' : a.status === 'ABSENT' ? '#feb2b2' : '#90cdf4'
                                                    }}>
                                                        {a.status === 'REGISTERED' ? 'Apuntado' : a.status === 'ATTENDED' ? 'Asistió' : 'Faltó'}
                                                    </span>
                                                </td>
                                                {isUserOrganizer(selectedEvent.organizer_id) && (
                                                    <td style={{ padding: '0.8rem 0.5rem', textAlign: 'right' }}>
                                                        <select
                                                            value={a.status}
                                                            onChange={(e) => handleUpdateAttendeeStatus(a.id, e.target.value)}
                                                            style={{ backgroundColor: '#1a202c', color: 'white', border: '1px solid #4a5568', borderRadius: '4px', padding: '0.2rem' }}
                                                        >
                                                            <option value="REGISTERED">Apuntado</option>
                                                            <option value="ATTENDED">Asistió</option>
                                                            <option value="ABSENT">Faltó</option>
                                                        </select>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PracticeSchedule;
