// src/utils/perlinNoise.ts
// Vanilla Perlin Noise implementation (Adapted from common resources)

// Helper functions
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(t: number, a: number, b: number): number {
  return a + t * (b - a);
}

function grad(hash: number, x: number, y: number, z: number): number {
  // Convert hash into a direction vector
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

// Permutation table (seeded for reproducibility, but can be random)
// Use a simple seeded random number generator for the permutation table
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generatePermutationTable(seed: number | null = null): number[] {
  const p = Array.from({ length: 256 }, (_, i) => i);
  const rng = seed === null ? Math.random : seededRandom(seed);

  // Shuffle the array
  for (let i = p.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }

  // Duplicate the array for wrap-around
  const p2 = p.concat(p);
  return p2;
}

// Generate permutation table (using a fixed seed for consistent noise)
const perm = generatePermutationTable(123); // Use a seed like 123, or null for random each time

// 2D Perlin Noise
export function noise2D(x: number, y: number): number {
  // Find unit grid cell containing point
  let X = Math.floor(x) & 255;
  let Y = Math.floor(y) & 255;

  // Get relative xy coordinates of point within cell
  x -= Math.floor(x);
  y -= Math.floor(y);

  // Compute fade curves for interpolation
  const u = fade(x);
  const v = fade(y);

  // Hash coordinates of the 4 square corners
  let A = perm[X] + Y;
  let AA = perm[A] & 255;
  let AB = perm[A + 1] & 255;
  let B = perm[X + 1] + Y;
  let BA = perm[B] & 255;
  let BB = perm[B + 1] & 255;

  // Interpolate between grid point gradients
  // Range of noise is [-1, 1]
  return lerp(
    v,
    lerp(
      u,
      grad(perm[AA], x, y, 0), // upper-left
      grad(perm[AB], x - 1, y, 0)
    ), // upper-right
    lerp(
      u,
      grad(perm[BA], x, y - 1, 0), // lower-left
      grad(perm[BB], x - 1, y - 1, 0)
    )
  ); // lower-right
}

// 3D Perlin Noise
export function noise3D(x: number, y: number, z: number): number {
  // Find unit cube that contains point
  let X = Math.floor(x) & 255;
  let Y = Math.floor(y) & 255;
  let Z = Math.floor(z) & 255;

  // Find relative xyz coordinates of point within cube
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);

  // Compute fade curves for interpolation
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);

  // Hash coordinates of the 8 cube corners
  let A = perm[X] + Y;
  let AA = perm[A] + Z;
  let AB = perm[A + 1] + Z;
  let B = perm[X + 1] + Y;
  let BA = perm[B] + Z;
  let BB = perm[B + 1] + Z;

  // Interpolate results from 8 corners of cube
  // Range of noise is [-1, 1]
  return lerp(
    w,
    lerp(
      v,
      lerp(
        u,
        grad(perm[AA], x, y, z), // 000
        grad(perm[BA], x - 1, y, z)
      ), // 100
      lerp(
        u,
        grad(perm[AB], x, y - 1, z), // 010
        grad(perm[BB], x - 1, y - 1, z)
      )
    ), // 110
    lerp(
      v,
      lerp(
        u,
        grad(perm[AA + 1], x, y, z - 1), // 001
        grad(perm[BA + 1], x - 1, y, z - 1)
      ), // 101
      lerp(
        u,
        grad(perm[AB + 1], x, y - 1, z - 1), // 011
        grad(perm[BB + 1], x - 1, y - 1, z - 1)
      )
    )
  ); // 111
}

// Note: This is a standard implementation of "Improved Perlin Noise" by Ken Perlin.
// It uses simple arithmetic and array lookups, fitting the "vanilla" criteria.
// The range of output for noise2D and noise3D is approximately [-1, 1].
