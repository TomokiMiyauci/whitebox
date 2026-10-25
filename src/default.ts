import { Reactive, type Subscriber } from "./reactive.ts";

const subscribers = new WeakMap<object, Set<Subscriber>>();
const reactive = new Reactive(subscribers);
const subscribe = reactive.subscribe.bind(reactive);
const observe = reactive.observe.bind(reactive);

export { observe, subscribe };
