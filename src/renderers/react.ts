import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";
import { Effect } from "../global.ts";

interface Renderer<P> {
  render(props: P, container: HTMLElement): void;
  dispose(containerr: HTMLElement): void;
}

export class ReactRenderer<P> implements Renderer<P> {
  readonly #fn: (props: P) => ReactNode;
  readonly #roots = new WeakMap<HTMLElement, Root>();

  constructor(fn: (props: P) => ReactNode) {
    this.#fn = fn;
  }

  render(props: P, container: HTMLElement): void {
    let root = this.#roots.get(container);

    if (!root) {
      root = createRoot(container);
      this.#roots.set(container, root);
    }

    const node = this.#fn(props);

    root.render(node);
  }

  dispose(container: HTMLElement): void {
    const root = this.#roots.get(container);

    if (!root) return;

    root.unmount();
    this.#roots.delete(container);
  }
}

type Constructor = new (...args: any[]) => HTMLElement;

export function template<T extends Constructor>(
  fn: (props: InstanceType<T>) => ReactNode,
) {
  return (constructor: T): T => {
    return class extends constructor {
      constructor(...args: any[]) {
        super(...args);
        const renderer = new ReactRenderer(fn);
        const bound = () => renderer.render(this as InstanceType<T>, this);

        const effect = new Effect(bound);

        effect.run();
      }
    };
  };
}
