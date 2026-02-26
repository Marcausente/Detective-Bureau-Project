import { supabase } from '../supabaseClient';

export const dtpService = {
  // ==========================================
  // PRACTICE TEMPLATES (Archivo de Prácticas)
  // ==========================================

  // Get all practices
  async getPractices() {
    const { data, error } = await supabase
      .from('dtp_practices')
      .select('*, author:author_id (id, nombre, apellido, rango, no_placa)')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Create a new practice
  async createPractice(practiceData) {
    const { data, error } = await supabase
      .from('dtp_practices')
      .insert([practiceData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update a practice
  async updatePractice(id, updates) {
    const { data, error } = await supabase
      .from('dtp_practices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Delete a practice
  async deletePractice(id) {
    const { error } = await supabase
      .from('dtp_practices')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  // ==========================================
  // EVENTS (Programación de Prácticas)
  // ==========================================

  // Get all events with practice and organizer details
  async getEvents() {
    const { data, error } = await supabase
      .from('dtp_events')
      .select(`
        *,
        practice:practice_id (*),
        organizer:organizer_id (id, nombre, apellido, rango, no_placa)
      `)
      .order('event_date', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  // Create a new event
  async createEvent(eventData) {
    const { data, error } = await supabase
      .from('dtp_events')
      .insert([eventData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update an event
  async updateEvent(id, updates) {
    const { data, error } = await supabase
      .from('dtp_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Delete an event
  async deleteEvent(id) {
    const { error } = await supabase
      .from('dtp_events')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  // ==========================================
  // ATTENDEES (Asistencia a Prácticas)
  // ==========================================

  // Get attendees for a specific event
  async getEventAttendees(eventId) {
    const { data, error } = await supabase
      .from('dtp_event_attendees')
      .select(`
        *,
        user:user_id (id, nombre, apellido, rango, no_placa)
      `)
      .eq('event_id', eventId);
    
    if (error) throw error;
    return data;
  },

  // Register a user for an event
  async registerAttendee(eventId, userId) {
    const { data, error } = await supabase
      .from('dtp_event_attendees')
      .insert([{ event_id: eventId, user_id: userId, status: 'REGISTERED' }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update attendee status (e.g., from REGISTERED to ATTENDED)
  async updateAttendeeStatus(attendeeId, status) {
    const { data, error } = await supabase
      .from('dtp_event_attendees')
      .update({ status })
      .eq('id', attendeeId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Remove attendee (unregister)
  async removeAttendee(eventId, userId) {
    const { error } = await supabase
      .from('dtp_event_attendees')
      .delete()
      .match({ event_id: eventId, user_id: userId });
    
    if (error) throw error;
    return true;
  }
};
