// v314: the ONE formula that ranks recipes by their stars AND their number of votes (pure, no network).
// A recipe with a single 5-star vote must not beat one with 40 votes averaging 4.6: the average is pulled toward a
// neutral prior (PRIOR_AVG) with the weight of PRIOR_N imaginary votes (Bayesian average), so
//   quality = (n * avg + PRIOR_N * PRIOR_AVG) / (n + PRIOR_N)
// n = 0 gives the prior (3.5), 1 vote of 5 stars gives 3.75, 20 votes of 4.6 give 4.38, 100 votes of 4.6 give 4.55.
// Popularity (number of shares) adds a small bonus that grows slowly (log) and is capped at 0.5, so it can break ties but never beat stars.
export const PRIOR_AVG = 3.5;
export const PRIOR_N = 5;
export function quality(avg, n) {
  const a = Number(avg) || 0, c = Math.max(0, Number(n) || 0);
  return (c * a + PRIOR_N * PRIOR_AVG) / (c + PRIOR_N);
}
export function rank(avg, n, shares) {
  return quality(avg, n) + Math.min(0.5, 0.15 * Math.log2(1 + Math.max(0, Number(shares) || 0)));
}
// Stars of a Redis HGETALL array [owner, "4", owner, "5", …] -> { avg, n } (only 1..5 count).
export function starsOf(flat) {
  const v = [];
  for (let i = 1; i < (flat || []).length; i += 2) { const s = Number(flat[i]); if (s >= 1 && s <= 5) v.push(s); }
  return { n: v.length, avg: v.length ? v.reduce((p, q) => p + q, 0) / v.length : 0 };
}
// v315: « Recommandée » badge = enough votes (5+) AND a high weighted score (4.2+): a lone 5-star vote (3.75) never qualifies.
export const REC_MIN_VOTES = 5, REC_MIN_QUALITY = 4.2;
export function recommended(avg, n) {
  return (Number(n) || 0) >= REC_MIN_VOTES && quality(avg, n) >= REC_MIN_QUALITY;
}
