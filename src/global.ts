import { Observer } from "./pubsub.ts";
import { createReactiveSystem } from "./reactive.ts";
import { MicrotaskScheduler } from "./scheduler.ts";

const scheduler = new MicrotaskScheduler();
export const { Effect, State } = createReactiveSystem((action) => {
  scheduler.schedule(action);
});

const observer = new Observer();
const observe = observer.observe.bind(observer);

export { observe };
