import { describe, it, expect } from "vitest";
import { cosineSim, scoreFromSimilarity } from "./ai";

describe("cosineSim", () => {
  it("is 1 for identical vectors", () => {
    expect(cosineSim([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });
  it("is 0 for orthogonal vectors", () => {
    expect(cosineSim([1, 0], [0, 1])).toBe(0);
  });
  it("is 0 for a zero vector (no divide-by-zero)", () => {
    expect(cosineSim([0, 0], [1, 1])).toBe(0);
  });
});

describe("scoreFromSimilarity", () => {
  it("clamps into the 5–99 range", () => {
    expect(scoreFromSimilarity(-1)).toBe(5);
    expect(scoreFromSimilarity(2)).toBe(99);
  });
  it("is monotonic — more similar means a higher score", () => {
    expect(scoreFromSimilarity(0.8)).toBeGreaterThan(scoreFromSimilarity(0.4));
  });
});
