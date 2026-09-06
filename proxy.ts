import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { homeForRole } from "@/lib/auth/redirects";

type SessionUser = {
  role?: string | null;
};

function redirectTo(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  let session: { user?: SessionUser | null } | null = null;
  try {
    session = await auth.api.getSession({ headers: request.headers });
  } catch {
    session = null;
  }

  const role = session?.user?.role;

  if (pathname === "/login" || pathname === "/signup") {
    if (session?.user) {
      return redirectTo(request, homeForRole(role));
    }
    return NextResponse.next();
  }

  if (!session?.user) {
    return redirectToLogin(request);
  }

  if (pathname.startsWith("/teacher") && role !== "teacher" && role !== "admin") {
    return redirectTo(request, homeForRole(role));
  }

  if (pathname.startsWith("/student") && role !== "student" && role !== "admin") {
    return redirectTo(request, homeForRole(role));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/teacher/:path*", "/student/:path*", "/meeting/:path*", "/login", "/signup"],
};
