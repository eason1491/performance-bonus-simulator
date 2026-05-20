import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cncmdkqhtsdscsbnctek.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wRP1PDe4u3lsHN5gr01RAw_guptIymh';

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
