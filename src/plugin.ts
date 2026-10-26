import type { Renderer } from "./renderer.ts";

export interface AttributeChangedCallback {
  (
    this: object,
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void;
}

export interface Plugin {
  provide(name: "observedAttributes", value: string[]): void;
  provide(
    name: "attributeChangedCallback",
    value: AttributeChangedCallback,
  ): void;
  provide(name: "renderer", value: Renderer<unknown>): void;

  consume(name: "observedAttributes"): string[][];
  consume(name: "attributeChangedCallback"): AttributeChangedCallback[];
  consume(name: "renderer"): Renderer<unknown> | null;
}

export interface PluginRegistry {
  observedAttributes: string[][];
  attributeChangedCallback: AttributeChangedCallback[];
  renderer: Renderer<unknown> | null;
}

class PluginImpl implements Plugin {
  #registry: PluginRegistry;
  constructor(registry: PluginRegistry) {
    this.#registry = registry;
  }

  provide(
    name: "observedAttributes",
    value: string[],
  ): void;
  provide(
    name: "attributeChangedCallback",
    value: AttributeChangedCallback,
  ): void;
  provide(
    name: "renderer",
    value: Renderer<unknown>,
  ): void;
  provide(
    name: keyof PluginRegistry,
    value: string[] | AttributeChangedCallback | Renderer<unknown> | null,
  ): void {
    switch (name) {
      case "observedAttributes": {
        this.#registry.observedAttributes.push(value as string[]);
        break;
      }
      case "attributeChangedCallback": {
        this.#registry.attributeChangedCallback.push(
          value as AttributeChangedCallback,
        );
        break;
      }
      case "renderer": {
        this.#registry.renderer = value as Renderer<unknown>;
        break;
      }
    }
  }

  consume(name: "observedAttributes"): string[][];
  consume(
    name: "attributeChangedCallback",
  ): AttributeChangedCallback[];
  consume(
    name: "renderer",
  ): Renderer<unknown> | null;
  consume(
    name: keyof PluginRegistry,
  ): string[][] | AttributeChangedCallback[] | Renderer<unknown> | null {
    return this.#registry[name];
  }
}

const PLUGIN = Symbol();

export function getPlugin(metadata: DecoratorMetadataObject): Plugin {
  const existing = metadata[PLUGIN];

  if (existing instanceof PluginImpl) {
    return existing;
  }

  const plugin = new PluginImpl({
    observedAttributes: [],
    attributeChangedCallback: [],
    renderer: null,
  });

  metadata[PLUGIN] = plugin;

  return plugin;
}
