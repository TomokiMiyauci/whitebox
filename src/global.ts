import { createReactiveSystem } from "./reactive.ts";
import { MicrotaskScheduler } from "./scheduler.ts";

const scheduler = new MicrotaskScheduler();
export const { Effect, Signal } = createReactiveSystem((action) => {
  scheduler.schedule(action);
});
