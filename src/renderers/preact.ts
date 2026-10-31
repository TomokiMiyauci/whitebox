import { render, type VNode } from "preact";
import { Effect } from "../global.ts";

type Constructor = new (...args: any[]) => HTMLElement;

export function template<T extends Constructor>(
  fn: (props: InstanceType<T>) => VNode,
) {
  return (constructor: T): T => {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);
        const bound = () => render(fn(this as InstanceType<T>), this);

        const effect = new Effect(bound);

        effect.run();
      }
    };
  };
}
