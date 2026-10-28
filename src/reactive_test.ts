import { Engine, State, Effect } from "./reactive.ts";
import { describe, it, expect } from "bun:test";

describe("Engine", () => {
  it("should rerun an effect when a dependent state changes", () => {
    const engine = new Engine();
    const state = new State(1);
    let runs = 0;

    const effect = new Effect(() => {
      void state.value;
      runs++;
    });

    engine.register(effect);
    effect.run();

    expect(runs).toBe(1);

    engine.mutate(state, 2);

    expect(runs).toBe(2);
  });

  it("should not rerun an effect when an unrelated state changes", () => {
    const engine = new Engine();
    const state = new State(1);
    const unrelated = new State(2);
    let runs = 0;

    const effect = new Effect(() => {
      void state.value;
      runs++;
    });

    engine.register(effect);
    effect.run();

    engine.mutate(unrelated, 3);

    expect(runs).toBe(1);
  });

  it("should rerun all effects that depend on the mutated state", () => {
    const engine = new Engine();
    const state = new State(1);
    let runsA = 0;
    let runsB = 0;

    const effectA = new Effect(() => {
      void state.value;
      runsA++;
    });

    const effectB = new Effect(() => {
      void state.value;
      runsB++;
    });

    engine.register(effectA);
    engine.register(effectB);

    effectA.run();
    effectB.run();

    engine.mutate(state, 2);

    expect(runsA).toBe(2);
    expect(runsB).toBe(2);
  });

  it("should rerun only effects that depend on the mutated state", () => {
    const engine = new Engine();
    const a = new State(1);
    const b = new State(2);
    let runsA = 0;
    let runsB = 0;

    const effectA = new Effect(() => {
      void a.value;
      runsA++;
    });

    const effectB = new Effect(() => {
      void b.value;
      runsB++;
    });

    engine.register(effectA);
    engine.register(effectB);

    effectA.run();
    effectB.run();

    engine.mutate(a, 10);

    expect(runsA).toBe(2);
    expect(runsB).toBe(1);
  });
});

