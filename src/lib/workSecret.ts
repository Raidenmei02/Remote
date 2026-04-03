import type { WorkSecret } from '../shared/protocol'

export function encodeWorkSecret(secret: WorkSecret): string {
  return Buffer.from(JSON.stringify(secret), 'utf8').toString('base64url')
}
