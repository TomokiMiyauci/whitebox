import { afterEach, describe, expect, it, mock } from "bun:test";
import { Signal } from "./wrapper.ts";

describe("Watcher", () => {
  type Destructor = () => void;
  const notifySpy = mock();

  const watcher = new Signal.subtle.Watcher(() => {
    notifySpy();
  });

  function effect(cb: () => Destructor | void): () => void {
    let destructor: Destructor | void;
    const c = new Signal.Computed(() => (destructor = cb()));
    watcher.watch(c);
    c.get();
    return () => {
      destructor?.();
      watcher.unwatch(c);
    };
  }

  function flushPending() {
    for (const signal of watcher.getPending()) {
      signal.get();
    }
    expect(watcher.getPending()).toStrictEqual([]);
  }

  afterEach(() => watcher.unwatch(...Signal.subtle.introspectSources(watcher)));

  it("should work", () => {
    const watchedSpy = mock();
    const unwatchedSpy = mock();
    const stateSignal = new Signal.State(1, {
      [Signal.subtle.watched]: watchedSpy,
      [Signal.subtle.unwatched]: unwatchedSpy,
    });

    stateSignal.set(100);
    stateSignal.set(5);

    const computedSignal = new Signal.Computed(() => stateSignal.get() * 2);

    let calls = 0;
    let output = 0;
    let computedOutput = 0;

    // Ensure the call backs are not called yet
    expect(watchedSpy).not.toHaveBeenCalled();
    expect(unwatchedSpy).not.toHaveBeenCalled();

    // Expect the watcher to not have any sources as nothing has been connected yet
    expect(Signal.subtle.introspectSources(watcher)).toHaveLength(0);
    expect(Signal.subtle.introspectSinks(computedSignal)).toHaveLength(0);
    expect(Signal.subtle.introspectSinks(stateSignal)).toHaveLength(0);

    expect(Signal.subtle.hasSinks(stateSignal)).toEqual(false);

    const destructor = effect(() => {
      output = stateSignal.get();
      computedOutput = computedSignal.get();
      calls++;
      return () => {};
    });

    // The signal is now watched
    expect(Signal.subtle.hasSinks(stateSignal)).toEqual(true);

    // Now that the effect is created, there will be a source
    expect(Signal.subtle.introspectSources(watcher)).toHaveLength(1);
    expect(Signal.subtle.introspectSinks(computedSignal)).toHaveLength(1);

    // Note: stateSignal has more sinks because one is for the computed signal and one is the effect.
    expect(Signal.subtle.introspectSinks(stateSignal)).toHaveLength(2);

    // Now the watched callback should be called
    expect(watchedSpy).toHaveBeenCalled();
    expect(unwatchedSpy).not.toHaveBeenCalled();

    // It should not have notified yet
    expect(notifySpy).not.toHaveBeenCalled();

    stateSignal.set(10);

    // After a signal has been set, it should notify
    expect(notifySpy).toHaveBeenCalled();

    // Initially, the effect should not have run
    expect(calls).toEqual(1);
    expect(output).toEqual(5);
    expect(computedOutput).toEqual(10);

    flushPending();

    // The effect should run, and thus increment the value
    expect(calls).toEqual(2);
    expect(output).toEqual(10);
    expect(computedOutput).toEqual(20);

    // Kicking it off again, the effect should run again
    watcher.watch();
    stateSignal.set(20);
    expect(watcher.getPending()).toHaveLength(1);
    flushPending();

    // After a signal has been set, it should notify again
    expect(notifySpy).toHaveBeenCalledTimes(2);

    expect(calls).toEqual(3);
    expect(output).toEqual(20);
    expect(computedOutput).toEqual(40);

    Signal.subtle.untrack(() => {
      // Untrack doesn't affect set, only get
      stateSignal.set(999);
      expect(calls).toEqual(3);
      flushPending();
      expect(calls).toEqual(4);
    });

    // Destroy and un-subscribe
    destructor();

    // Since now it is un-subscribed, it should now be called
    expect(unwatchedSpy).toHaveBeenCalled();
    // We can confirm that it is un-watched by checking it
    expect(Signal.subtle.hasSinks(stateSignal)).toEqual(false);

    // Since now it is un-subscribed, this should have no effect now
    stateSignal.set(200);
    flushPending();

    // Make sure that effect is no longer running
    // Everything should stay the same
    expect(calls).toEqual(4);
    expect(output).toEqual(999);
    expect(computedOutput).toEqual(1998);

    expect(watcher.getPending()).toHaveLength(0);

    // Adding any other effect after an unwatch should work as expected
    effect(() => {
      output = stateSignal.get();
      return () => {};
    });

    stateSignal.set(300);
    flushPending();
  });

  it("provides `this` to notify as normal function", () => {
    const mockGetPending = mock();

    const watcher = new Signal.subtle.Watcher(function () {
      this.getPending();
    });
    watcher.getPending = mockGetPending;

    const signal = new Signal.State<number>(0);
    watcher.watch(signal);

    signal.set(1);
    expect(mockGetPending).toBeCalled();
  });

  it("can be closed in if needed in notify as an arrow function", () => {
    const mockGetPending = mock();

    const watcher = new Signal.subtle.Watcher(() => {
      watcher.getPending();
    });
    watcher.getPending = mockGetPending;

    const signal = new Signal.State<number>(0);
    watcher.watch(signal);

    signal.set(1);
    expect(mockGetPending).toBeCalled();
  });

  it("should not break a computed signal to watch it before getting its value", () => {
    const signal = new Signal.State(0);
    const computedSignal = new Signal.Computed(() => signal.get());
    const watcher = new Signal.subtle.Watcher(() => {});
    expect(computedSignal.get()).toBe(0);
    signal.set(1);
    watcher.watch(computedSignal);
    expect(computedSignal.get()).toBe(1);
    watcher.unwatch(computedSignal);
    expect(computedSignal.get()).toBe(1);
  });
});

