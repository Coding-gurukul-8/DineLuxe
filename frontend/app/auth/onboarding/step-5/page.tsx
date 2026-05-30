import type { Metadata } from "next"
import { RestaurantSignupWizard } from "@/components/auth/RestaurantSignupWizard"

export const metadata: Metadata = {
  title: "Review & Submit — RestaurantOS Onboarding",
  description: "Review your details and create your RestaurantOS account.",
}

export default function OnboardingStep5Page() {
  // initialStep={4} is intentionally one beyond the wizard's last index (3).
  // The wizard clamps via Math.min(initialStep, 3), so this safely lands on
  // the final Security Setup / submit step — the closest equivalent to a
  // "Review & Submit" step in the current 4-step wizard.
  return <RestaurantSignupWizard initialStep={4} />
}