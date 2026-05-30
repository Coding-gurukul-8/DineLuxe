import type { Metadata } from "next"
import { RestaurantSignupWizard } from "@/components/auth/RestaurantSignupWizard"

export const metadata: Metadata = {
  title: "Branding — RestaurantOS Onboarding",
  description: "Create a secure password to protect your RestaurantOS account.",
}

export default function OnboardingStep4Page() {
  return <RestaurantSignupWizard initialStep={3} />
}