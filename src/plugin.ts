import type { Effect } from "./reactive.ts";

export interface AttributeChangedCallback {
  (name: string, oldValue: string | null, newValue: string | null): void;
}

interface FactoryContext {
  props: object;
  container: HTMLElement;
}

interface Factory<T> {
  (context: FactoryContext): T;
}

export interface Plugin {
  provide(name: "observedAttributes", value: string[]): void;
  provide(
    name: "attributeChangedCallback",
    value: AttributeChangedCallbackFactory,
  ): void;
  provide(name: "effect", value: EffectFactory): void;

  consume(name: "observedAttributes"): string[][];
  consume(name: "attributeChangedCallback"): AttributeChangedCallbackFactory[];
  consume(name: "effect"): EffectFactory[];
}

export interface PluginRegistry {
  observedAttributes: string[][];
  attributeChangedCallback: AttributeChangedCallbackFactory[];
  effect: EffectFactory[];
}

interface EffectFactory extends Factory<Effect> {}
interface AttributeChangedCallbackFactory extends Factory<AttributeChangedCallback> {}

class PluginImpl implements Plugin {
  #registry: PluginRegistry;
  constructor(registry: PluginRegistry) {
    this.#registry = registry;
  }

  provide(name: "observedAttributes", value: string[]): void;
  provide(
    name: "attributeChangedCallback",
    value: AttributeChangedCallbackFactory,
  ): void;
  provide(name: "effect", value: EffectFactory): void;
  provide(
    name: keyof PluginRegistry,
    value: string[] | AttributeChangedCallbackFactory | EffectFactory | null,
  ): void {
    switch (name) {
      case "observedAttributes": {
        this.#registry.observedAttributes.push(value as string[]);
        break;
      }
      case "attributeChangedCallback": {
        this.#registry.attributeChangedCallback.push(
          value as AttributeChangedCallbackFactory,
        );
        break;
      }
      case "effect": {
        this.#registry.effect.push(value as EffectFactory);
      }
    }
  }

  consume(name: "observedAttributes"): string[][];
  consume(name: "attributeChangedCallback"): AttributeChangedCallbackFactory[];
  consume(name: "effect"): EffectFactory[];
  consume(
    name: keyof PluginRegistry,
  ): string[][] | AttributeChangedCallbackFactory[] | EffectFactory[] | null {
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
