import { describe, expect, it, mock } from "bun:test";
import { Signal } from "./wrapper.ts";

describe("Signal.State", () => {
  it("should work", () => {
    const stateSignal = new Signal.State(0);
    expect(stateSignal.get()).toEqual(0);

    stateSignal.set(10);

    expect(stateSignal.get()).toEqual(10);
  });

  describe("Comparison semantics", () => {
    it("should cache State by Object.is", () => {
      const state = new Signal.State(NaN);
      let calls = 0;
      const computed = new Signal.Computed(() => {
        calls++;
        return state.get();
      });
      expect(calls).toBe(0);
      expect(computed.get()).toBe(NaN);
      expect(calls).toBe(1);
      state.set(NaN);
      expect(computed.get()).toBe(NaN);
      expect(calls).toBe(1);
    });

    it("applies custom equality in State", () => {
      let ecalls = 0;
      const state = new Signal.State(1, {
        equals() {
          ecalls++;
          return false;
        },
      });
      let calls = 0;
      const computed = new Signal.Computed(() => {
        calls++;
        return state.get();
      });

      expect(calls).toBe(0);
      expect(ecalls).toBe(0);

      expect(computed.get()).toBe(1);
      expect(ecalls).toBe(0);
      expect(calls).toBe(1);

      state.set(1);
      expect(computed.get()).toBe(1);
      expect(ecalls).toBe(1);
      expect(calls).toBe(2);
    });
  });
});

describe("Ported - Vue", () => {
  // https://github.com/vuejs/core/blob/main/packages/reactivity/__tests__/computed.spec.ts#L32
  it("should return updated value", () => {
    const s = new Signal.State<{ foo?: number }>({});
    const c = new Signal.Computed(() => s.get().foo);

    expect(c.get()).toBe(undefined);
    s.set({ foo: 1 });
    expect(c.get()).toBe(1);
  });

  // https://github.com/vuejs/core/blob/main/packages/reactivity/__tests__/computed.spec.ts#L54
  it("should compute lazily", () => {
    const s = new Signal.State<{ foo?: number }>({});
    const getter = mock(() => s.get().foo);
    const c = new Signal.Computed(getter);

    // lazy
    expect(getter).not.toHaveBeenCalled();

    expect(c.get()).toBe(undefined);
    expect(getter).toHaveBeenCalledTimes(1);

    // should not compute again
    c.get();
    expect(getter).toHaveBeenCalledTimes(1);

    // should not compute until needed
    s.set({ foo: 1 });
    expect(getter).toHaveBeenCalledTimes(1);

    // now it should compute
    expect(c.get()).toBe(1);
    expect(getter).toHaveBeenCalledTimes(2);

    // should not compute again
    c.get();
    expect(getter).toHaveBeenCalledTimes(2);
  });

  // https://github.com/vuejs/core/blob/main/packages/reactivity/__tests__/computed.spec.ts#L488
  it("should work when chained(ref+computed)", () => {
    const v = new Signal.State(0);
    const c1 = new Signal.Computed(() => {
      if (v.get() === 0) {
        v.set(1);
      }
      return "foo";
    });
    const c2 = new Signal.Computed(() => v.get() + c1.get());
    expect(c2.get()).toBe("0foo");
    expect(c2.get()).toBe("0foo"); // ! In vue it recomputes and becomes '1foo'
  });

  // https://github.com/vuejs/core/blob/main/packages/reactivity/__tests__/computed.spec.ts#L925
  it("should be recomputed without being affected by side effects", () => {
    const v = new Signal.State(0);
    const c1 = new Signal.Computed(() => {
      v.set(1);
      return 0;
    });
    const c2 = new Signal.Computed(() => {
      return v.get() + "," + c1.get();
    });

    expect(c2.get()).toBe("0,0");
    v.set(1);
    expect(c2.get()).toBe("0,0"); // ! In vue it recomputes and becomes '1,0'
  });
});

describe("Ported - Preact", () => {
  // https://github.com/preactjs/signals/blob/main/packages/core/test/signal.test.tsx#L1078
  it("should not leak errors raised by dependencies", () => {
    const a = new Signal.State(0);
    const b = new Signal.Computed(() => {
      a.get();
      throw new Error("error");
    });
    const c = new Signal.Computed(() => {
      try {
        b.get();
      } catch {
        return "ok";
      }
    });
    expect(c.get()).toEqual("ok");
    a.set(1);
    expect(c.get()).toEqual("ok");
  });

  // https://github.com/preactjs/signals/blob/main/packages/core/test/signal.test.tsx#L914
  it("should return updated value", () => {
    const a = new Signal.State("a");
    const b = new Signal.State("b");

    const c = new Signal.Computed(() => a.get() + b.get());
    expect(c.get()).toEqual("ab");

    a.set("aa");
    expect(c.get()).toEqual("aab");
  });

  // https://github.com/preactjs/signals/blob/main/packages/core/test/signal.test.tsx#L925
  it("should be lazily computed on demand", () => {
    const a = new Signal.State("a");
    const b = new Signal.State("b");
    const spy = mock(() => a.get() + b.get());
    const c = new Signal.Computed(spy);
    expect(spy).not.toHaveBeenCalled();
    c.get();
    expect(spy).toHaveBeenCalledOnce();
    a.set("x");
    b.set("y");
    expect(spy).toHaveBeenCalledOnce();
    c.get();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  // https://github.com/preactjs/signals/blob/main/packages/core/test/signal.test.tsx#L940
  it("should be computed only when a dependency has changed at some point", () => {
    const a = new Signal.State("a");
    const spy = mock(() => {
      return a.get();
    });
    const c = new Signal.Computed(spy);
    c.get();
    expect(spy).toHaveBeenCalledOnce();
    a.set("a");
    c.get();
    expect(spy).toHaveBeenCalledOnce();
  });

  // https://github.com/preactjs/signals/blob/main/packages/core/test/signal.test.tsx#L1693
  it("should support lazy branches", () => {
    const a = new Signal.State(0);
    const b = new Signal.Computed(() => a.get());
    const c = new Signal.Computed(() => (a.get() > 0 ? a.get() : b.get()));

    expect(c.get()).toEqual(0);
    a.set(1);
    expect(c.get()).toEqual(1);

    a.set(0);
    expect(c.get()).toEqual(0);
  });
});
