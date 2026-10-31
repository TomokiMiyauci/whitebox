import { State, ReactiveContext } from "./reactive.ts";
import { describe, it, expect, mock, beforeEach } from "bun:test";

describe("State", () => {
  let context: ReactiveContext;

  beforeEach(function () {
    context = new ReactiveContext(() => {});
  });
  it("should not update when values are equal", function () {
    const state = new State(context, 1);

    expect(state.set(1)).toBe(false);
    expect(state.get).toBe(1);
  });

  it("should update when values are different", () => {
    const state = new State(context, 1);

    expect(state.set(2)).toBe(true);
    expect(state.get).toBe(2);
  });

  it("should use Object.is by default", () => {
    const state = new State(context, Number.NaN);

    expect(state.set(Number.NaN)).toBe(false);
    expect(state.set(0)).toBe(true);

    const zero = new State(context, 0);

    expect(zero.set(-0)).toBe(true);
  });

  it("should support custom equality", () => {
    class CustomState<T extends { id: unknown }> extends State<T> {
      equals(left: T, right: T): boolean {
        return left.id === right.id;
      }
    }

    const state = new CustomState(context, { id: 1, name: "Alice" });

    expect(state.set({ id: 1, name: "Bob" })).toBe(false);

    expect(state.get).toEqual({ id: 1, name: "Alice" });

    expect(state.set({ id: 2, name: "Bob" })).toBe(true);

    expect(state.get).toEqual({ id: 2, name: "Bob" });
  });

  it("should trigger get event", () => {
    const stub = mock();
    const context = new ReactiveContext(stub);
    context.track = stub;

    const state = new State(context, 1);

    expect(state.get).toBe(1);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("should trigger set event", () => {
    const stub = mock();
    const context = new ReactiveContext(stub);
    context.notifyChange = stub;
    const state = new State(context, 1);

    state.set(0);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("should not trigger if same value is setted", () => {
    const stub = mock();

    const context = new ReactiveContext(stub);
    context.notifyChange = stub;
    const state = new State(context, 1);

    state.set(1);
    expect(stub).not.toHaveBeenCalled();
  });
});
