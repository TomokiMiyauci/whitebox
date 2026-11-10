import { describe, expect, mock, it, spyOn } from "bun:test";
import { effect, reactive, attr } from "./decorator.ts";
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
});

describe("attr", () => {
  class MockElement {
    #attributes = new Map<string, string>();

    getAttribute(name: string): string | null {
      return this.#attributes.get(name) ?? null;
    }

    setAttribute(name: string, value: string): void {
      this.#attributes.set(name, value);
    }

    removeAttribute(name: string): void {
      this.#attributes.delete(name);
    }

    hasAttribute(name: string): boolean {
      return this.#attributes.has(name);
    }
  }

  interface MockElement extends Element {}

  class MockContext<
    This = unknown,
    Value = unknown,
  > implements ClassAccessorDecoratorContext<This, Value> {
    constructor(public name: string | symbol) {}
  }

  interface MockContext<
    This = unknown,
    Value = unknown,
  > extends ClassAccessorDecoratorContext<This, Value> {}

  function createAccessor(
    name: string | symbol,
    defaultValue: string | null = null,
  ) {
    return attr(
      {
        get: () => defaultValue,
        set() {},
      },
      new MockContext<Element, string | null>(name),
    );
  }

  it("returns the default value when the attribute is absent", () => {
    const defaultValue = "default";
    const accessor = createAccessor("label", defaultValue);
    const element = new MockElement();

    expect(accessor.get?.call(element)).toBe(defaultValue);
  });

  it("returns the attribute value when the attribute is present", () => {
    const accessor = createAccessor("label", "default");
    const element = new MockElement();

    element.setAttribute("label", "current");

    expect(accessor.get?.call(element)).toBe("current");
  });

  it("reflects external attribute changes", () => {
    const accessor = createAccessor("label", "default");
    const element = new MockElement();

    element.setAttribute("label", "first");
    expect(accessor.get?.call(element)).toBe("first");

    element.setAttribute("label", "second");
    expect(accessor.get?.call(element)).toBe("second");
  });

  it("returns an empty string when the attribute is empty", () => {
    const accessor = createAccessor("label", "default");
    const element = new MockElement();

    element.setAttribute("label", "");

    expect(accessor.get?.call(element)).toBe("");
  });

  it("sets the corresponding attribute", () => {
    const accessor = createAccessor("label");
    const element = new MockElement();

    accessor.set?.call(element, "current");

    expect(element.getAttribute("label")).toBe("current");
  });

  it("removes the attribute when set to null", () => {
    const accessor = createAccessor("label");
    const element = new MockElement();

    element.setAttribute("label", "current");

    accessor.set?.call(element, null);

    expect(element.hasAttribute("label")).toBe(false);
  });

  it("returns the default value after the attribute is removed", () => {
    const defaultValue = "default";
    const accessor = createAccessor("label", defaultValue);
    const element = new MockElement();

    accessor.set?.call(element, "current");
    expect(accessor.get?.call(element)).toBe("current");

    accessor.set?.call(element, null);

    expect(accessor.get?.call(element)).toBe(defaultValue);
  });

  it("throws when the accessor name is a symbol", () => {
    expect(() => createAccessor(Symbol())).toThrow(Error);
  });

  describe("decorator", () => {
    it("reflects the accessor to an attribute", () => {
      class MyElement extends MockElement {
        @attr
        accessor label: string | null = "default";
      }

      const element = new MyElement();

      expect(element.label).toBe("default");

      element.label = "next";

      expect(element.getAttribute("label")).toBe("next");
      expect(element.label).toBe("next");
    });

    it("maintains independent default values across instances", () => {
      class MyElement extends MockElement {
        @attr
        accessor label: string | null = "default";
      }

      const first = new MyElement();
      const second = new MyElement();

      first.label = "first";

      expect(first.label).toBe("first");
      expect(second.label).toBe("default");
    });

    it("supports multiple accessors independently", () => {
      class MyElement extends MockElement {
        @attr
        accessor label: string | null = "default label";

        @attr
        accessor name: string | null = "default name";
      }

      const element = new MyElement();

      element.label = "next label";

      expect(element.label).toBe("next label");
      expect(element.name).toBe("default name");

      expect(element.getAttribute("label")).toBe("next label");
      expect(element.getAttribute("name")).toBeNull();
    });
  });
});
