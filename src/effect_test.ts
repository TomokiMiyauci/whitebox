import { describe, it, expect, mock } from "bun:test";
import Signal from "./signal/mod.ts";
import { Effect, EffectLifecycle, type Scheduler } from "./effect.ts";

class TestScheduler implements Scheduler {
  #queue: VoidFunction[] = [];

  schedule(task: VoidFunction): void {
    this.#queue.push(task);
  }

  flush(): void {
    const tasks = this.#queue;
    this.#queue = [];

    for (const task of tasks) {
      task();
    }
  }

  get size(): number {
    return this.#queue.length;
  }
}

describe("EffectLifecycle", () => {
  it("should provide predefined lifecycle values", () => {
    expect(EffectLifecycle.running.isRunning).toBe(true);
    expect(EffectLifecycle.paused.isPaused).toBe(true);
    expect(EffectLifecycle.stopped.isStopped).toBe(true);
  });

  it("should pause only when running", () => {
    expect(EffectLifecycle.pause(EffectLifecycle.running)).toBe(
      EffectLifecycle.paused,
    );

    expect(EffectLifecycle.pause(EffectLifecycle.paused)).toBe(
      EffectLifecycle.paused,
    );

    expect(EffectLifecycle.pause(EffectLifecycle.stopped)).toBe(
      EffectLifecycle.stopped,
    );
  });

  it("should resume only when paused", () => {
    expect(EffectLifecycle.resume(EffectLifecycle.paused)).toBe(
      EffectLifecycle.running,
    );

    expect(EffectLifecycle.resume(EffectLifecycle.running)).toBe(
      EffectLifecycle.running,
    );

    expect(EffectLifecycle.resume(EffectLifecycle.stopped)).toBe(
      EffectLifecycle.stopped,
    );
  });

  it("should stop from any lifecycle except stopped", () => {
    expect(EffectLifecycle.stop(EffectLifecycle.running)).toBe(
      EffectLifecycle.stopped,
    );

    expect(EffectLifecycle.stop(EffectLifecycle.paused)).toBe(
      EffectLifecycle.stopped,
    );

    expect(EffectLifecycle.stop(EffectLifecycle.stopped)).toBe(
      EffectLifecycle.stopped,
    );
  });
});

describe("Effect", () => {
  it("should run once after creation", () => {
    const action = mock();
    const scheduler = new TestScheduler();

    Effect.start(action, scheduler);

    expect(action).toHaveBeenCalledTimes(1);
    expect(scheduler.size).toBe(0);
  });

  it("should rerun when a dependency changes", () => {
    const action = mock();
    const scheduler = new TestScheduler();
    const count = new Signal.State(0);

    Effect.start(() => {
      action(count.get());
    }, scheduler);

    count.set(1);

    expect(action).toHaveBeenCalledTimes(1);
    expect(scheduler.size).toBe(1);

    scheduler.flush();

    expect(action).toHaveBeenCalledTimes(2);
    expect(action).toHaveBeenLastCalledWith(1);
  });

  it("should not rerun when a dependency does not change", () => {
    const action = mock();
    const scheduler = new TestScheduler();
    const count = new Signal.State(0);

    Effect.start(() => {
      action(count.get());
    }, scheduler);

    count.set(0);
    scheduler.flush();

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("should not rerun while paused", () => {
    const action = mock();
    const scheduler = new TestScheduler();
    const count = new Signal.State(0);

    const effect = Effect.start(() => {
      action(count.get());
    }, scheduler);

    effect.pause();

    count.set(1);
    scheduler.flush();

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("should rerun when resumed", () => {
    const action = mock();
    const scheduler = new TestScheduler();
    const count = new Signal.State(0);

    const effect = Effect.start(() => {
      action(count.get());
    }, scheduler);

    effect.pause();
    count.set(1);
    effect.resume();

    expect(action).toHaveBeenCalledTimes(2);
    expect(action).toHaveBeenLastCalledWith(1);
  });

  it("should not resume after stopped", () => {
    const action = mock();
    const scheduler = new TestScheduler();

    const effect = Effect.start(action, scheduler);

    effect.stop();
    effect.resume();

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("should not rerun after stopped", () => {
    const action = mock();
    const scheduler = new TestScheduler();
    const count = new Signal.State(0);

    const effect = Effect.start(() => {
      action(count.get());
    }, scheduler);

    effect.stop();
    count.set(1);
    scheduler.flush();

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("should ignore scheduled tasks after stopped", () => {
    const action = mock();
    const scheduler = new TestScheduler();
    const count = new Signal.State(0);

    const effect = Effect.start(() => {
      action(count.get());
    }, scheduler);

    count.set(1);
    effect.stop();

    scheduler.flush();

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("should maintain independent effects for each instance", () => {
    const action = mock();
    const scheduler = new TestScheduler();

    const first = new Signal.State(0);
    const second = new Signal.State(0);

    Effect.start(() => action(first.get()), scheduler);
    Effect.start(() => action(second.get()), scheduler);

    first.set(1);
    scheduler.flush();

    expect(action.mock.calls).toEqual([[0], [0], [1]]);

    second.set(2);
    scheduler.flush();

    expect(action.mock.calls).toEqual([[0], [0], [1], [2]]);
  });
});
