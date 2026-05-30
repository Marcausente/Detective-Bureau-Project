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

  // Register a user for an event (either as attendee or organizer)
  async registerAttendee(eventId, userId, isOrganizer = false) {
    const { data, error } = await supabase
      .from('dtp_event_attendees')
      .insert([{ event_id: eventId, user_id: userId, status: 'REGISTERED', is_organizer: isOrganizer }])
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
  },

  // ==========================================
  // PRACTICE LOG (Conteo de Prácticas)
  // ==========================================

  // Get all practice log entries for a specific agent
  async getPracticeLog(agentId) {
    const { data, error } = await supabase
      .from('dtp_practice_log')
      .select(`
        *,
        logged_by_user:logged_by (id, nombre, apellido, rango, no_placa)
      `)
      .eq('agent_id', agentId)
      .order('logged_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get practice count per agent (all agents at once)
  async getPracticeCountsAll() {
    const { data, error } = await supabase
      .from('dtp_practice_log')
      .select('agent_id');

    if (error) throw error;
    // Group by agent_id
    const counts = {};
    (data || []).forEach(row => {
      counts[row.agent_id] = (counts[row.agent_id] || 0) + 1;
    });
    return counts;
  },

  // Add a practice log entry for an agent
  async addPracticeLog(agentId, practiceName, loggedBy) {
    const { data, error } = await supabase
      .from('dtp_practice_log')
      .insert([{
        agent_id: agentId,
        practice_name: practiceName,
        logged_by: loggedBy,
        logged_at: new Date().toISOString()
      }])
      .select(`
        *,
        logged_by_user:logged_by (id, nombre, apellido, rango, no_placa)
      `)
      .single();

    if (error) throw error;
    return data;
  },

  // Delete a practice log entry
  async deletePracticeLog(id) {
    const { error } = await supabase
      .from('dtp_practice_log')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
};
