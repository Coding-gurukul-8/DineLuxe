import { supabaseAdmin } from '../../config/supabase';
import type { SaveTablePreferenceInput, UpsertDietaryProfileInput } from './customer-preferences.schema';

// ─── Table Preferences ────────────────────────────────────────────────────────

/**
 * Get a customer's saved table preference for a specific branch.
 * Returns the preference record or null if none has been saved yet.
 * Used by the booking service to pre-select the customer's preferred table.
 */
export async function getTablePreference(userId: string, branchId: string) {
  const { data, error } = await supabaseAdmin
    .from('customer_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('branch_id', branchId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/**
 * Save (or update) a customer's preferred table for a given branch.
 * Uses UPSERT on (user_id, branch_id) unique constraint.
 * On conflict: updates table details, increments times_selected, refreshes last_selected.
 */
export async function saveTablePreference(
  userId: string,
  branchId: string,
  tableId: string,
  tableLabel: string,
) {
  // First fetch existing to compute incremented times_selected
  const { data: existing } = await supabaseAdmin
    .from('customer_preferences')
    .select('times_selected')
    .eq('user_id', userId)
    .eq('branch_id', branchId)
    .maybeSingle();

  const timesSelected = (existing?.times_selected ?? 0) + 1;

  const { data, error } = await supabaseAdmin
    .from('customer_preferences')
    .upsert(
      {
        user_id: userId,
        branch_id: branchId,
        preferred_table_id: tableId,
        preferred_table_label: tableLabel,
        times_selected: timesSelected,
        last_selected: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,branch_id',
      },
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all of a customer's table preferences across every branch they've visited.
 * Joins branches for branch name.
 */
export async function getAllPreferences(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('customer_preferences')
    .select(
      `
      branch_id,
      preferred_table_label,
      times_selected,
      last_selected,
      branches ( name )
    `,
    )
    .eq('user_id', userId)
    .order('last_selected', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((pref: any) => ({
    branch_id: pref.branch_id,
    branch_name: pref.branches?.name ?? null,
    preferred_table_label: pref.preferred_table_label,
    times_selected: pref.times_selected,
    last_selected: pref.last_selected,
  }));
}

// ─── Dietary Profile ──────────────────────────────────────────────────────────

/**
 * Fetch a customer's dietary profile.
 * Returns { preferences: string[], allergies: string[] } or empty defaults if none saved.
 */
export async function getDietaryProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_dietary_profiles')
    .select('preferences, allergies')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  return {
    preferences: data?.preferences ?? [],
    allergies: data?.allergies ?? [],
  };
}

/**
 * Create or update a customer's dietary profile.
 * Uses UPSERT on (user_id) unique constraint.
 */
export async function upsertDietaryProfile(userId: string, data: UpsertDietaryProfileInput) {
  // Fetch existing profile to merge arrays (only update fields that were supplied)
  const { data: existing } = await supabaseAdmin
    .from('user_dietary_profiles')
    .select('preferences, allergies')
    .eq('user_id', userId)
    .maybeSingle();

  const mergedPreferences =
    data.preferences !== undefined ? data.preferences : (existing?.preferences ?? []);
  const mergedAllergies =
    data.allergies !== undefined ? data.allergies : (existing?.allergies ?? []);

  const { data: profile, error } = await supabaseAdmin
    .from('user_dietary_profiles')
    .upsert(
      {
        user_id: userId,
        preferences: mergedPreferences,
        allergies: mergedAllergies,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      },
    )
    .select()
    .single();

  if (error) throw error;
  return profile;
}