import type { Scheduler } from "./scheduler.ts";

type AnyState = State<unknown>;

interface Equality<T> {
  equals(left: T, right: T): boolean;
}

class ReactiveContext extends EventTarget {}

interface ReactiveContext extends EventTarget {
  addEventListener(
    type: "get",
    listener: (ev: CustomEvent<AnyState>) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: "get",
    listener: (ev: CustomEvent<AnyState>) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

const context = new ReactiveContext();

export class State<T> implements Equality<T> {
  #current: T;

  constructor(current: T) {
    this.#current = current;
  }

  get get(): T {
    context.dispatchEvent(new CustomEvent("get", { detail: this }));

    return this.#current;
  }

  set(value: T): boolean {
    if (this.equals(this.#current, value)) {
      return false;
    }

    this.#current = value;

    return true;
  }

  equals(left: T, right: T): boolean {
    return Object.is(left, right);
  }
}

export class Effect {
  private deps = new WeakSet<AnyState>();
  private fn: VoidFunction;

  constructor(fn: VoidFunction) {
    this.fn = fn;
  }

  dependsOn(state: AnyState): boolean {
    return this.deps.has(state);
  }

  readonly scheduledRun: VoidFunction = () => {
    this.run();
  };

  run(): void {
    const deps = new WeakSet<AnyState>();

    function handler(ev: CustomEvent<AnyState>): void {
      deps.add(ev.detail);
    }

    context.addEventListener("get", handler);

    try {
      this.fn();
    } finally {
      context.removeEventListener("get", handler);
    }
    this.deps = deps;
  }
}

export class Engine {
  private effects = new Set<Effect>();
  #scheduler: Scheduler;

  constructor(scheduler: Scheduler) {
    this.#scheduler = scheduler;
  }

  register(effect: Effect): void {
    this.effects.add(effect);
  }

  unregister(effect: Effect): void {
    this.effects.delete(effect);
  }

  mutate<T>(state: State<T>, value: T): void {
    if (!state.set(value)) {
      return;
    }

    for (const effect of this.effects) {
      if (effect.dependsOn(state)) {
        this.#scheduler.schedule(effect.scheduledRun);
      }
    }
  }
}