describe("watch and unwatch", () => {
  it("handles multiple watchers well", () => {
    const s = new Signal.State(1);
    const s2 = new Signal.State(2);
    let n = 0;
    const w = new Signal.subtle.Watcher(() => n++);
    w.watch(s, s2);

    s.set(4);
    expect(n).toBe(1);
    expect(w.getPending()).toStrictEqual([]);

    w.watch();
    s2.set(8);
    expect(n).toBe(2);

    w.unwatch(s);
    s.set(3);
    expect(n).toBe(2);

    w.watch();
    s2.set(3);
    expect(n).toBe(3);

    w.watch();
    s.set(2);
    expect(n).toBe(3);
  });
  it("understands dynamic dependency sets", () => {
    let w1 = 0,
      u1 = 0,
      w2 = 0,
      u2 = 0,
      n = 0,
      d = 0;
    let s1 = new Signal.State(1, {
      [Signal.subtle.watched]() {
        w1++;
      },
      [Signal.subtle.unwatched]() {
        u1++;
      },
    });
    let s2 = new Signal.State(2, {
      [Signal.subtle.watched]() {
        w2++;
      },
      [Signal.subtle.unwatched]() {
        u2++;
      },
    });
    let which: { get(): number } = s1;
    let c = new Signal.Computed(() => (d++, which.get()));
    let w = new Signal.subtle.Watcher(() => n++);

    w.watch(c);
    expect(w1 + w2 + u1 + u2 + n + d).toBe(0);
    expect(Signal.subtle.hasSinks(s1)).toBe(false);
    expect(Signal.subtle.hasSinks(s2)).toBe(false);
    expect(w.getPending()).toStrictEqual([c]);

    expect(c.get()).toBe(1);
    expect(w1).toBe(1);
    expect(u1).toBe(0);
    expect(w2).toBe(0);
    expect(u2).toBe(0);
    expect(n).toBe(0);
    expect(Signal.subtle.hasSinks(s1)).toBe(true);
    expect(Signal.subtle.hasSinks(s2)).toBe(false);
    expect(w.getPending()).toStrictEqual([]);
    expect(d).toBe(1);

    s1.set(3);
    expect(w1).toBe(1);
    expect(u1).toBe(0);
    expect(w2).toBe(0);
    expect(u2).toBe(0);
    expect(n).toBe(1);
    expect(Signal.subtle.hasSinks(s1)).toBe(true);
    expect(Signal.subtle.hasSinks(s2)).toBe(false);
    expect(w.getPending()).toStrictEqual([c]);
    expect(d).toBe(1);

    expect(c.get()).toBe(3);
    expect(w1).toBe(1);
    expect(u1).toBe(0);
    expect(w2).toBe(0);
    expect(u2).toBe(0);
    expect(n).toBe(1);
    expect(Signal.subtle.hasSinks(s1)).toBe(true);
    expect(Signal.subtle.hasSinks(s2)).toBe(false);
    expect(w.getPending()).toStrictEqual([]);
    expect(d).toBe(2);

    which = s2;
    w.watch();
    s1.set(4);
    expect(w1).toBe(1);
    expect(u1).toBe(0);
    expect(w2).toBe(0);
    expect(u2).toBe(0);
    expect(n).toBe(2);
    expect(Signal.subtle.hasSinks(s1)).toBe(true);
    expect(Signal.subtle.hasSinks(s2)).toBe(false);
    expect(w.getPending()).toStrictEqual([c]);
    expect(d).toBe(2);

    expect(c.get()).toBe(2);
    expect(w1).toBe(1);
    expect(u1).toBe(1);
    expect(w2).toBe(1);
    expect(u2).toBe(0);
    expect(n).toBe(2);
    expect(Signal.subtle.hasSinks(s1)).toBe(false);
    expect(Signal.subtle.hasSinks(s2)).toBe(true);
    expect(w.getPending()).toStrictEqual([]);
    expect(d).toBe(3);

    w.watch();
    which = {
      get() {
        return 10;
      },
    };
    s1.set(5);
    expect(c.get()).toBe(2);
    expect(w1).toBe(1);
    expect(u1).toBe(1);
    expect(w2).toBe(1);
    expect(u2).toBe(0);
    expect(n).toBe(2);
    expect(Signal.subtle.hasSinks(s1)).toBe(false);
    expect(Signal.subtle.hasSinks(s2)).toBe(true);
    expect(w.getPending()).toStrictEqual([]);
    expect(d).toBe(3);

    w.watch();
    s2.set(0);
    expect(w1).toBe(1);
    expect(u1).toBe(1);
    expect(w2).toBe(1);
    expect(u2).toBe(0);
    expect(n).toBe(3);
    expect(Signal.subtle.hasSinks(s1)).toBe(false);
    expect(Signal.subtle.hasSinks(s2)).toBe(true);
    expect(w.getPending()).toStrictEqual([c]);
    expect(d).toBe(3);

    expect(c.get()).toBe(10);
    expect(w1).toBe(1);
    expect(u1).toBe(1);
    expect(w2).toBe(1);
    expect(u2).toBe(1);
    expect(n).toBe(3);
    expect(Signal.subtle.hasSinks(s1)).toBe(false);
    expect(Signal.subtle.hasSinks(s2)).toBe(false);
    expect(w.getPending()).toStrictEqual([]);
    expect(d).toBe(4);
  });
  it("can unwatch multiple signals", async () => {
    const signals = [...Array(7)].map((_, i) => new Signal.State(i));
    const notify = mock();
    const watcher = new Signal.subtle.Watcher(notify);
    const expectSources = (expected: typeof signals) => {
      const sources = Signal.subtle.introspectSources(
        watcher,
      ) as typeof signals;
      sources.sort((a, b) => signals.indexOf(a) - signals.indexOf(b));
      expected.sort((a, b) => signals.indexOf(a) - signals.indexOf(b));
      return expect(sources).toEqual(expected);
    };

    watcher.watch(...signals);
    expectSources(signals);

    const unwatched = [0, 3, 4, 6].map((i) => signals[i]);
    const watched = signals.filter((s) => !unwatched.includes(s));

    watcher.unwatch(...unwatched);
    expectSources(watched);

    let expectedNotifyCalls = 0;
    for (const signal of signals) {
      signal.set(signal.get() + 1);
      if (watched.includes(signal)) ++expectedNotifyCalls;

      expect(notify).toHaveBeenCalledTimes(expectedNotifyCalls);

      watcher.watch();
    }
  });
});

describe("Untrack", () => {
  it("works", () => {
    const state = new Signal.State(1);
    const computed = new Signal.Computed(() =>
      Signal.subtle.untrack(() => state.get()),
    );
    expect(computed.get()).toBe(1);
    state.set(2);
    expect(computed.get()).toBe(1);
  });

  it("works differently without untrack", () => {
    const state = new Signal.State(1);
    const computed = new Signal.Computed(() => state.get());
    expect(computed.get()).toBe(1);
    state.set(2);
    expect(computed.get()).toBe(2);
  });
});

describe("currentComputed", () => {
  it("works", () => {
    expect(Signal.subtle.currentComputed()).toBe(undefined);
    let context: Signal.Computed<any> | undefined;

    let c = new Signal.Computed(
      () => (context = Signal.subtle.currentComputed()),
    );
    c.get();
    expect(c).toBe(context);
  });
});
