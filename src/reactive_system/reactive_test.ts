import { describe, it, expect, mock, beforeEach } from "bun:test";
import { Effect, ReactiveContext, Signal, Observer } from "./reactive.ts";

function observe(context: ReactiveContext): VoidFunction[] {
  const scheduled: VoidFunction[] = [];

  context.addEventListener("invalidate", (event) => {
    scheduled.push(event.detail);
  });

  return scheduled;
}

describe("Signal", () => {
  let context: ReactiveContext;

  beforeEach(() => {
    context = new ReactiveContext();
  });

  it("should not update when values are equal", () => {
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

  it("should track dependencies when read", () => {
    const stub = mock();
    context.track = stub;

    const signal = new Signal(context, 1);

    expect(signal.get).toBe(1);
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("should notify changes when updated", () => {
    const stub = mock();
    context.trigger = stub;

    const signal = new Signal(context, 1);

    signal.set(0);

    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("should not notify changes when setting the same value", () => {
    const stub = mock();
    context.trigger = stub;

    const signal = new Signal(context, 1);

    signal.set(1);

    expect(stub).not.toHaveBeenCalled();
  });
});

describe("Effect", () => {
  it("should run immediately", () => {
    const context = new ReactiveContext();
    const signal = new Signal(context, 1);
    const stub = mock();

    new Effect(context, () => {
      stub();
      signal.get;
    });

    expect(stub).toHaveBeenCalledOnce();
  });

  it("should rerun when a dependency changes", () => {
    const context = new ReactiveContext();
    new Observer(context).observe((callback) => callback());

    const signal = new Signal(context, 1);
    const stub = mock();

    new Effect(context, () => {
      stub();
      signal.get;
    });

    signal.set(2);
    signal.set(3);

    expect(stub).toHaveBeenCalledTimes(3);
  });

  it("should capture dependency keys read during execution", () => {
    const context = new ReactiveContext();
    const dependency = {};
    const signal = new Signal(context, 1);

    const captured = context.capture(() => {
      context.track(dependency);
      return signal.get;
    });

    expect(captured.value).toBe(1);
    expect(captured.dependencies).toEqual(new Set([signal, dependency]));
  });

  it("should update dependencies when it reruns", () => {
    const context = new ReactiveContext();
    const scheduled = observe(context);
    const useFirst = new Signal(context, true);
    const first = new Signal(context, 1);
    const second = new Signal(context, 2);

    new Effect(context, () => {
      if (useFirst.get) {
        first.get;
      } else {
        second.get;
      }
    });

    useFirst.set(false);
    scheduled.shift()?.();

    first.set(3);
    expect(scheduled).toHaveLength(0);

    second.set(4);
    expect(scheduled).toHaveLength(1);
  });

  it("should support multiple effects depending on the same signal", () => {
    const context = new ReactiveContext();
    const scheduled = observe(context);
    const signal = new Signal(context, 1);

    new Effect(context, () => signal.get);
    new Effect(context, () => signal.get);

    signal.set(2);

    expect(scheduled).toHaveLength(2);
  });

  it("should support multiple dependencies for the same effect", () => {
    const context = new ReactiveContext();
    const scheduled = observe(context);
    const first = new Signal(context, 1);
    const second = new Signal(context, 2);

    new Effect(context, () => {
      first.get;
      second.get;
    });

    first.set(3);
    second.set(4);

    expect(scheduled).toHaveLength(2);
  });

  it("should remove dependencies when stopped", () => {
    const context = new ReactiveContext();
    const scheduled = observe(context);
    const signal = new Signal(context, 1);
    const effect = new Effect(context, () => signal.get);

    effect.stop();
    signal.set(2);

    expect(scheduled).toHaveLength(0);
  });

  it("should not execute scheduled actions after stopping", () => {
    const context = new ReactiveContext();
    const scheduled = observe(context);
    const signal = new Signal(context, 1);
    const stub = mock();

    const effect = new Effect(context, () => {
      stub();
      signal.get;
    });

    signal.set(2);

    expect(scheduled).toHaveLength(1);

    effect.stop();
    scheduled.shift()?.();

    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("should allow stopping multiple times", () => {
    const context = new ReactiveContext();
    const signal = new Signal(context, 1);
    const effect = new Effect(context, () => signal.get);

    effect.stop();
    effect.stop();

    expect(() => signal.set(2)).not.toThrow();
  });

  it("should not run cleanup before rerunning", () => {
    const context = new ReactiveContext();
    new Observer(context).observe((callback) => callback());
    const stub = mock();

    new Effect(context, (onCleanup) => {
      onCleanup(stub);
    });

    expect(stub).not.toHaveBeenCalled();
  });

  it("should run cleanup before rerunning", () => {
    const context = new ReactiveContext();
    new Observer(context).observe((callback) => callback());
    const signal = new Signal(context, 1);
    const calls: string[] = [];

    new Effect(context, (onCleanup) => {
      calls.push("run");
      onCleanup(() => calls.push("cleanup"));
      signal.get;
    });

    expect(calls).toEqual(["run"]);

    signal.set(2);

    expect(calls).toEqual(["run", "cleanup", "run"]);
  });

  it("should run cleanup when stopped", () => {
    const context = new ReactiveContext();
    const signal = new Signal(context, 1);
    const cleanup = mock();

    const effect = new Effect(context, (onCleanup) => {
      onCleanup(cleanup);
      signal.get;
    });

    expect(cleanup).not.toHaveBeenCalled();

    effect.stop();

    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("should run each cleanup only once", () => {
    const context = new ReactiveContext();
    new Observer(context).observe((callback) => callback());
    const signal = new Signal(context, 1);
    const first = mock();
    const second = mock();

    const effect = new Effect(context, (onCleanup) => {
      onCleanup(first);
      onCleanup(second);
      signal.get;
    });

    signal.set(2);

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();

    effect.stop();

    expect(first).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledTimes(2);
  });

  it("should not track dependencies during cleanup", () => {
    const context = new ReactiveContext();
    const scheduled = observe(context);
    const signal = new Signal(context, 1);
    const cleanupSignal = new Signal(context, 1);

    new Effect(context, (onCleanup) => {
      onCleanup(() => cleanupSignal.get);
      signal.get;
    });

    signal.set(2);
    scheduled.shift()?.();

    cleanupSignal.set(2);

    expect(scheduled).toHaveLength(0);
  });
});

describe("Observer", () => {
  it("should observe invalidated effects", () => {
    const context = new ReactiveContext();
    const observer = new Observer(context);
    const scheduled: VoidFunction[] = [];

    const dispose = observer.observe((action) => {
      scheduled.push(action);
    });

    const signal = new Signal(context, 1);
    new Effect(context, () => signal.get);

    signal.set(2);

    expect(scheduled).toHaveLength(1);

    dispose();
    signal.set(3);

    expect(scheduled).toHaveLength(1);
  });
});
