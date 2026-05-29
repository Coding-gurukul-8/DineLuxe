import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getRoleDashboard } from "@/lib/role-routing";
import type { Role } from "@/lib/constants";

const ACCESS_TOKEN_COOKIE = "dineluxe_access_token";
const USER_ROLE_COOKIE = "dineluxe_user_role";

export default async function RootPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const role = cookieStore.get(USER_ROLE_COOKIE)?.value as Role | undefined;

  if (accessToken && role) {
    const dashboard = getRoleDashboard(role);
    if (dashboard && dashboard !== "/") redirect(dashboard);
  }

  redirect("/auth/customer");
}
