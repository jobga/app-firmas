/**
 * Illustrative 25×25 QR-like matrix (finder patterns + pseudo-random modules).
 * Replace with a real TOTP otpauth:// QR once the backend issues secrets.
 */
export function makeIllustrativeQr(N = 25): boolean[] {
  const out: boolean[] = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const finder = (r: number, c: number) => {
    for (const [fr, fc] of [[0, 0], [0, N - 7], [N - 7, 0]]) {
      if (r >= fr && r < fr + 7 && c >= fc && c < fc + 7) {
        const y = r - fr, x = c - fc;
        const edge = y === 0 || y === 6 || x === 0 || x === 6;
        const core = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        return edge || core ? 1 : 0;
      }
      if (r >= fr - 1 && r <= fr + 7 && c >= fc - 1 && c <= fc + 7) return 0;
    }
    return -1;
  };
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const f = finder(r, c);
    out.push(f === -1 ? (r === 6 || c === 6 ? (r + c) % 2 === 0 : rnd() > 0.52) : f === 1);
  }
  return out;
}
