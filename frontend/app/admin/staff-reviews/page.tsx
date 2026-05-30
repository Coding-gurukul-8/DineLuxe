"use client";

import { PageWrapper } from "@/components/layout/PageWrapper";
import StaffFeedbackViewer from "@/components/admin/StaffFeedbackViewer";

export default function AdminStaffReviewsPage() {
  return (
    <PageWrapper
      title="Staff Reviews"
      subtitle="Anonymous feedback from front-of-house and kitchen teams"
    >
      <StaffFeedbackViewer />
    </PageWrapper>
  );
}
