import type { CreateRuleInput, UpdateRuleInput } from './dynamic-pricing.schema';
/**
 * Fetch all pricing rules for a branch with Redis caching.
 * Joins menu_items for item name and menu_categories for category name.
 */
export declare function getRulesForBranch(branchId: string, restaurantId: string): Promise<any>;
/**
 * Filter and return only the rules that are active RIGHT NOW (IST).
 * Used by the menu service to compute real-time discounted prices.
 */
export declare function getActiveRulesNow(branchId: string): Promise<any[]>;
/**
 * Create a new dynamic pricing rule for a branch.
 * Verifies branch ownership and (if provided) item ownership before inserting.
 */
export declare function createRule(branchId: string, restaurantId: string, data: CreateRuleInput, createdBy: string): Promise<any>;
/**
 * Update an existing pricing rule.
 * Verifies ownership: rule.branch_id === branchId AND branch.restaurant_id === restaurantId.
 */
export declare function updateRule(ruleId: string, branchId: string, restaurantId: string, updates: UpdateRuleInput): Promise<any>;
/**
 * Toggle the is_active boolean on a rule and emit a WebSocket event
 * so the customer app can refresh the menu in real-time.
 */
export declare function toggleRule(ruleId: string, branchId: string, restaurantId: string): Promise<any>;
/**
 * Permanently delete a pricing rule after verifying ownership.
 */
export declare function deleteRule(ruleId: string, branchId: string, restaurantId: string): Promise<{
    deleted: boolean;
}>;
//# sourceMappingURL=dynamic-pricing.service.d.ts.map