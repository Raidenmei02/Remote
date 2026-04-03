import { randomUUID } from 'crypto'
import { SAFE_ID_PATTERN } from '../shared/protocol'

export function makeId(prefix: string): string {
  const raw = randomUUID().replace(/-/g, '')
  const id = `${prefix}_${raw}`
  if (!SAFE_ID_PATTERN.test(id)) {
    throw new Error(`Generated unsafe id: ${id}`)
  }
  return id
}

export function makeToken(): string {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
}

export function makeEventUuid(): string {
  return `evt_${randomUUID().replace(/-/g, '')}`
}
