import type { AppRole } from "@/lib/domain/types";

export function isAppRole(value: unknown): value is AppRole {
  return value === "docente" || value === "direccion" || value === "admin";
}

/**
 * Maps the array of institutional roles for HORARIOS_FISI into the local application AppRole
 * based on the strict hierarchy:
 * 1. ADMIN -> "admin"
 * 2. DIRECTOR_ESCUELA or DEPARTAMENTO -> "direccion"
 * 3. DOCENTE -> "docente"
 * If no supported role is found, returns null.
 */
export function resolveEffectiveRole(
  institutionalRoles: string[] = [],
): AppRole | null {
  if (!Array.isArray(institutionalRoles) || institutionalRoles.length === 0) {
    return null;
  }

  const normalized = institutionalRoles.map((r) => r.trim().toUpperCase());

  if (normalized.includes("ADMIN")) {
    return "admin";
  }

  if (
    normalized.includes("DIRECTOR_ESCUELA") ||
    normalized.includes("DEPARTAMENTO")
  ) {
    return "direccion";
  }

  if (normalized.includes("DOCENTE")) {
    return "docente";
  }

  return null;
}

/**
 * Checks whether the institutional roles qualify for access to Horarios FISI.
 */
export function canAccessHorariosFisi(
  institutionalRoles: string[] = [],
): boolean {
  return resolveEffectiveRole(institutionalRoles) !== null;
}
