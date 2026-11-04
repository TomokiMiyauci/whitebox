import { BiMultiMap } from "./collection.ts";
import { describe, it, expect } from "bun:test";

describe("BiMultiMap", () => {
  it("should add and retrieve edges", () => {
    const map = new BiMultiMap();
    const from = {};
    const to = {};

    map.add(from, to);

    expect(map.get(from)).toEqual(new Set([to]));
    expect(map.getReverse(to)).toEqual(new Set([from]));
  });

  it("should support multiple edges", () => {
    const map = new BiMultiMap();
    const from = {};
    const first = {};
    const second = {};

    map.add(from, first);
    map.add(from, second);

    expect(map.get(from)).toEqual(new Set([first, second]));
    expect(map.getReverse(first)).toEqual(new Set([from]));
    expect(map.getReverse(second)).toEqual(new Set([from]));
  });

  it("should not add duplicate edges", () => {
    const map = new BiMultiMap();
    const from = {};
    const to = {};

    map.add(from, to);
    map.add(from, to);

    expect(map.get(from)).toEqual(new Set([to]));
    expect(map.getReverse(to)).toEqual(new Set([from]));
  });

  it("should delete edges in both directions", () => {
    const map = new BiMultiMap();
    const from = {};
    const to = {};

    map.add(from, to);
    map.delete(from, to);

    expect(map.get(from).size).toBe(0);
    expect(map.getReverse(to).size).toBe(0);
  });

  it("should support multiple sources for the same target", () => {
    const map = new BiMultiMap();
    const first = {};
    const second = {};
    const to = {};

    map.add(first, to);
    map.add(second, to);

    expect(map.get(first)).toEqual(new Set([to]));
    expect(map.get(second)).toEqual(new Set([to]));
    expect(map.getReverse(to)).toEqual(new Set([first, second]));
  });
});
