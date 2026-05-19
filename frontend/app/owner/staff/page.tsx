/**
 * app/owner/staff/page.tsx
 *
 * Owner panel — Staff management page.
 *
 * The old implementation in this file was completely stale:
 *   • Wrong endpoint  /restaurant/:id/staff  (should be /staff/branch/:branchId)
 *   • Wrong field names  name  (should be first_name / last_name)
 *   • Toggle hit PATCH /staff/:id with { isActive } instead of
 *     PATCH /staff/:id/toggle-access
 *   • Hand-rolled table instead of the shared DataTable component
 *   • No role-filter dropdown
 *   • No DataTable pagination / sorting
 *
 * All of that logic now lives in components/owner/StaffManagement.tsx which
 * is tested, typed, and fully wired to the correct API contract.
 */

import { StaffManagement } from "@/components/owner/StaffManagement";

export default function StaffPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <StaffManagement />
    </div>
  );
}