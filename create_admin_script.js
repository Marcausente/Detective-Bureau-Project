
import { createClient } from '@supabase/supabase-js';

// Credentials provided for this specific backend revision
const SUPABASE_URL = 'https://znyleibiazxxmkbzrqqh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpueWxlaWJpYXp4eG1rYnpycXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2MTI1NzMsImV4cCI6MjA4MjE4ODU3M30.MjWYPTyRb5NPw1pGcutrY9f0UGzReNJhKYrdhmNr6Cc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function createAdmin() {
    console.log("-----------------------------------------");
    console.log("   DETECTIVE BUREAU - INITIAL SETUP");
    console.log("-----------------------------------------");

    console.log("1. Creating Admin Auth User (George Vance)...");

    // 1. Sign Up
    // This will trigger the 'on_auth_user_created' PostgreSQL trigger defined in setup_schema.sql
    // which will populate the public.users table with Admin privileges.
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: 'georgevance@lspd.com',
        password: 'password123', // Default Password
        options: {
            data: {
                first_name: 'George',
                last_name: 'Vance'
            }
        }
    });

    if (authError) {
        const fs = await import('fs');
        fs.writeFileSync('error.log', JSON.stringify(authError, null, 2));
        console.log("Error written to error.log");
        return;
    }

    const userId = authData.user?.id;
    if (!userId) {
        console.error("X No user ID returned! (Maybe email confirmation is required?)");
        return;
    }

    console.log(`✓ Auth User created! ID: ${userId}`);
    console.log("  (The database trigger should have automatically assigned 'Administrador' role)");

    console.log("\n2. Verifying Public Profile...");

    // 2. Verify
    if (profileError) {
        console.error("X Error verifying profile:", profileError.message);

        if (profileError.message.includes("Cannot coerce") || profileError.message.includes("JSON")) {
            console.warn("\n[!] DETECTED STALE USER STATE");
            console.warn("    The Auth User exists, but the Public Profile is missing.");
            console.warn("    This happens if the user was created BEFORE the Database Trigger was active.");

            console.log("\n3. Attempting Self-Healing...");
            console.log("   -> Deleting stale user...");

            // Try to delete the stale user using the RPC (assuming setup_schema.sql was run)
            const { error: delError } = await supabase.rpc('delete_personnel', {
                target_user_id: userId
            });

            if (delError) {
                console.error("   X Failed to delete stale user:", delError.message);
                console.error("   -> Please manually delete user 'georgevance@lspd.com' from Supabase Auth Dashboard.");
                console.error("   -> Then run this script again.");
            } else {
                console.log("   ✓ Stale user deleted.");
                console.log("   -> Retrying Admin Creation in 3 seconds...");

                await new Promise(r => setTimeout(r, 3000));
                return createAdmin(); // Retry from scratch
            }
        } else {
            console.log("  ! Make sure you ran the 'BBDD/setup_schema.sql' script in Supabase SQL Editor FIRST.");
        }
    } else {
        console.log("✓ Profile Found!");
        console.log("  Name:", profile.nombre, profile.apellido);
        console.log("  Role:", profile.rol);
        console.log("  Rank:", profile.rango);

        if (profile.rol === 'Administrador' && profile.rango === 'Detective II') {
            console.log("\n✓✓ SUCCESS: Admin User Configured Correctly.");
        } else {
            console.warn("\n! WARNING: User created but fields might match defaults instead of Admin.");
            console.warn("  Check the Trigger logic in setup_schema.sql.");
        }
    }
}

createAdmin();
