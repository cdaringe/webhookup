export function arrayFromString (input: string) {
  return input
    .split(',')
    .map((i: string) => i.trim())
    .filter((i: string) => !!i)
}
