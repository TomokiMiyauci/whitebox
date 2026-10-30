import type { Renderer } from "../renderer.ts";
import { render, type VNode } from "preact";
import { Effect } from "../global.ts";

export class PreactRenderer<P> implements Renderer<P> {
  #fn: (props: P) => VNode;
  constructor(fn: (props: P) => VNode) {
    this.#fn = fn;
  }
  render(props: P, container: HTMLElement): void {
    const node = this.#fn(props);

    render(node, container);
  }

  dispose(container: HTMLElement): void {
    render(null, container);
  }
}

type Constructor = new (...args: any[]) => HTMLElement;

export function template<T extends Constructor>(
  fn: (props: InstanceType<T>) => VNode,
) {
  return (constructor: T): T => {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);
        const renderer = new PreactRenderer(fn);
        const bound = () => renderer.render(this as InstanceType<T>, this);

        const effect = new Effect(bound);

        effect.run();
      }
    };
  };
}
