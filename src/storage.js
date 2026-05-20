import { supabase } from './auth.js';

export async function loadPlans() {
  const { data, error } = await supabase
    .from('plans')
    .select('id, name, description, config, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function savePlan(id, name, description, config) {
  if (id) {
    const { data, error } = await supabase
      .from('plans')
      .update({ name, description, config, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select();
    if (error) throw error;
    return data[0];
  } else {
    const { data, error } = await supabase
      .from('plans')
      .insert({ name, description, config })
      .select();
    if (error) throw error;
    return data[0];
  }
}

export async function deletePlan(id) {
  const { error } = await supabase
    .from('plans')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export function getDefaultPlan() {
  return {
    name: '新方案',
    description: '',
    config: {
      baseSalary: 120,
      targetBonus: 120,
      overheadRate: 20,
      quota: 1440,
      actual: 1800,
      steps: [
        { threshold: 400, rate: 2 },
        { threshold: 800, rate: 3 },
        { threshold: 1152, rate: 5 },
        { threshold: 1440, rate: 8 }
      ],
      sweetSpot: 1500,
      decelRate: 2,
      bonusCap: 200,
      cogsRate: 20,
      gmRate: 15,
      kpiScore: 0.95,
      kpiWeight: 100,
      csatTarget: 4.5,
      csatActual: 4.2,
      csatPenalty: 10,
      behaviorMod: 1.0,
      clawbacks: [
        { amount: 120, rate: 10, totalMonths: 12, fulfilledMonths: 4 }
      ],
      hardThreshold: { enabled: false, minRate: 50 },
      retroactiveThreshold: { enabled: false },
      oneYuanStart: true,
      qualityMetric: 'csat',
      npsTarget: 50,
      npsActual: 60,
      npsPenalty: 10
    }
  };
}
