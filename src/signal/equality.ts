/**
 * An interface representing a comparison strategy to determine if two values are equal.
 *
 * @template T The type of the values to be compared.
 */
export interface Equality<T> {
  equal(a: T, b: T): boolean;
}

export interface Signal<T> {
  // Get the value of the signal
  get(): T;
}
