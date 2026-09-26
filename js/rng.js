// Seeded random numbers, so every generated question can be reproduced from its seed.
export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min, max) => min + Math.floor(next() * (max - min + 1));
  const pick = (arr) => arr[Math.floor(next() * arr.length)];
  const shuffle = (arr) => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return { next, int, pick, shuffle };
}

// Shuffles options and returns them with the index of the correct one.
export function placeOptions(rng, correct, distractors) {
  const all = rng.shuffle([{ ...correct, correct: true }, ...distractors.map((d) => ({ ...d, correct: false }))]);
  const correctIndex = all.findIndex((o) => o.correct);
  return { options: all.map(({ correct: _c, ...o }) => o), correctIndex };
}
