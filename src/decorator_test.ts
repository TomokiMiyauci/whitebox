import { describe, expect, mock, it, spyOn } from "bun:test";
import { effect, reactive } from "./decorator.ts";
import Signal from "./signal/mod.ts";
import { Effect } from "./effect.ts";

const flush = () => Promise.resolve();

async function collectGarbage(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    Bun.gc(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

describe("effect", () => {
  it("should run once after instance construction", () => {
    const action = mock();

    @effect(function () {
      action(this.count);
    })
    class Counter {
      @reactive accessor count = 0;
    }

    new Counter();

    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenLastCalledWith(0);
  });

  it("should rerun when a dependency changes", async () => {
    const action = mock();

    @effect(function () {
      action(this.count);
    })
    class Counter {
      @reactive accessor count = 0;
    }

    const counter = new Counter();

    counter.count = 1;

    expect(action).toHaveBeenCalledTimes(1);

    await flush();

    expect(action).toHaveBeenCalledTimes(2);
    expect(action).toHaveBeenLastCalledWith(1);
  });

  it("should not rerun when a dependency does not change", async () => {
    const action = mock();

    @effect(function () {
      action(this.count);
    })
    class Counter {
      @reactive accessor count = 0;
    }

    const counter = new Counter();

    counter.count = 0;
    await flush();

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("should track only dependencies accessed during the latest execution", async () => {
    const action = mock();

    @effect(function () {
      switch (this.selected) {
        case 0:
          action(this.first);
          break;
        case 1:
          action(this.second);
          break;
        case 2:
          action(this.third);
          break;
      }
    })
    class Counter {
      @reactive accessor selected = 0;
      @reactive accessor first = 10;
      @reactive accessor second = 20;
      @reactive accessor third = 30;
    }

    const counter = new Counter();

    const expectAction = (calls: number, value: number) => {
      expect(action).toHaveBeenCalledTimes(calls);
      expect(action).toHaveBeenLastCalledWith(value);
    };

    expectAction(1, 10);

    // Switch to second
    counter.selected = 1;
    await flush();
    expectAction(2, 20);

    // The previous dependency is no longer tracked
    counter.first = 11;
    await flush();
    expectAction(2, 20);

    // The current dependency is tracked
    counter.second = 21;
    await flush();
    expectAction(3, 21);

    // Switch to third
    counter.selected = 2;
    await flush();
    expectAction(4, 30);

    counter.second = 22;
    await flush();
    expectAction(4, 30);

    counter.third = 31;
    await flush();
    expectAction(5, 31);

    // Switch back to first
    counter.selected = 0;
    await flush();
    expectAction(6, 11);

    counter.third = 32;
    await flush();
    expectAction(6, 11);

    counter.first = 12;
    await flush();
    expectAction(7, 12);
  });

  it("should run cleanup before rerunning", async () => {
    const events: string[] = [];

    @effect(function (onCleanup) {
      events.push(`run:${this.count}`);
      onCleanup(() => events.push("cleanup"));
    })
    class Counter {
      @reactive accessor count = 0;
    }

    const counter = new Counter();

    expect(events).toEqual(["run:0"]);

    counter.count = 1;

    expect(events).toEqual(["run:0"]);

    await flush();

    expect(events).toEqual(["run:0", "cleanup", "run:1"]);
  });

  it("should maintain independent effects for each instance", async () => {
    const action = mock();

    @effect(function () {
      action(this.count);
    })
    class Counter {
      @reactive accessor count = 0;
    }

    const first = new Counter();
    const second = new Counter();

    expect(action.mock.calls).toEqual([[0], [0]]);

    first.count = 1;
    await flush();

    expect(action.mock.calls).toEqual([[0], [0], [1]]);

    second.count = 2;
    await flush();

    expect(action.mock.calls).toEqual([[0], [0], [1], [2]]);
  });

  it("stops the effect when the instance is garbage collected", async () => {
    const state = new Signal.State(0);
    const action = mock();

    const createInstance = (): WeakRef<object> => {
      @effect(() => {
        state.get();
        action();
      })
      class A {}

      const instance = new A();

      return new WeakRef(instance);
    };

    const instance = createInstance();

    // Initial execution.
    expect(action).toHaveBeenCalledTimes(1);

    await collectGarbage();

    // The instance should have been garbage collected.
    expect(instance.deref()).toBeUndefined();

    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    // The effect should no longer react to signal changes.
    state.set(1);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("should stop the effect when the instance is garbage collected", async () => {
    const stop = spyOn(Effect.prototype, "stop");

    const createInstance = (): WeakRef<object> => {
      @effect(() => {})
      class A {}

      const instance = new A();

      return new WeakRef(instance);
    };

    try {
      const instance = createInstance();

      await collectGarbage();

      // The instance should have been garbage collected.
      expect(instance.deref()).toBeUndefined();

      // The effect should have been stopped.
      expect(stop).toHaveBeenCalledTimes(1);
    } finally {
      stop.mockRestore();
    }
  });
});

describe("reactive", () => {
  describe("decorator", () => {
    it("should preserve the initial value", () => {
      class Counter {
        @reactive accessor count = 10;
      }

      const counter = new Counter();

      expect(counter.count).toBe(10);
    });

    it("should return the updated value", () => {
      class Counter {
        @reactive accessor count = 0;
      }

      const counter = new Counter();

      counter.count = 10;

      expect(counter.count).toBe(10);
    });

    it("should maintain independent state for each instance", () => {
      class Counter {
        @reactive accessor count = 0;
      }

      const first = new Counter();
      const second = new Counter();

      first.count = 10;

      expect(first.count).toBe(10);
      expect(second.count).toBe(0);
    });

    it("should support multiple reactive accessors", () => {
      class Counter {
        @reactive accessor count = 0;
        @reactive accessor name = "counter";
      }

      const counter = new Counter();

      counter.count = 10;
      counter.name = "updated";

      expect(counter.count).toBe(10);
      expect(counter.name).toBe("updated");
    });

    it("should track dependencies", () => {
      class Counter {
        @reactive accessor count = 0;
      }

      const counter = new Counter();
      const computed = new Signal.Computed(() => counter.count * 2);

      expect(computed.get()).toBe(0);

      counter.count = 10;

      expect(computed.get()).toBe(20);

      counter.count = 10;

      expect(computed.get()).toBe(20);

      counter.count = 20;

      expect(computed.get()).toBe(40);
    });
  });

  describe("direct invocation", () => {
    interface Value {
      value: number;
    }

    it("should preserve the original setter behavior", () => {
      const target = {
        get(): number {
          return this.value;
        },

        set(value: number): void {
          this.value = value * 2;
        },
      } satisfies ClassAccessorDecoratorTarget<Value, number>;

      const result = reactive(target);
      const instance = { value: 0 } satisfies Value;

      const init = result.init.call(instance, 1);

      expect(init).toBe(1);

      result.set.call(instance, 5);

      expect(instance.value).toBe(10);
      expect(result.get.call(instance)).toBe(10);
    });

    it("should maintain independent state for each instance", () => {
      const target = {
        get(): number {
          return this.value;
        },

        set(value: number): void {
          this.value = value;
        },
      } satisfies ClassAccessorDecoratorTarget<Value, number>;

      const result = reactive(target);
      const first = { value: 0 } satisfies Value;
      const second = { value: 0 } satisfies Value;

      result.init.call(first, 0);
      result.init.call(second, 0);

      result.set.call(first, 10);

      expect(result.get.call(first)).toBe(10);
      expect(result.get.call(second)).toBe(0);

      result.set!.call(second, 5);

      expect(result.get.call(first)).toBe(10);
      expect(result.get.call(second)).toBe(5);
    });

    it("should notify dependencies with the original setter behavior", () => {
      const target = {
        get(): number {
          return this.value;
        },

        set(value: number): void {
          this.value = value * 2;
        },
      } satisfies ClassAccessorDecoratorTarget<Value, number>;

      const result = reactive(target);
      const instance = { value: 0 } satisfies Value;

      instance.value = result.init.call(instance, 1);

      const computed = new Signal.Computed(() => result.get.call(instance));

      expect(computed.get()).toBe(1);

      result.set.call(instance, 5);

      expect(instance.value).toBe(10);
      expect(computed.get()).toBe(10);
    });

    it("should throw when get is called before initialization", () => {
      let getCalls = 0;

      const target = {
        get(): number {
          getCalls++;
          return this.value;
        },

        set(value: number): void {
          this.value = value;
        },
      } satisfies ClassAccessorDecoratorTarget<Value, number>;

      const result = reactive(target);
      const instance = { value: 0 } satisfies Value;

      expect(() => result.get.call(instance)).toThrow(Error);

      expect(getCalls).toBe(0);
    });

    it("should throw when set is called before initialization", () => {
      let getCalls = 0;
      let setCalls = 0;

      const target = {
        get(): number {
          getCalls++;
          return this.value;
        },

        set(value: number): void {
          setCalls++;
          this.value = value;
        },
      } satisfies ClassAccessorDecoratorTarget<Value, number>;

      const result = reactive(target);
      const instance = { value: 0 } satisfies Value;

      expect(() => result.set.call(instance, 10)).toThrow(Error);

      expect(getCalls).toBe(0);
      expect(setCalls).toBe(0);
    });
  });
});
