/** Pure dice logic, imported by `index.js` and by tests — no dsh imports here. */

/** One die roll, inclusive bounds. */
export function rollDice(sides) {
  const n = Math.floor(sides)
  if (!Number.isFinite(n) || n < 2 || n > 1000) throw new RangeError(`sides must be 2..1000, got ${sides}`)
  return 1 + Math.floor(Math.random() * n)
}
