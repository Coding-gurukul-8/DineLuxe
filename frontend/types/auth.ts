import type { Role } from "@/lib/constants"

export interface AuthUser {
  id: string
  email: string
  name?: string
  role: Role
  restaurantId?: string
  branchId?: string
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
  restaurant_id?: string | null
  branch_id?: string | null
  first_name?: string | null
  last_name?: string | null
}
