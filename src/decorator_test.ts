import { describe, expect, mock, it } from "bun:test";
import { effect, reactive } from "./decorator.ts";

const flush = () => Promise.resolve();

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
});
