import { NextResponse, type NextRequest } from "next/server";

const roleHomes: Record<string, string> = {
  jobseeker: "/seeker",
  recruiter: "/recruiter",
  admin: "/admin",
};

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const requiredRole = path.startsWith("/seeker") ? "jobseeker"
    : path.startsWith("/recruiter") ? "recruiter"
    : path.startsWith("/admin") ? "admin"
    : undefined;
  if (!requiredRole) return NextResponse.next();

  const role = request.cookies.get("session_role")?.value;
  if (!role || !roleHomes[role]) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }
  if (role !== requiredRole) return NextResponse.redirect(new URL(roleHomes[role], request.url));
  // This cookie is only a navigation hint; the gateway and service APIs enforce the access JWT and role.
  return NextResponse.next();
}

export const config = {
  matcher: ["/seeker/:path*", "/recruiter/:path*", "/admin/:path*"],
};
