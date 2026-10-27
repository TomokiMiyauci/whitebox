import { Reactive, type Subscriber, Observer } from "./reactive.ts";

const subscribers = new WeakMap<object, Set<Subscriber>>();
const reactive = new Reactive(subscribers);
const subscribe = reactive.subscribe.bind(reactive);
const observer = new Observer(reactive);
const observe = observer.observe.bind(observer);

export { observe, subscribe };
