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

  consume(name: "observedAttributes"): string[][];
  consume(name: "attributeChangedCallback"): AttributeChangedCallback[];
}

export interface PluginRegistry {
  observedAttributes: string[][];
  attributeChangedCallback: AttributeChangedCallback[];
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
    name: keyof PluginRegistry,
    value: string[] | AttributeChangedCallback,
  ): void {
    if (name === "observedAttributes") {
      this.#registry.observedAttributes.push(value as string[]);
    } else {
      this.#registry.attributeChangedCallback.push(
        value as AttributeChangedCallback,
      );
    }
  }

  consume(name: "observedAttributes"): string[][];
  consume(
    name: "attributeChangedCallback",
  ): AttributeChangedCallback[];
  consume(
    name: keyof PluginRegistry,
  ): string[][] | AttributeChangedCallback[] {
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
