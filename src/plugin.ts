import type { Effect } from "./reactive.ts";

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
  provide(
    name: "effect",
    value: (factory: { props: object; container: HTMLElement }) => Effect,
  ): void;

  consume(name: "observedAttributes"): string[][];
  consume(name: "attributeChangedCallback"): AttributeChangedCallback[];
  consume(name: "effect"): EffectFactory[];
}

export interface PluginRegistry {
  observedAttributes: string[][];
  attributeChangedCallback: AttributeChangedCallback[];
  effect: EffectFactory[];
}

interface EffectFactory {
  (context: EffectContext): Effect;
}

interface EffectContext {
  props: object;
  container: HTMLElement;
}

class PluginImpl implements Plugin {
  #registry: PluginRegistry;
  constructor(registry: PluginRegistry) {
    this.#registry = registry;
  }

  provide(name: "observedAttributes", value: string[]): void;
  provide(
    name: "attributeChangedCallback",
    value: AttributeChangedCallback,
  ): void;
  provide(name: "effect", value: EffectFactory): void;
  provide(
    name: keyof PluginRegistry,
    value: string[] | AttributeChangedCallback | EffectFactory | null,
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
      case "effect": {
        this.#registry.effect.push(value as EffectFactory);
      }
    }
  }

  consume(name: "observedAttributes"): string[][];
  consume(name: "attributeChangedCallback"): AttributeChangedCallback[];
  consume(name: "effect"): EffectFactory[];
  consume(
    name: keyof PluginRegistry,
  ): string[][] | AttributeChangedCallback[] | EffectFactory[] | null {
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
    effect: [],
  });

  metadata[PLUGIN] = plugin;

  return plugin;
}
