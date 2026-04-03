import type { EnvironmentRecord, SessionRecord } from '../shared/protocol'

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1]?.trim() || null
}

export function requireAdminAccess(request: Request, adminToken: string | null): boolean {
  if (!adminToken) return true
  return bearerToken(request) === adminToken
}

export function requireSessionToken(
  request: Request,
  session: SessionRecord,
  adminToken: string | null,
): boolean {
  if (requireAdminAccess(request, adminToken)) return true
  return bearerToken(request) === session.sessionIngressToken
}

export function requireEnvironmentToken(
  request: Request,
  environment: EnvironmentRecord,
  adminToken: string | null,
): boolean {
  if (requireAdminAccess(request, adminToken)) return true
  return bearerToken(request) === environment.secret
}
