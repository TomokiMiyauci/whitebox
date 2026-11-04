import { Effect, ReactiveContext, Signal, Observer } from "./reactive.ts";
import { describe, it, expect, mock, beforeEach } from "bun:test";

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
    context.notifyChange = stub;

    const signal = new Signal(context, 1);

    signal.set(0);

    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("should not notify changes when setting the same value", () => {
    const stub = mock();
    context.notifyChange = stub;

    const signal = new Signal(context, 1);

    signal.set(1);

    expect(stub).not.toHaveBeenCalled();
  });
});

describe("Effect", () => {
  it("should subscribe after running", () => {
    const context = new ReactiveContext();
    const scheduled = observe(context);
    const signal = new Signal(context, 1);
    let runs = 0;

    const effect = new Effect(context, () => {
      runs++;
      signal.get;
    });

    signal.set(2);
    expect(scheduled).toHaveLength(0);

    effect.run();
    signal.set(3);

    expect(scheduled).toHaveLength(1);
    expect(runs).toBe(1);
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

  it("should support multiple effects depending on the same signal", () => {
    const context = new ReactiveContext();
    const scheduled = observe(context);
    const signal = new Signal(context, 1);

    const first = new Effect(context, () => signal.get);
    const second = new Effect(context, () => signal.get);

    first.run();
    second.run();

    signal.set(2);

    expect(scheduled).toHaveLength(2);
  });

  it("should support multiple dependencies for the same effect", () => {
    const context = new ReactiveContext();
    const scheduled = observe(context);
    const first = new Signal(context, 1);
    const second = new Signal(context, 2);

    const effect = new Effect(context, () => {
      first.get;
      second.get;
    });

    effect.run();

    first.set(3);
    second.set(4);

    expect(scheduled).toHaveLength(2);
  });

  it("should remove dependencies that are no longer used", () => {
    const context = new ReactiveContext();
    const scheduled = observe(context);
    const condition = new Signal(context, true);
    const first = new Signal(context, 1);
    const second = new Signal(context, 2);

    const effect = new Effect(context, () => {
      if (condition.get) {
        first.get;
      } else {
        second.get;
      }
    });

    effect.run();

    condition.set(false);
    scheduled.shift()?.();

    first.set(3);
    expect(scheduled).toHaveLength(0);

    second.set(4);
    expect(scheduled).toHaveLength(1);
  });

  it("should stop before running", () => {
    const context = new ReactiveContext();
    const scheduled = observe(context);
    const signal = new Signal(context, 1);
    const stub = mock();

    const effect = new Effect(context, () => {
      stub();
      signal.get;
    });

    effect.stop();
    effect.run();
    signal.set(2);

    expect(stub).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(0);
  });

  it("should remove dependencies when stopped", () => {
    const context = new ReactiveContext();
    const scheduled = observe(context);
    const signal = new Signal(context, 1);
    const effect = new Effect(context, () => signal.get);

    effect.run();
    effect.stop();
    signal.set(2);

    expect(scheduled).toHaveLength(0);
  });

  it("should not run after stopping", () => {
    const context = new ReactiveContext();
    const signal = new Signal(context, 1);
    const stub = mock();

    const effect = new Effect(context, () => {
      stub();
      signal.get;
    });

    effect.run();
    effect.stop();
    effect.run();

    expect(stub).toHaveBeenCalledTimes(1);
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

    effect.run();
    signal.set(2);

    expect(scheduled).toHaveLength(1);

    effect.stop();
    scheduled.shift()?.();

    expect(stub).toHaveBeenCalledTimes(1);
  });

  it("should allow stopping multiple times", () => {
    const context = new ReactiveContext();
    const scheduled = observe(context);
    const signal = new Signal(context, 1);
    const effect = new Effect(context, () => signal.get);

    effect.run();
    effect.stop();
    effect.stop();

    signal.set(2);

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
    const effect = new Effect(context, () => signal.get);

    effect.run();
    signal.set(2);

    expect(scheduled).toHaveLength(1);

    dispose();
    signal.set(3);

    expect(scheduled).toHaveLength(1);
  });
});
