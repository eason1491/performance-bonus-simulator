import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iusiflvoseiqlbwovvwy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1c2lmbHZvc2VpcWxid292dnd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTg0NDcsImV4cCI6MjA5MDM5NDQ0N30.OXO292GATkCH5H26I77H86N-mO_kGzcfQUI1jKn25ko';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  });
  return { data, error };
}

export async function signOut() {
  return await supabase.auth.signOut();
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session?.user || null);
  });
}

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}
