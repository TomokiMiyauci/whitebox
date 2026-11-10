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

class MockElement {
  value: string | null;

  constructor(value: string | null = null) {
    this.value = value;
  }

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

describe("attr", () => {
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

  interface Instance extends Element {
    value: string | null;
  }

  function createTarget(): ClassAccessorDecoratorTarget<
    Instance,
    string | null
  > {
    return {
      get(): string | null {
        return this.value;
      },
      set(value) {
        this.value = value;
      },
    };
  }

  const defaultValue = "default";

  it("returns the default value when the attribute is absent", () => {
    const target = createTarget();
    const result = attr(target, new MockContext("label"));
    const element = new MockElement(defaultValue);

    result.init.call(element, element.value);

    expect(result.get.call(element)).toBe(defaultValue);
  });

  it("returns the attribute value when the attribute is present", () => {
    const target = createTarget();
    const key = "label";
    const result = attr(target, new MockContext(key));
    const element = new MockElement(defaultValue);

    result.init.call(element, element.value);
    element.setAttribute(key, "current");

    expect(result.get.call(element)).toBe("current");
  });

  it("reflects external attribute changes", () => {
    const target = createTarget();
    const result = attr(target, new MockContext("label"));
    const element = new MockElement(defaultValue);

    result.init.call(element, element.value);

    element.setAttribute("label", "first");
    expect(result.get.call(element)).toBe("first");

    element.setAttribute("label", "second");
    expect(result.get.call(element)).toBe("second");
  });

  it("returns the default value when the attribute is externally removed", () => {
    const target = createTarget();
    const result = attr(target, new MockContext("label"));
    const element = new MockElement(defaultValue);

    result.init.call(element, element.value);
    element.setAttribute("label", "current");
    element.removeAttribute("label");

    expect(result.get.call(element)).toBe(defaultValue);
  });

  it("returns an empty string when the attribute is empty", () => {
    const target = createTarget();
    const result = attr(target, new MockContext("label"));
    const element = new MockElement(defaultValue);

    result.init.call(element, element.value);
    element.setAttribute("label", "");

    expect(result.get.call(element)).toBe("");
  });

  it("sets the corresponding attribute", () => {
    const target = createTarget();
    const key = "label";
    const result = attr(target, new MockContext(key));
    const element = new MockElement();

    result.init.call(element, element.value);

    const value = "current";

    result.set.call(element, value);

    expect(element.getAttribute(key)).toBe(value);
  });

  it("removes the attribute when set to null", () => {
    const target = createTarget();
    const result = attr(target, new MockContext("label"));
    const element = new MockElement();

    result.init.call(element, element.value);
    element.setAttribute("label", "current");

    result.set.call(element, null);

    expect(element.hasAttribute("label")).toBe(false);
  });

  it("returns the default value after the attribute is removed", () => {
    const target = createTarget();
    const element = new MockElement(defaultValue);
    const result = attr(target, new MockContext("label"));

    result.init.call(element, element.value);

    result.set.call(element, "current");
    expect(result.get.call(element)).toBe("current");

    result.set.call(element, null);

    expect(result.get.call(element)).toBe(defaultValue);
  });

  it("calls the original getter when the attribute is absent", () => {
    const key = "label";
    const target = createTarget();
    const get = mock(target.get);
    const result = attr({ ...target, get }, new MockContext(key));
    const element = new MockElement();

    result.init.call(element, element.value);

    expect(result.get.call(element)).toBe(null);
    expect(element.hasAttribute(key)).toBeFalse();
    expect(get).toHaveBeenCalledOnce();
  });

  it("calls the original getter when the attribute is present", () => {
    const key = "label";
    const target = createTarget();
    const get = mock(target.get);
    const result = attr({ ...target, get }, new MockContext(key));
    const element = new MockElement(defaultValue);

    result.init.call(element, element.value);
    element.setAttribute(key, "current");

    expect(result.get.call(element)).toBe("current");
    expect(get).toHaveBeenCalledOnce();
  });

  it("calls the original setter with the provided value", () => {
    const target = createTarget();
    const set = mock(target.set);
    const result = attr({ ...target, set }, new MockContext("label"));
    const element = new MockElement(defaultValue);

    result.init.call(element, element.value);
    result.set.call(element, "current");

    expect(set).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith("current");
  });

  it("reflects the value returned by the original getter", () => {
    const target = createTarget();

    const result = attr(
      {
        get: target.get,
        set(value) {
          this.value = value === null ? null : `label: ${value}`;
        },
      },
      new MockContext("label"),
    );

    const element = new MockElement(defaultValue);

    result.init.call(element, element.value);
    result.set.call(element, "current");

    expect(element.getAttribute("label")).toBe("label: current");
  });

  it("returns the default value instead of the current accessor value", () => {
    const target = createTarget();
    const result = attr(target, new MockContext("label"));
    const element = new MockElement(defaultValue);

    result.init.call(element, element.value);

    element.value = "custom";

    expect(result.get.call(element)).toBe(defaultValue);
  });

  it("preserves the default value after multiple attribute updates", () => {
    const target = createTarget();
    const result = attr(target, new MockContext("label"));
    const element = new MockElement(defaultValue);

    result.init.call(element, element.value);

    result.set.call(element, "first");
    result.set.call(element, "second");

    expect(result.get.call(element)).toBe("second");

    result.set.call(element, null);

    expect(result.get.call(element)).toBe(defaultValue);
  });

  it("throws when the accessor name is a symbol", () => {
    expect(() => attr(createTarget(), new MockContext(Symbol()))).toThrow(
      TypeError,
    );
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

    it("returns the default value after the attribute is removed", () => {
      class MyElement extends MockElement {
        @attr
        accessor label: string | null = "default";
      }

      const element = new MyElement();

      element.label = "current";
      expect(element.label).toBe("current");

      element.label = null;

      expect(element.hasAttribute("label")).toBe(false);
      expect<string | null>(element.label).toBe("default");
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

describe("reactive + attr", () => {
  class ReactiveAttrElement extends MockElement {
    @reactive
    @attr
    accessor label: string | null = "default";
  }

  class AttrReactiveElement extends MockElement {
    @attr
    @reactive
    accessor label: string | null = "default";
  }

  describe("@reactive @attr", () => {
    it("returns the default value when the attribute is absent", () => {
      const element = new ReactiveAttrElement();

      expect(element.label).toBe("default");
    });

    it("returns the attribute value when present", () => {
      const element = new ReactiveAttrElement();

      element.setAttribute("label", "external");

      expect(element.label).toBe("external");
    });

    it("reflects property changes to the attribute", () => {
      const element = new ReactiveAttrElement();

      element.label = "updated";

      expect(element.getAttribute("label")).toBe("updated");
      expect(element.label).toBe("updated");
    });

    it("removes the attribute when set to null", () => {
      const element = new ReactiveAttrElement();

      element.label = null;

      expect(element.hasAttribute("label")).toBe(false);
      expect<string | null>(element.label).toBe("default");
    });

    it("tracks reads through the attr decorator", () => {
      const element = new ReactiveAttrElement();
      const computed = new Signal.Computed(() => element.label);

      expect(computed.get()).toBe("default");

      element.label = "updated";

      expect(computed.get()).toBe("updated");
    });
  });

  describe("@attr @reactive", () => {
    it("returns the default value when the attribute is absent", () => {
      const element = new AttrReactiveElement();

      expect(element.label).toBe("default");
    });

    it("returns the attribute value when present", () => {
      const element = new AttrReactiveElement();

      element.setAttribute("label", "external");

      expect(element.label).toBe("external");
    });

    it("reflects property changes to the attribute", () => {
      const element = new AttrReactiveElement();

      element.label = "updated";

      expect(element.getAttribute("label")).toBe("updated");
      expect(element.label).toBe("updated");
    });

    it("removes the attribute when set to null", () => {
      const element = new AttrReactiveElement();

      element.label = null;

      expect(element.hasAttribute("label")).toBe(false);
      expect<string | null>(element.label).toBe("default");
    });

    it("tracks reads through the reactive decorator", () => {
      const element = new AttrReactiveElement();
      const computed = new Signal.Computed(() => element.label);

      expect(computed.get()).toBe("default");

      element.label = "updated";

      expect(computed.get()).toBe("updated");
    });
  });
});
