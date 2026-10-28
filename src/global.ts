import { Observer } from "./pubsub.ts";
import { Engine } from "./reactive.ts";
import { MicrotaskScheduler } from "./scheduler.ts";

const scheduler = new MicrotaskScheduler();
const engine = new Engine(scheduler);
const observer = new Observer(engine);
const observe = observer.observe.bind(observer);

export { observe, scheduler, engine };
