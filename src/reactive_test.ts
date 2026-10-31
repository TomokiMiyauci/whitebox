import { Effect, State, ReactiveContext, Signal } from "./reactive.ts";
import { describe, it, expect, mock, beforeEach } from "bun:test";

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

  it("should extends equals", () => {
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

describe("Signal", () => {
  let context: ReactiveContext;

  beforeEach(function () {
    context = new ReactiveContext(() => {});
  });
  it("should not update when values are equal", function () {
    const signal = new Signal(context, 1);

    expect(signal.set(1)).toBe(false);
    expect(signal.get).toBe(1);
  });

  it("should update when values are different", () => {
    const signal = new Signal(context, 1);

    expect(signal.set(2)).toBe(true);
    expect(signal.get).toBe(2);
  });

  it("should use Object.is by default", () => {
    const signal = new Signal(context, Number.NaN);

    expect(signal.set(Number.NaN)).toBe(false);
    expect(signal.set(0)).toBe(true);

    const zero = new Signal(context, 0);

    expect(zero.set(-0)).toBe(true);
  });

  it("should trigger get event", () => {
    const stub = mock();
    const context = new ReactiveContext(stub);
    context.track = stub;

    const signal = new Signal(context, 1);

    expect(signal.get).toBe(1);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("should trigger set event", () => {
    const stub = mock();
    const context = new ReactiveContext(stub);
    context.notifyChange = stub;
    const signal = new Signal(context, 1);

    signal.set(0);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("should not trigger if same value is setted", () => {
    const stub = mock();

    const context = new ReactiveContext(stub);
    context.notifyChange = stub;
    const signal = new Signal(context, 1);

    signal.set(1);
    expect(stub).not.toHaveBeenCalled();
  });
});

describe("Effect", () => {
  it("should update dependencies when it reruns", () => {
    const scheduled: VoidFunction[] = [];
    const context = new ReactiveContext((action) => scheduled.push(action));
    const useFirst = new Signal(context, true);
    const first = new Signal(context, 1);
    const second = new Signal(context, 2);
    const effect = new Effect(context, () => {
      if (useFirst.get) {
        first.get;
      } else {
        second.get;
      }
    });

    effect.run();
    useFirst.set(false);
    scheduled.shift()?.();

    first.set(3);
    expect(scheduled).toHaveLength(0);

    second.set(4);
    expect(scheduled).toHaveLength(1);
  });
});
