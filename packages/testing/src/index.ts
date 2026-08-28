export function isoAt(day: string, time = '08:00:00'): string {
  return `${day}T${time}.000Z`;
}
