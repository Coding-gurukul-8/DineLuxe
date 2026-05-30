import type { Metadata } from "next"
import { RestaurantSignupWizard } from "@/components/auth/RestaurantSignupWizard"

export const metadata: Metadata = {
  title: "Branch Setup — RestaurantOS Onboarding",
  description: "Add your first branch: address, city, state, pincode, and seating capacity.",
}

export default function OnboardingStep3Page() {
  return <RestaurantSignupWizard initialStep={2} />
}