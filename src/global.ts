import { Observer } from "./pubsub.ts";
import { createReactiveSystem } from "./reactive.ts";
import { MicrotaskScheduler } from "./scheduler.ts";

export const { Effect, State, listen } = createReactiveSystem();

const scheduler = new MicrotaskScheduler();
listen((action) => {
  scheduler.schedule(action);
});
const observer = new Observer();
const observe = observer.observe.bind(observer);

export { observe, scheduler };
