
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://znyleibiazxxmkbzrqqh.supabase.co';
// Debugging as AUTHENTICATED USER (George Vance)
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpueWxlaWJpYXp4eG1rYnpycXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MTI1NzMsImV4cCI6MjA4MjE4ODU3M30.MjWYPTyRb5NPw1pGcutrY9f0UGzReNJhKYrdhmNr6Cc'; // Anon Key
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runTest() {
    console.log("1. Logging in as George Vance...");
    const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'georgevance@lspd.com',
        password: 'password123'
    });

    if (loginError) {
        console.error("Login Failed:", loginError.message);
        return;
    }
    console.log("Logged in!", authData.user.id);

    console.log("2. Testing create_new_personnel RPC as George...");

    // Test Payload
    const params = {
        p_email: `testuser_${Date.now()}@lspd.com`,
        p_password: 'testpassword123',
        p_nombre: 'Test',
        p_apellido: 'User',
        p_no_placa: '999',
        p_rango: 'Oficial II',
        p_rol: 'Ayudante',
        p_fecha_ingreso: new Date().toISOString(),
        p_fecha_ultimo_ascenso: null,
        p_profile_image: null
    };

    const { data, error } = await supabase.rpc('create_new_personnel', params);

    if (error) {
        console.error("RPC FAILED:");
        console.error(JSON.stringify(error, null, 2));
    } else {
        console.log("RPC SUCCESS!");
    }
}

runTest();
