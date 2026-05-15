import { PageWrapper } from "@/components/layout/PageWrapper"
import { BranchManagement } from "@/components/owner/BranchManagement"
import { StaffManagement } from "@/components/owner/StaffManagement"
import { MenuManagement } from "@/components/owner/MenuManagement"
import { ReportsDashboard } from "@/components/owner/ReportsDashboard"

export default function OwnerPanel() {
  return (
    <PageWrapper title="Owner Dashboard" subtitle="Manage your restaurant operations">
      <div className="space-y-8">
        <BranchManagement />
        <StaffManagement />
        <MenuManagement />
        <ReportsDashboard />
      </div>
    </PageWrapper>
  )
}