import {
  createReactiveSystem,
  type EffectConstructor,
  type SignalConstructor,
} from "./reactive.ts";
import { MicrotaskScheduler } from "./scheduler.ts";

/** Reactive system shared by the default `Effect` and `Signal` constructors. */
const system = createReactiveSystem();

/** Effect constructor bound to the default reactive system. */
export const Effect: EffectConstructor = system.Effect;

/** Signal constructor bound to the default reactive system. */
export const Signal: SignalConstructor = system.Signal;

/** Shared scheduler used by the default reactive system. */
const scheduler = new MicrotaskScheduler();

const observer = new system.Observer();

observer.observe((action) => {
  scheduler.schedule(action);
});