describe("Effect dependencies", () => {
  it("should track states read during execution", () => {
    const a = new State(1);
    const b = new State(2);

    const effect = new Effect(() => {
      void a.value;
      void b.value;
    });

    effect.run();

    expect(effect.dependsOn(a)).toBe(true);
    expect(effect.dependsOn(b)).toBe(true);
  });

  it("should replace dependencies on each execution", () => {
    const enabled = new State(true);
    const a = new State(1);
    const b = new State(2);

    const effect = new Effect(() => {
      void (enabled.value ? a.value : b.value);
    });

    effect.run();

    expect(effect.dependsOn(enabled)).toBe(true);
    expect(effect.dependsOn(a)).toBe(true);
    expect(effect.dependsOn(b)).toBe(false);

    enabled.setValue(false);
    effect.run();

    expect(effect.dependsOn(enabled)).toBe(true);
    expect(effect.dependsOn(a)).toBe(false);
    expect(effect.dependsOn(b)).toBe(true);
  });

  it("should have no dependencies when no state is read", () => {
    const state = new State(1);
    const effect = new Effect(() => {});

    effect.run();

    expect(effect.dependsOn(state)).toBe(false);
  });

  it("should keep dependencies isolated between effects", () => {
    const shared = new State(1);
    const a = new State(2);
    const b = new State(3);

    const effectA = new Effect(() => {
      void shared.value;
      void a.value;
    });

    const effectB = new Effect(() => {
      void shared.value;
      void b.value;
    });

    effectA.run();
    effectB.run();

    expect(effectA.dependsOn(shared)).toBe(true);
    expect(effectA.dependsOn(a)).toBe(true);
    expect(effectA.dependsOn(b)).toBe(false);

    expect(effectB.dependsOn(shared)).toBe(true);
    expect(effectB.dependsOn(a)).toBe(false);
    expect(effectB.dependsOn(b)).toBe(true);
  });

  it("should stop tracking dependencies after execution", () => {
    const a = new State(1);
    const b = new State(2);

    const effect = new Effect(() => {
      void a.value;
    });

    effect.run();
    void b.value;

    expect(effect.dependsOn(a)).toBe(true);
    expect(effect.dependsOn(b)).toBe(false);
  });

  it("should retain dependencies collected before an exception", () => {
    const a = new State(1);
    const b = new State(2);
    const error = new Error("Action failed");

    const effect = new Effect(() => {
      void a.value;
      throw error;
    });

    expect(() => effect.run()).toThrow(error);

    expect(effect.dependsOn(a)).toBe(true);
    expect(effect.dependsOn(b)).toBe(false);
  });

  it("should replace dependencies even when execution throws", () => {
    const enabled = new State(true);
    const a = new State(1);
    const b = new State(2);
    const error = new Error("Action failed");

    const effect = new Effect(() => {
      if (enabled.value) {
        void a.value;
      } else {
        void b.value;
        throw error;
      }
    });

    effect.run();

    expect(effect.dependsOn(a)).toBe(true);
    expect(effect.dependsOn(b)).toBe(false);

    enabled.setValue(false);

    expect(() => effect.run()).toThrow(error);

    expect(effect.dependsOn(enabled)).toBe(true);
    expect(effect.dependsOn(a)).toBe(false);
    expect(effect.dependsOn(b)).toBe(true);
  });

  it("should not rerun effects when the value is equal", () => {
    const engine = new Engine();
    const state = new State(1);
    let runs = 0;

    const effect = new Effect(() => {
      void state.value;
      runs++;
    });

    engine.register(effect);
    effect.run();

    engine.mutate(state, 1);

    expect(runs).toBe(1);
  });

  it("should respect custom equality when deciding to rerun effects", () => {
    const engine = new Engine();
    const state = new State({ id: 1, name: "Alice" }, (a, b) => a.id === b.id);
    let runs = 0;

    const effect = new Effect(() => {
      void state.value;
      runs++;
    });

    engine.register(effect);
    effect.run();

    engine.mutate(state, { id: 1, name: "Bob" });

    expect(runs).toBe(1);
    expect(state.value).toEqual({ id: 1, name: "Alice" });

    engine.mutate(state, { id: 2, name: "Bob" });

    expect(runs).toBe(2);
    expect(state.value).toEqual({ id: 2, name: "Bob" });
  });

  it("should not rerun an unregistered effect", () => {
    const engine = new Engine();
    const state = new State(1);
    let runs = 0;

    const effect = new Effect(() => {
      void state.value;
      runs++;
    });

    engine.register(effect);
    effect.run();

    engine.unregister(effect);
    engine.mutate(state, 2);

    expect(runs).toBe(1);
  });
});

describe("State", () => {
  it("should not update when values are equal", () => {
    const state = new State(1);

    expect(state.setValue(1)).toBe(false);
    expect(state.value).toBe(1);
  });

  it("should update when values are different", () => {
    const state = new State(1);

    expect(state.setValue(2)).toBe(true);
    expect(state.value).toBe(2);
  });

  it("should use Object.is by default", () => {
    const state = new State(Number.NaN);

    expect(state.setValue(Number.NaN)).toBe(false);
    expect(state.setValue(0)).toBe(true);

    const zero = new State(0);

    expect(zero.setValue(-0)).toBe(true);
  });

  it("should use a custom equality function", () => {
    const state = new State({ id: 1, name: "Alice" }, (a, b) => a.id === b.id);

    expect(state.setValue({ id: 1, name: "Bob" })).toBe(false);

    expect(state.value).toEqual({ id: 1, name: "Alice" });

    expect(state.setValue({ id: 2, name: "Bob" })).toBe(true);

    expect(state.value).toEqual({ id: 2, name: "Bob" });
  });
});
