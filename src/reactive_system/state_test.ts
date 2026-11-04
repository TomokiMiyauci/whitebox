import { State } from "./state.ts";
import { describe, it, expect } from "bun:test";

describe("State", () => {
  it("should not update when values are equal", function () {
    const state = new State(1);

    expect(state.set(1)).toBe(false);
    expect(state.get).toBe(1);
  });

  it("should update when values are different", () => {
    const state = new State(1);

    expect(state.set(2)).toBe(true);
    expect(state.get).toBe(2);
  });

  it("should use Object.is by default", () => {
    const state = new State(Number.NaN);

    expect(state.set(Number.NaN)).toBe(false);
    expect(state.set(0)).toBe(true);

    const zero = new State(0);

    expect(zero.set(-0)).toBe(true);
  });

  it("should allow overriding equals", () => {
    class CustomState<T extends { id: unknown }> extends State<T> {
      equals(left: T, right: T): boolean {
        return left.id === right.id;
      }
    }

    const state = new CustomState({ id: 1, name: "Alice" });

    expect(state.set({ id: 1, name: "Bob" })).toBe(false);
    expect(state.get).toEqual({ id: 1, name: "Alice" });

    expect(state.set({ id: 2, name: "Bob" })).toBe(true);
    expect(state.get).toEqual({ id: 2, name: "Bob" });
  });
});
