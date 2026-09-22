import type { Role } from "@prisma/client";
import type { AuthContext } from "@/lib/session";

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export function ctx(role: Role, over: Partial<AuthContext> = {}): AuthContext {
  return {
    sessionId: uuid(900), userId: uuid(100), email: "x@example.test", name: "Test User", role,
    tenantId: role === "SUPER_ADMIN" ? null : uuid(1), doctorId: null, patientId: null, ...over,
  };
}
