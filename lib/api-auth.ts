import { getAuthPayload, type Role, type JwtPayload } from "@/lib/auth";

type AuthSuccess = { ok: true; payload: JwtPayload; error?: never };
type AuthFailure = { ok: false; error: Response; payload?: never };
type AuthResult = AuthSuccess | AuthFailure;

/**
 * Verifies the JWT cookie and returns the authenticated payload.
 * Returns a 401 Response if unauthenticated.
 */
export async function requireAuth(): Promise<AuthResult> {
  const payload = await getAuthPayload();
  if (!payload) {
    return { ok: false, error: Response.json({ error: "Unauthenticated" }, { status: 401 }) };
  }
  return { ok: true, payload };
}

/**
 * Verifies the JWT cookie and checks that the user has the required role.
 * Returns 401 if unauthenticated, 403 if the role does not match.
 */
export async function requireRole(role: Role): Promise<AuthResult> {
  const result = await requireAuth();
  if (!result.ok) return result;
  if (result.payload.role !== role) {
    return { ok: false, error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return result;
}
