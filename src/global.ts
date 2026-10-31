import {
  createReactiveSystem,
  type EffectConstructor,
  type SignalConstructor,
} from "./reactive.ts";
import { MicrotaskScheduler } from "./scheduler.ts";

/** Shared scheduler used by the default reactive system. */
const scheduler = new MicrotaskScheduler();

/** Reactive system shared by the default `Effect` and `Signal` constructors. */
const reactiveSystem = createReactiveSystem((action) => {
  scheduler.schedule(action);
});

/** Effect constructor bound to the default reactive system. */
export const Effect: EffectConstructor = reactiveSystem.Effect;

/** Signal constructor bound to the default reactive system. */
export const Signal: SignalConstructor = reactiveSystem.Signal;
