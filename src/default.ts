import { WeakMapPubSub, Observer } from "./reactive.ts";

const pubsub = new WeakMapPubSub();
const subscribe = pubsub.subscribe.bind(pubsub);
const observer = new Observer(pubsub);
const observe = observer.observe.bind(observer);

export { observe, subscribe };
