// Seeded evasion sample: identifier constructed by string concatenation
// to defeat naive scanners. The audit:determinism script MUST still
// report this when the source file contains a Date.now / Math.random
// call expression, even when the identifier names are obfuscated.
const obj = {
  // @ts-ignore
  getNow() { return Date.now(); },
  getRandom() { return Math.random(); },
};
const getNow = "Date" + "." + "now";
const evalFn = new Function(`return ${getNow}`)();

export function badId(): string {
  return `id-${evalFn()}-${obj.getRandom()}`;
}
