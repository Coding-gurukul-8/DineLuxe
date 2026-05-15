import { PageWrapper } from "@/components/layout/PageWrapper"
import { AdminDashboard } from "@/components/admin/AdminDashboard"
import { RestaurantManagement } from "@/components/admin/RestaurantManagement"

export default function AdminPanel() {
  return (
    <PageWrapper title="Admin Dashboard" subtitle="Manage the platform">
      <div className="space-y-8">
        <AdminDashboard />
        <RestaurantManagement />
      </div>
    </PageWrapper>
  )
}