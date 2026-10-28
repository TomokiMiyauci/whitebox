import { WeakMapPubSub, Observer } from "./pubsub.ts";
import { MicrotaskScheduler } from "./scheduler.ts";

const pubsub = new WeakMapPubSub();
const subscribe = pubsub.subscribe.bind(pubsub);
const observer = new Observer(pubsub);
const observe = observer.observe.bind(observer);
const scheduler = new MicrotaskScheduler();

export { observe, subscribe, scheduler };
