
/* ==========================================
   FIJI GROCERY LIST
   SUPABASE CONNECTION
========================================== */

const SUPABASE_URL = "https://qbonbgnpssyiekcjstcm.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_axCtipbk7wSXMkOMm5OAhw_Z7NtDh4b";

// Create the Supabase client.
if (!window.supabase) {
    throw new Error("Supabase library failed to load.");
}

window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    }
);

console.log("Fiji Grocery List: Supabase client initialized.");
