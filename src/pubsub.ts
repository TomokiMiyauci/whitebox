import { State } from "./global.ts";

export class Observer {
  observe(target: object, property: PropertyKey): void {
    const state = new State(Reflect.get(target, property));

    Object.defineProperty(target, property, {
      configurable: true,
      enumerable: true,

      get(): unknown {
        return state.get;
      },

      set(next: unknown): void {
        state.set(next);
      },
    });
  }
}
