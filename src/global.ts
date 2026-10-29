import { Observer } from "./pubsub.ts";
import { createReactiveSystem } from "./reactive.ts";
import { MicrotaskScheduler } from "./scheduler.ts";

export const { Effect, State, Engine } = createReactiveSystem();

const scheduler = new MicrotaskScheduler();
const engine = new Engine(scheduler);
engine.start();
const observer = new Observer();
const observe = observer.observe.bind(observer);

export { observe, scheduler, engine };
