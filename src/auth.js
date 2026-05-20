const SUPABASE_URL = 'https://cncmdkqhtsdscsbnctek.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wRP1PDe4u3lsHN5gr01RAw_guptIymh';

// 手動 Supabase client（不使用 @supabase/supabase-js 套件）
export function getSupabaseClient() {
  return {
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY,
    auth: {
      getSession: async () => {
        const accessToken = localStorage.getItem('sb-access-token');
        const refreshToken = localStorage.getItem('sb-refresh-token');
        if (!accessToken) return { data: { session: null }, error: null };
        try {
          const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` }
          });
          if (!res.ok) throw new Error('Invalid token');
          const user = await res.json();
          return { data: { session: { user, access_token: accessToken, refresh_token: refreshToken } }, error: null };
        } catch {
          localStorage.removeItem('sb-access-token');
          localStorage.removeItem('sb-refresh-token');
          return { data: { session: null }, error: null };
        }
      }
    }
  };
}

export async function signInWithGoogle() {
  const redirectTo = window.location.origin + window.location.pathname;
  const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
  window.location.href = url;
}

export async function signOut() {
  localStorage.removeItem('sb-access-token');
  localStorage.removeItem('sb-refresh-token');
  window.location.reload();
}

export function onAuthChange(callback) {
  // Check URL for auth tokens after Google redirect
  const hash = window.location.hash;
  if (hash && hash.includes('access_token')) {
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken) {
      localStorage.setItem('sb-access-token', accessToken);
      if (refreshToken) localStorage.setItem('sb-refresh-token', refreshToken);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
  
  const token = localStorage.getItem('sb-access-token');
  if (token) {
    fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(user => {
      callback('SIGNED_IN', user?.id ? user : null);
    }).catch(() => {
      localStorage.removeItem('sb-access-token');
      callback('SIGNED_OUT', null);
    });
  } else {
    callback('SIGNED_OUT', null);
  }
}

export async function getCurrentUser() {
  const token = localStorage.getItem('sb-access-token');
  if (!token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Invalid');
    return await res.json();
  } catch {
    return null;
  }
}

export async function savePlan(id, name, description, config) {
  const token = localStorage.getItem('sb-access-token');
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  if (id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/plans?id=eq.${id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ name, description, config, updated_at: new Date().toISOString() })
    });
    if (!res.ok) throw new Error(await res.text());
    return { id };
  } else {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/plans`, {
      method: 'POST', headers,
      body: JSON.stringify({ name, description, config })
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }
}

export async function loadPlans() {
  const token = localStorage.getItem('sb-access-token');
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/plans?order=updated_at.desc`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export async function deletePlan(id) {
  const token = localStorage.getItem('sb-access-token');
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/plans?id=eq.${id}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error(await res.text());
}

export function getDefaultPlan() {
  return {
    name: '新方案',
    description: '',
    config: {
      baseSalary: 120, targetBonus: 120, overheadRate: 20,
      quota: 1440, actual: 1800,
      steps: [
        { threshold: 400, rate: 2 }, { threshold: 800, rate: 3 },
        { threshold: 1152, rate: 5 }, { threshold: 1440, rate: 8 }
      ],
      sweetSpot: 1500, decelRate: 2, bonusCap: 200,
      cogsRate: 20, gmRate: 15,
      kpiScore: 0.95, kpiWeight: 100,
      csatTarget: 4.5, csatActual: 4.2, csatPenalty: 10,
      behaviorMod: 1.0,
      clawbacks: [{ amount: 120, rate: 10, totalMonths: 12, fulfilledMonths: 4 }],
      hardThreshold: { enabled: false, minRate: 50 },
      retroactiveThreshold: { enabled: false },
      oneYuanStart: true,
      qualityMetric: 'csat',
      npsTarget: 50, npsActual: 60, npsPenalty: 10
    }
  };
}
