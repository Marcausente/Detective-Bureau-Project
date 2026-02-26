import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { dtpService } from '../../services/dtpService';
import '../../pages/Training/Training.css'; // Shared premium styles

function PracticeSchedule() {
    const [events, setEvents] = useState([]);
    const [practices, setPractices] = useState([]);
    const [users, setUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    
    const [viewMode, setViewMode] = useState('list'); // 'list', 'create', 'details'
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [attendees, setAttendees] = useState([]);
    
    const [formData, setFormData] = useState({
        practice_id: '',
        event_date: '',
        event_time: '',
        organizer_id: '',
        notes: '',
        selectedInstructors: []
    });

    const [editAttendees, setEditAttendees] = useState({
        selectedInstructors: [],
        selectedAspirants: [],
        extra_personnel: ''
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
            console.error('Error:', err);
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
            setEditAttendees({
                selectedInstructors: [],
                selectedAspirants: [],
                extra_personnel: event.extra_personnel || ''
            });
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
            setError('Por favor, rellena los campos obligatorios (*).');
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
            
            const createdEvent = await dtpService.createEvent(newEvent);
            
            if (formData.selectedInstructors && formData.selectedInstructors.length > 0) {
                const instructorPromises = formData.selectedInstructors.map(id => 
                    dtpService.registerAttendee(createdEvent.id, id, true)
                );
                await Promise.all(instructorPromises);
            }
            
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

    const handleCreateMultiSelectChange = (e, field) => {
        const value = Array.from(e.target.selectedOptions, option => option.value);
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleEditAttendeesMultiSelectChange = (e, field) => {
        const value = Array.from(e.target.selectedOptions, option => option.value);
        setEditAttendees(prev => ({ ...prev, [field]: value }));
    };

    const handleEditAttendeesChange = (e) => {
        const { name, value } = e.target;
        setEditAttendees(prev => ({ ...prev, [name]: value }));
    };

    const handleAddAttendees = async () => {
        setLoading(true);
        try {
            if (editAttendees.extra_personnel !== selectedEvent.extra_personnel) {
                await dtpService.updateEvent(selectedEvent.id, { extra_personnel: editAttendees.extra_personnel });
            }

            const instructorPromises = editAttendees.selectedInstructors.map(id => {
                if (!attendees.some(a => a.user_id === id)) {
                    return dtpService.registerAttendee(selectedEvent.id, id, true);
                }
                return Promise.resolve();
            });
            
            const aspirantPromises = editAttendees.selectedAspirants.map(id => {
                if (!attendees.some(a => a.user_id === id)) {
                    return dtpService.registerAttendee(selectedEvent.id, id, false);
                }
                return Promise.resolve();
            });
            
            await Promise.all([...instructorPromises, ...aspirantPromises]);
            
            setSuccessMessage('Asistentes añadidos/actualizados correctamente.');
            setTimeout(() => setSuccessMessage(null), 2000);
            
            const updatedEvent = { ...selectedEvent, extra_personnel: editAttendees.extra_personnel };
            setSelectedEvent(updatedEvent);
            await loadAttendees(selectedEvent.id);
            setEditAttendees(prev => ({ ...prev, selectedInstructors: [], selectedAspirants: [] }));
        } catch (error) {
            console.error(error);
            setError('Error al actualizar asistentes.');
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterToggle = async (eventId, isRegistered, asOrganizer = false) => {
        if (!currentUser) return;
        
        setLoading(true);
        try {
            if (isRegistered) {
                await dtpService.removeAttendee(eventId, currentUser.id);
                setSuccessMessage('Te has dado de baja de la práctica.');
            } else {
                await dtpService.registerAttendee(eventId, currentUser.id, asOrganizer);
                setSuccessMessage(asOrganizer ? 'Te has apuntado como Instructor/Organizador.' : 'Te has apuntado como Praticante.');
            }
            
            setTimeout(() => setSuccessMessage(null), 2000);
            
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

    const formatDate = (dateString, format = 'full') => {
        const d = new Date(dateString);
        if (format === 'short') {
            return d.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const isUpcoming = (dateString) => {
        return new Date(dateString) > new Date();
    };

    const upcomingEvents = events.filter(e => isUpcoming(e.event_date));
    const pastEvents = events.filter(e => !isUpcoming(e.event_date));

    const isUserRegistered = (event) => {
        return attendees.some(a => a.user_id === currentUser?.id && a.event_id === event.id);
    };

    const isUserOrganizer = (userId) => {
      return currentUser && currentUser.id === userId;
    };

    const detectives = users.filter(u => ['detective', 'admin', 'superadmin'].includes(u.rol?.toLowerCase()) || (u.rango && u.rango.toLowerCase().includes('detective')));
    const ayudantes = users.filter(u => u.rol?.toLowerCase() === 'ayudante' || (u.rango && u.rango.toLowerCase().includes('ayudante')) || (u.rango && u.rango.toLowerCase().includes('aspirante')));

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {error && <div className="error-message" style={{ marginBottom: '1rem', borderRadius: '8px' }}>{error}</div>}
            {successMessage && <div className="success-message" style={{ marginBottom: '1rem', borderRadius: '8px' }}>{successMessage}</div>}

            {viewMode === 'list' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                        <button className="dtp-btn-primary" onClick={() => setViewMode('create')}>
                            <span>+</span> Programar Práctica
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#a0aec0' }}>Cargando programación...</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
                            
                            {/* Upcoming Events */}
                            <div>
                                <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem', marginBottom: '1.5rem', color: '#e2e8f0', fontSize: '1.4rem' }}>
                                    <span style={{ color: '#48bb78', marginRight: '0.5rem' }}>●</span> Próximas Prácticas
                                </h3>
                                
                                {upcomingEvents.length === 0 ? (
                                    <div className="dtp-glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
                                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>📅</div>
                                        <p style={{ color: '#a0aec0' }}>No hay prácticas programadas próximamente.</p>
                                    </div>
                                ) : (
                                    <div className="dtp-grid">
                                        {upcomingEvents.map(event => (
                                            <div key={event.id} className="dtp-glass-card dtp-event-card upcoming" style={{ display: 'flex', flexDirection: 'column' }}>
                                                <h4 style={{ margin: '0 0 1rem 0', color: '#48bb78', fontSize: '1.2rem', fontWeight: 600 }}>
                                                    {event.practice?.title || 'Práctica Desconocida'}
                                                </h4>
                                                <div style={{ color: '#cbd5e0', flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                        <svg width="18" height="18" fill="none" stroke="#a0aec0" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                        <span>{formatDate(event.event_date)}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                                        <svg width="18" height="18" fill="none" stroke="#a0aec0" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                                        <span>Org: {event.organizer ? `${event.organizer.rango} ${event.organizer.nombre} ${event.organizer.apellido}` : 'Sin asignar'}</span>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <button className="dtp-btn-secondary" onClick={() => handleActionClick('view', event.id)} style={{ padding: '0.5rem 1rem' }}>
                                                        Ver Detalles
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Past Events */}
                            <div>
                                <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.8rem', marginBottom: '1.5rem', color: '#a0aec0', fontSize: '1.4rem' }}>
                                    <span style={{ color: '#718096', marginRight: '0.5rem' }}>●</span> Historial de Prácticas
                                </h3>
                                
                                {pastEvents.length === 0 ? (
                                    <p style={{ color: '#718096', fontStyle: 'italic', padding: '1rem 0' }}>No hay registro de prácticas anteriores.</p>
                                ) : (
                                    <div className="dtp-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                                        {pastEvents.map(event => (
                                            <div key={event.id} className="dtp-glass-card dtp-event-card past" style={{ padding: '1.2rem' }}>
                                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#e2e8f0', fontSize: '1.1rem' }}>{event.practice?.title || 'Práctica Desconocida'}</h4>
                                                <div style={{ color: '#a0aec0', fontSize: '0.9rem', marginBottom: '0.8rem' }}>
                                                    <div style={{ marginBottom: '0.2rem' }}>{formatDate(event.event_date, 'short')}</div>
                                                    <div>Status: <span style={{ color: event.status === 'COMPLETED' ? '#48bb78' : '#e2e8f0' }}>{event.status}</span></div>
                                                    <div style={{ marginTop: '0.2rem' }}>Instructor: {event.organizer?.apellido || 'N/A'}</div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                                    <button className="dtp-btn-secondary" onClick={() => handleActionClick('view', event.id)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: 'transparent' }}>
                                                        Revisar Actividad
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
                <div className="dtp-form-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                        <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '1.5rem', fontWeight: 600 }}>Programar Nueva Práctica</h3>
                        <button className="dtp-btn-secondary" onClick={() => setViewMode('list')}>
                            Cancelar
                        </button>
                    </div>

                    <form onSubmit={handleCreateSubmit}>
                        <div className="dtp-input-group">
                            <label className="dtp-label">Seleccionar Práctica del Archivo *</label>
                            <select
                                className="dtp-input"
                                name="practice_id"
                                value={formData.practice_id}
                                onChange={handleFormChange}
                                required
                            >
                                <option value="" disabled style={{ color: '#718096' }}>-- Selecciona una Práctica Base --</option>
                                {practices.map(p => (
                                    <option key={p.id} value={p.id} style={{ background: '#1a1d24', color: 'white' }}>{p.title}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
                            <div className="dtp-input-group" style={{ marginBottom: 0 }}>
                                <label className="dtp-label">Fecha *</label>
                                <input
                                    type="date"
                                    className="dtp-input"
                                    name="event_date"
                                    value={formData.event_date}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>
                            <div className="dtp-input-group" style={{ marginBottom: 0 }}>
                                <label className="dtp-label">Hora *</label>
                                <input
                                    type="time"
                                    className="dtp-input"
                                    name="event_time"
                                    value={formData.event_time}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="dtp-input-group">
                            <label className="dtp-label">Instructor / Organizador Principal *</label>
                            <select
                                className="dtp-input"
                                name="organizer_id"
                                value={formData.organizer_id}
                                onChange={handleFormChange}
                                required
                            >
                                <option value="" disabled style={{ color: '#718096' }}>-- Selecciona un Detective --</option>
                                {detectives.map(u => (
                                    <option key={u.id} value={u.id} style={{ background: '#1a1d24', color: 'white' }}>{u.rango} {u.nombre} {u.apellido} - Placa {u.no_placa}</option>
                                ))}
                            </select>
                        </div>

                        <div className="dtp-input-group">
                            <label className="dtp-label">Instructores Asistentes (Detectives)</label>
                            <div style={{ fontSize: '0.8rem', color: '#a0aec0', marginBottom: '0.5rem' }}>Mantén Ctrl/Cmd para seleccionar varios (Opcional)</div>
                            <select
                                multiple
                                className="dtp-input"
                                style={{ height: '120px', padding: '0.5rem' }}
                                value={formData.selectedInstructors}
                                onChange={(e) => handleCreateMultiSelectChange(e, 'selectedInstructors')}
                            >
                                {detectives.map(u => (
                                    <option key={u.id} value={u.id} style={{ background: '#1a1d24', color: 'white', padding: '0.3rem' }}>{u.rango} {u.nombre} {u.apellido}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="dtp-input-group">
                            <label className="dtp-label">Lugar de Reunión o Notas Especiales</label>
                            <input
                                type="text"
                                className="dtp-input"
                                name="notes"
                                value={formData.notes}
                                onChange={handleFormChange}
                                placeholder="Ej: Comisaría de Mission Row, Uniforme ordinario..."
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <button type="submit" className="dtp-btn-primary" disabled={loading}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{marginRight: '8px'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                                Finalizar Programación
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {viewMode === 'details' && selectedEvent && (
                <div className="dtp-glass-card" style={{ padding: '2.5rem', maxWidth: '1000px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1.5rem' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.8rem' }}>
                                <h2 style={{ margin: 0, color: '#e2e8f0', fontSize: '2rem', fontWeight: 700 }}>{selectedEvent.practice?.title}</h2>
                                {!isUpcoming(selectedEvent.event_date) && (
                                    <span className="dtp-status-badge" style={{ background: 'rgba(255,255,255,0.1)', color: '#a0aec0', border: '1px solid rgba(255,255,255,0.2)' }}>
                                        FINALIZADO
                                    </span>
                                )}
                            </div>
                            <p style={{ margin: 0, color: '#63b3ed', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                {formatDate(selectedEvent.event_date)}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.8rem' }}>
                            {isUserOrganizer(selectedEvent.organizer_id) && isUpcoming(selectedEvent.event_date) && (
                                <button className="dtp-btn-danger" onClick={() => handleActionClick('delete', selectedEvent.id)}>
                                    Cancelar Evento
                                </button>
                            )}
                            <button className="dtp-btn-secondary" onClick={() => setViewMode('list')}>
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{marginRight: '6px'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                Volver
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
                        {/* Info Column */}
                        <div>
                            <div style={{ marginBottom: '2.5rem' }}>
                                <h4 style={{ color: '#ffffff', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <svg width="22" height="22" fill="none" stroke="#63b3ed" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    Información de la Práctica
                                </h4>
                                <p style={{ color: '#a0aec0', fontSize: '1rem', lineHeight: '1.7', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    {selectedEvent.practice?.description || 'Esta práctica no posee descripción detallada en su plantilla original.'}
                                </p>
                                
                                {selectedEvent.notes && (
                                    <div style={{ marginTop: '1.5rem', padding: '1.2rem', backgroundColor: 'rgba(99, 179, 237, 0.1)', borderRadius: '12px', borderLeft: '4px solid #63b3ed' }}>
                                        <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.5rem' }}>Notas del Instructor:</strong>
                                        <span style={{ color: '#e2e8f0', lineHeight: '1.6' }}>{selectedEvent.notes}</span>
                                    </div>
                                )}
                                
                                {selectedEvent.extra_personnel && (
                                    <div style={{ marginTop: '1.5rem', padding: '1.2rem', backgroundColor: 'rgba(237, 137, 54, 0.1)', borderRadius: '12px', borderLeft: '4px solid #ed8936' }}>
                                        <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.5rem' }}>Personal Extra Asistente:</strong>
                                        <span style={{ color: '#fbd38d', lineHeight: '1.6' }}>{selectedEvent.extra_personnel}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div style={{ marginBottom: '2.5rem' }}>
                                <h4 style={{ color: '#ffffff', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <svg width="22" height="22" fill="none" stroke="#ed8936" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                    Instructor a Cargo
                                </h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', background: 'linear-gradient(145deg, rgba(26,32,44,0.8) 0%, rgba(20,24,34,0.8) 100%)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                                    <div style={{ fontSize: '2.5rem', background: 'rgba(255,255,255,0.1)', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                                        👮
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '700', color: '#ffffff', fontSize: '1.2rem', marginBottom: '0.2rem' }}>
                                            {selectedEvent.organizer ? `${selectedEvent.organizer.rango} ${selectedEvent.organizer.nombre} ${selectedEvent.organizer.apellido}` : 'Instructor Desconocido'}
                                        </div>
                                        <div style={{ fontSize: '0.9rem', color: '#a0aec0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ background: 'rgba(237, 137, 54, 0.2)', color: '#fbd38d', padding: '0.1rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                PLACA {selectedEvent.organizer?.no_placa || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {selectedEvent.practice?.documents_urls && selectedEvent.practice.documents_urls.length > 0 && (
                                <div>
                                    <h4 style={{ color: '#ffffff', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <svg width="22" height="22" fill="none" stroke="#9f7aea" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                                        Documentos de la Práctica
                                    </h4>
                                    <ul className="dtp-docs-list">
                                        {selectedEvent.practice.documents_urls.map((url, idx) => (
                                            <li key={idx} className="dtp-doc-item" style={{ marginBottom: '0.8rem' }}>
                                                <a href={url} target="_blank" rel="noopener noreferrer" className="dtp-doc-link" style={{ width: '100%', padding: '0.8rem 1rem', background: 'rgba(159, 122, 234, 0.1)', color: '#d6bcfa' }}>
                                                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{flexShrink: 0}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Acceder al Documento {idx + 1}</span>
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Attendees Column */}
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                                <div>
                                    <h4 style={{ margin: 0, color: '#ffffff', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <svg width="22" height="22" fill="none" stroke="#48bb78" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                                        Asistencia Registrada
                                    </h4>
                                    <p style={{ margin: '0.5rem 0 0 0', color: '#a0aec0', fontSize: '0.9rem' }}>{attendees.length} agentes confirmados</p>
                                </div>
                                
                                {isUpcoming(selectedEvent.event_date) && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                                        {isUserRegistered(selectedEvent) ? (
                                            <button 
                                                className="dtp-btn-danger"
                                                onClick={() => handleRegisterToggle(selectedEvent.id, true)}
                                                style={{ padding: '0.6rem 1.2rem' }}
                                            >
                                                Retirarme
                                            </button>
                                        ) : (
                                            <>
                                                <button 
                                                    className="dtp-btn-primary"
                                                    onClick={() => handleRegisterToggle(selectedEvent.id, false, false)}
                                                    style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                                                >
                                                    Asistir como Agente
                                                </button>
                                                {(currentUser?.rol === 'detective' || currentUser?.rol === 'admin' || currentUser?.rol === 'superadmin') && (
                                                    <button 
                                                        className="dtp-btn-secondary"
                                                        onClick={() => handleRegisterToggle(selectedEvent.id, false, true)}
                                                        style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', borderColor: '#ed8936', color: '#fbd38d' }}
                                                    >
                                                        Gestionar Práctica
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {loading ? (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0aec0' }}>Cargando participantes...</div>
                            ) : attendees.length === 0 ? (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#718096', opacity: 0.8 }}>
                                    <svg width="64" height="64" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginBottom: '1rem' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                    <p>Aún no hay agentes apuntados a esta práctica.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                    
                                    {/* Tabla de Instructores / Organizadores Secundarios */}
                                    {attendees.filter(a => a.is_organizer).length > 0 && (
                                        <div>
                                            <h5 style={{ color: '#ed8936', margin: '0 0 0.8rem 0', fontSize: '1rem', borderBottom: '1px solid rgba(237, 137, 54, 0.3)', paddingBottom: '0.3rem' }}>
                                                Instructores y Gestión
                                            </h5>
                                            <div style={{ overflowX: 'auto', background: 'rgba(237, 137, 54, 0.05)', borderRadius: '8px', border: '1px solid rgba(237, 137, 54, 0.2)' }}>
                                                <table className="dtp-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Instructor</th>
                                                            <th>Estado</th>
                                                            {isUserOrganizer(selectedEvent.organizer_id) && <th style={{ textAlign: 'right' }}>Acción</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {attendees.filter(a => a.is_organizer).map(a => (
                                                            <tr key={a.id}>
                                                                <td style={{ fontWeight: 500, color: '#fbd38d' }}>
                                                                    {a.user ? `${a.user.rango} ${a.user.apellido}` : 'Instructor Desconocido'}
                                                                </td>
                                                                <td>
                                                                    <span className={`dtp-status-badge ${
                                                                        a.status === 'ATTENDED' ? 'dtp-status-attended' : 
                                                                        a.status === 'ABSENT' ? 'dtp-status-absent' : 'dtp-status-registered'
                                                                    }`}>
                                                                        {a.status === 'REGISTERED' ? 'Apuntado' : a.status === 'ATTENDED' ? 'Asistió' : 'Faltó'}
                                                                    </span>
                                                                </td>
                                                                {isUserOrganizer(selectedEvent.organizer_id) && (
                                                                    <td style={{ textAlign: 'right' }}>
                                                                        <select
                                                                            value={a.status}
                                                                            onChange={(e) => handleUpdateAttendeeStatus(a.id, e.target.value)}
                                                                            className="dtp-input"
                                                                            style={{ padding: '0.3rem 0.6rem', width: 'auto', display: 'inline-block', fontSize: '0.85rem' }}
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
                                            </div>
                                        </div>
                                    )}

                                    {/* Tabla de Agentes Registrados */}
                                    {attendees.filter(a => !a.is_organizer).length > 0 && (
                                        <div>
                                            <h5 style={{ color: '#63b3ed', margin: '0 0 0.8rem 0', fontSize: '1rem', borderBottom: '1px solid rgba(99, 179, 237, 0.3)', paddingBottom: '0.3rem' }}>
                                                Agentes Participantes
                                            </h5>
                                            <div style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                <table className="dtp-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Agente</th>
                                                            <th>Estado</th>
                                                            {(isUserOrganizer(selectedEvent.organizer_id) || currentUser?.rol === 'detective') && <th style={{ textAlign: 'right' }}>Acción</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {attendees.filter(a => !a.is_organizer).map(a => (
                                                            <tr key={a.id}>
                                                                <td style={{ fontWeight: 500 }}>
                                                                    {a.user ? `${a.user.rango} ${a.user.apellido}` : 'Agente Autorizado'}
                                                                </td>
                                                                <td>
                                                                    <span className={`dtp-status-badge ${
                                                                        a.status === 'ATTENDED' ? 'dtp-status-attended' : 
                                                                        a.status === 'ABSENT' ? 'dtp-status-absent' : 'dtp-status-registered'
                                                                    }`}>
                                                                        {a.status === 'REGISTERED' ? 'Apuntado' : a.status === 'ATTENDED' ? 'Asistió' : 'Faltó'}
                                                                    </span>
                                                                </td>
                                                                {(isUserOrganizer(selectedEvent.organizer_id) || currentUser?.rol === 'detective') && (
                                                                    <td style={{ textAlign: 'right' }}>
                                                                        <select
                                                                            value={a.status}
                                                                            onChange={(e) => handleUpdateAttendeeStatus(a.id, e.target.value)}
                                                                            className="dtp-input"
                                                                            style={{ padding: '0.3rem 0.6rem', width: 'auto', display: 'inline-block', fontSize: '0.85rem' }}
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
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {(isUserOrganizer(selectedEvent.organizer_id) || currentUser?.rol === 'detective' || currentUser?.rol === 'admin' || currentUser?.rol === 'superadmin') && (
                                <div style={{ marginTop: '2.5rem', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <h5 style={{ color: '#ffffff', fontSize: '1.1rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <svg width="20" height="20" fill="none" stroke="#ed8936" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                        Añadir Asistentes / Pasar Lista
                                    </h5>
                                    
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                        <div className="dtp-input-group" style={{ marginBottom: 0 }}>
                                            <label className="dtp-label">Añadir Instructores (Detectives)</label>
                                            <select
                                                multiple
                                                className="dtp-input"
                                                style={{ height: '100px', padding: '0.5rem' }}
                                                value={editAttendees.selectedInstructors}
                                                onChange={(e) => handleEditAttendeesMultiSelectChange(e, 'selectedInstructors')}
                                            >
                                                {detectives.filter(u => !attendees.some(a => a.user_id === u.id)).map(u => (
                                                    <option key={u.id} value={u.id} style={{ background: '#1a1d24', color: 'white', padding: '0.3rem' }}>{u.rango} {u.nombre} {u.apellido}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="dtp-input-group" style={{ marginBottom: 0 }}>
                                            <label className="dtp-label">Añadir Aspirantes (Ayudantes)</label>
                                            <select
                                                multiple
                                                className="dtp-input"
                                                style={{ height: '100px', padding: '0.5rem' }}
                                                value={editAttendees.selectedAspirants}
                                                onChange={(e) => handleEditAttendeesMultiSelectChange(e, 'selectedAspirants')}
                                            >
                                                {ayudantes.filter(u => !attendees.some(a => a.user_id === u.id)).map(u => (
                                                    <option key={u.id} value={u.id} style={{ background: '#1a1d24', color: 'white', padding: '0.3rem' }}>{u.rango} {u.nombre} {u.apellido}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="dtp-input-group" style={{ marginBottom: '1.5rem' }}>
                                        <label className="dtp-label">Personal Extra Asistente (Opcional)</label>
                                        <input
                                            type="text"
                                            className="dtp-input"
                                            name="extra_personnel"
                                            value={editAttendees.extra_personnel}
                                            onChange={handleEditAttendeesChange}
                                            placeholder="Ej: John Doe, Jane Doe"
                                        />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <button 
                                            className="dtp-btn-secondary" 
                                            onClick={handleAddAttendees}
                                            disabled={loading}
                                            style={{ borderColor: '#48bb78', color: '#68d391' }}
                                        >
                                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{marginRight: '6px'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                            Actualizar Lista
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PracticeSchedule;
