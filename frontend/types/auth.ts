import type { Role } from "@/lib/constants"

export interface AuthUser {
  id: string
  email: string
  name?: string
  role: Role
  forcePasswordChange?: boolean
  restaurantId?: string
  branchId?: string
  profile_pic_url?: string | null
  phone?: string | null
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthProfile {
  id: string
  name?: string | null
  email: string
  role: Role
  force_password_change?: boolean
  restaurant_id?: string | null
  branch_id?: string | null
  first_name?: string | null
  last_name?: string | null
}