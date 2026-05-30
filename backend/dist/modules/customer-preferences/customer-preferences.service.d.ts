import type { UpsertDietaryProfileInput } from './customer-preferences.schema';
/**
 * Get a customer's saved table preference for a specific branch.
 * Returns the preference record or null if none has been saved yet.
 * Used by the booking service to pre-select the customer's preferred table.
 */
export declare function getTablePreference(userId: string, branchId: string): Promise<any>;
/**
 * Save (or update) a customer's preferred table for a given branch.
 * Uses UPSERT on (user_id, branch_id) unique constraint.
 * On conflict: updates table details, increments times_selected, refreshes last_selected.
 */
export declare function saveTablePreference(userId: string, branchId: string, tableId: string, tableLabel: string): Promise<any>;
/**
 * Get all of a customer's table preferences across every branch they've visited.
 * Joins branches for branch name.
 */
export declare function getAllPreferences(userId: string): Promise<{
    branch_id: any;
    branch_name: any;
    preferred_table_label: any;
    times_selected: any;
    last_selected: any;
}[]>;
/**
 * Fetch a customer's dietary profile.
 * Returns { preferences: string[], allergies: string[] } or empty defaults if none saved.
 */
export declare function getDietaryProfile(userId: string): Promise<{
    preferences: any;
    allergies: any;
}>;
/**
 * Create or update a customer's dietary profile.
 * Uses UPSERT on (user_id) unique constraint.
 */
export declare function upsertDietaryProfile(userId: string, data: UpsertDietaryProfileInput): Promise<any>;
//# sourceMappingURL=customer-preferences.service.d.ts.map