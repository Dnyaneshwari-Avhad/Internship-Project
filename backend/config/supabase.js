const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables. Check your .env file.');
    process.exit(1);
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
