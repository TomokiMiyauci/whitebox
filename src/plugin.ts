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

  consume(name: "observedAttributes"): string[][];
  consume(name: "attributeChangedCallback"): AttributeChangedCallbackFactory[];
}

export interface PluginRegistry {
  observedAttributes: string[][];
  attributeChangedCallback: AttributeChangedCallbackFactory[];
}

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
  provide(
    name: keyof PluginRegistry,
    value: string[] | AttributeChangedCallbackFactory | null,
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
    }
  }

  consume(name: "observedAttributes"): string[][];
  consume(name: "attributeChangedCallback"): AttributeChangedCallbackFactory[];
  consume(
    name: keyof PluginRegistry,
  ): string[][] | AttributeChangedCallbackFactory[] | null {
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
  });

  metadata[PLUGIN] = plugin;

  return plugin;
}
