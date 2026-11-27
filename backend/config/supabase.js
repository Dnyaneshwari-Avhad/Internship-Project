const path = require('path');
// Load .env for local dev (Vercel injects env vars automatically in production)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    // Log clearly but do NOT exit — Vercel serverless env vars load at request time
    console.error('WARNING: Missing Supabase environment variables (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Set them in Vercel project settings.');
}

const clientOptions = {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
};

const supabase = createClient(supabaseUrl, supabaseServiceKey, clientOptions);

function createAuthClient() {
    return createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, clientOptions);
}

supabase.createAuthClient = createAuthClient;

module.exports = supabase;
