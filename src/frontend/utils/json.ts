export function tryParse<T>(value: string) {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}