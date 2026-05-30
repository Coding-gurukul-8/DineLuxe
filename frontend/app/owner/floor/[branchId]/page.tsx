"use client";

import { useParams } from "next/navigation";
import { PageWrapper } from "@/components/layout/PageWrapper";
import FloorLayoutDesigner from "@/components/floor/FloorLayoutDesigner";

export default function OwnerFloorBranchPage() {
  const { branchId } = useParams<{ branchId: string }>();

  return (
    <PageWrapper
      title="Floor Layout"
      subtitle="Arrange tables, preview zones, and prepare the layout"
    >
      <FloorLayoutDesigner branchId={branchId} />
    </PageWrapper>
  );
}
