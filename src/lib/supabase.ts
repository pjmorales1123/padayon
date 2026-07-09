import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or Anon Key is missing. Supabase client not initialized.');
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
}

function getSupabaseAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('Supabase URL or Service Role Key is missing. Supabase admin client not initialized.');
    return null;
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

export const supabase = getSupabaseClient();
export const supabaseAdmin = getSupabaseAdminClient();
