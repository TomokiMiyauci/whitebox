/** Defines how two values are compared for equality. */
export interface Equality<T> {
  /**
   * Determines whether two values are considered equal.
   *
   * @param left The first value to compare.
   * @param right The second value to compare.
   * @returns `true` when the values are equal.
   */
  equals(left: T, right: T): boolean;
}

/** Stores a value and provides a customizable equality check for updates. */
export class State<T> implements Equality<T> {
  /** The value currently stored by this state. */
  #current: T;

  /**
   * Creates a state with an initial value.
   *
   * @param current The initial value.
   */
  constructor(current: T) {
    this.#current = current;
  }

  /** Gets the current value. */
  get get(): T {
    return this.#current;
  }

  /**
   * Updates the value if it is not equal to the current value.
   *
   * @param value The value to store.
   * @returns `true` if the value changed; otherwise, `false`.
   */
  set(value: T): boolean {
    if (this.equals(this.#current, value)) {
      return false;
    }

    this.#current = value;

    return true;
  }

  /**
   * Compares values using `Object.is`.
   *
   * Override this method to customize the equality check.
   *
   * @param left The current value.
   * @param right The proposed value.
   * @returns `true` if the values are equal.
   */
  equals(left: T, right: T): boolean {
    return Object.is(left, right);
  }
}
