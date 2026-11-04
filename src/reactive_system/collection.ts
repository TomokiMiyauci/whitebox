/**
 * A bidirectional multimap that maintains many-to-many relationships
 * between two types of objects.
 *
 * Supports lookups from either side of the relationship.
 */
export class BiMultiMap<T extends WeakKey, U extends WeakKey> {
  /** Maps each key in {@link T} to its associated values in {@link U}. */
  #forward = new WeakMap<T, Set<U>>();

  /** Maps each key in {@link U} to its associated values in {@link T}. */
  #reverse = new WeakMap<U, Set<T>>();

  /**
   * Adds an association between {@link from} and {@link to}.
   *
   * @param from The key on the {@link T} side.
   * @param to The key on the {@link U} side.
   */
  add(from: T, to: U): void {
    let targets = this.#forward.get(from);
    if (!targets) {
      targets = new Set();
      this.#forward.set(from, targets);
    }

    let sources = this.#reverse.get(to);
    if (!sources) {
      sources = new Set();
      this.#reverse.set(to, sources);
    }

    targets.add(to);
    sources.add(from);
  }

  /**
   * Removes the association between {@link from} and {@link to}.
   *
   * @param from The key on the {@link T} side.
   * @param to The key on the {@link U} side.
   */
  delete(from: T, to: U): void {
    const targets = this.#forward.get(from);
    const sources = this.#reverse.get(to);

    targets?.delete(to);
    sources?.delete(from);
  }

  /**
   * Returns the values associated with the given key on the {@link T} side.
   *
   * @param from The key on the {@link T} side.
   * @returns The associated values, or an empty set if no associations exist.
   */
  get(from: T): ReadonlySet<U> {
    return this.#forward.get(from) ?? new Set();
  }

  /**
   * Returns the values associated with the given key on the {@link U} side.
   *
   * @param to The key on the {@link U} side.
   * @returns The associated values, or an empty set if no associations exist.
   */
  getReverse(to: U): ReadonlySet<T> {
    return this.#reverse.get(to) ?? new Set();
  }
}
