import type { Metadata } from "next"
import { RestaurantSignupWizard } from "@/components/auth/RestaurantSignupWizard"

export const metadata: Metadata = {
  title: "Restaurant Details — RestaurantOS Onboarding",
  description: "Set up your restaurant profile: name, cuisine types, contact info, and more.",
}

export default function OnboardingStep2Page() {
  return <RestaurantSignupWizard initialStep={1} />
}