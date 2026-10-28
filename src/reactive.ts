import type { Scheduler } from "./scheduler.ts";

type AnyState = State<any>;

interface Equality<T> {
  (left: T, right: T): boolean;
}

let activeEffect: Effect | undefined;

export class State<T> {
  #current: T;
  #equals: Equality<T>;

  constructor(current: T, equals: Equality<T> = Object.is) {
    this.#current = current;
    this.#equals = equals;
  }

  get value(): T {
    activeEffect?.track(this);
    return this.#current;
  }

  setValue(value: T): boolean {
    if (this.#equals(this.#current, value)) {
      return false;
    }

    this.#current = value;
    return true;
  }
}

export class Effect {
  private deps = new WeakSet<AnyState>();
  private fn: VoidFunction;

  constructor(fn: VoidFunction) {
    this.fn = fn;
  }

  track(state: AnyState): void {
    this.deps.add(state);
  }

  dependsOn(state: AnyState): boolean {
    return this.deps.has(state);
  }

  readonly scheduledRun: VoidFunction = () => {
    this.run();
  };

  run(): void {
    const previous = activeEffect;
    this.deps = new WeakSet();

    activeEffect = this;

    try {
      this.fn();
    } finally {
      activeEffect = previous;
    }
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
    if (!state.setValue(value)) {
      return;
    }

    for (const effect of this.effects) {
      if (effect.dependsOn(state)) {
        this.#scheduler.schedule(effect.scheduledRun);
      }
    }
  }
}
