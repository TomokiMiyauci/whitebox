import { describe, expect, it, mock } from "bun:test";
import { MicrotaskScheduler } from "./scheduler.ts";

describe("MicrotaskScheduler", () => {
  it("schedules tasks in a microtask", async () => {
    const scheduler = new MicrotaskScheduler();
    const task = mock();

    scheduler.schedule(task);

    expect(task).not.toHaveBeenCalled();

    await Promise.resolve();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it("deduplicates identical tasks", async () => {
    const scheduler = new MicrotaskScheduler();
    const task = mock();

    scheduler.schedule(task);
    scheduler.schedule(task);
    scheduler.schedule(task);

    await Promise.resolve();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it("runs distinct tasks in scheduling order", async () => {
    const scheduler = new MicrotaskScheduler();
    const calls: number[] = [];

    scheduler.schedule(() => calls.push(1));
    scheduler.schedule(() => calls.push(2));
    scheduler.schedule(() => calls.push(3));

    await Promise.resolve();

    expect(calls).toEqual([1, 2, 3]);
  });

  it("schedules tasks added during execution in the next microtask", async () => {
    const scheduler = new MicrotaskScheduler();
    const calls: number[] = [];

    const second = () => calls.push(2);

    scheduler.schedule(() => {
      calls.push(1);
      scheduler.schedule(second);
    });

    await Promise.resolve();

    expect(calls).toEqual([1]);

    await Promise.resolve();

    expect(calls).toEqual([1, 2]);
  });
});
