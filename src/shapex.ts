/**
 * Dispatches an event with a given name and passes on
 * given arguments to it.
 */
export type SubscriptionResponseDispatch<W extends unknown = undefined> = {
  to: string;
  with?: W;
};

/**
 * A response of the subscription callback. Should return new state
 * if you want to update state, and/or optionally also any events you
 * might want to dispatch.
 */
export type SubscriptionResponse<
  T,
  W extends unknown = undefined,
  D extends unknown = W
> = {
  state?: T;
  dispatch?:
    | SubscriptionResponseDispatch<D>
    | SubscriptionResponseDispatch<D>[];
};

const isSubscriptionResponseList = <W extends unknown = undefined>(
  dispatch: SubscriptionResponseDispatch<W> | SubscriptionResponseDispatch<W>[]
): dispatch is SubscriptionResponseDispatch<W>[] => Array.isArray(dispatch);

/**
 * A callback passed to subcriptions, called when the event
 * that the subscription is listening to is called.
 */
export type EventCallback<
  T,
  W extends unknown = undefined,
  D extends unknown = W
> = (state: T, data?: W) => SubscriptionResponse<T, W, D>;

type Subscription<T, W extends unknown = undefined, D extends unknown = W> = {
  listener: string;
  callback: EventCallback<T, W, D>;
  once: boolean;
};

/**
 * An instance of the ShapeX object.
 */
export type ShapeXInstance<T> = {
  /**
   * Subcribe to an event.
   */
  subscribe: <W extends unknown = undefined, D extends unknown = W>(
    listener: string,
    callback: EventCallback<T, W, D>
  ) => number;
  /**
   * Subscribe to an event once.
   */
  subscribeOnce: <W extends unknown = undefined, D extends unknown = W>(
    listener: string,
    callback: EventCallback<T, W, D>
  ) => number;

  /**
   * Unsubscribe from an event.
   */
  unsubscribe: (listener: string) => void;

  /**
   * Get the number of subscriptions for an event.
   */
  subscriptionCount: (to: string) => number;

  /**
   * Get the subscriptions for an event.
   */
  subscriptions: () => string[];

  /**
   * Dispatch an event.
   */
  dispatch: <W extends unknown>(to: string, withData?: W) => void;

  /**
   * Get the current state.
   */
  state: () => T;
};

/**
 * A function that creates an EventX object.
 *
 * @param {T extends object} initialState The initial application state.
 * @returns {ShapeXInstance<T>} The ShapeX object.
 */
export function ShapeX<T extends object>(initialState: T): ShapeXInstance<T> {
  let _state = initialState;
  const _subscriptions: Map<
    string,
    Array<Subscription<T, unknown, unknown>>
  > = new Map();
  let subscriptionId = 0;

  /**
   * Subcribe to an event.
   *
   * @param {string} listener
   * @param {EventCallback<T, W, D>} callback
   * @returns
   */
  const subscribe = <W extends unknown = undefined, D extends unknown = W>(
    listener: string,
    callback: EventCallback<T, W, D>
  ): number => {
    if (!_subscriptions.has(listener)) {
      _subscriptions.set(listener, []);
    }

    const subscriptions = _subscriptions.get(listener);
    if (subscriptions) {
      subscriptions.push({
        listener,
        callback: callback as unknown as EventCallback<T, unknown, unknown>,
        once: false,
      });
    }

    return ++subscriptionId;
  };

  /**
   * Subcribe to an event, once.
   *
   * @param {string} listener
   * @param {EventCallback<T, W, D>} callback
   * @returns
   */
  const subscribeOnce = <W extends unknown = undefined, D extends unknown = W>(
    listener: string,
    callback: EventCallback<T, W, D>
  ): number => {
    if (!_subscriptions.has(listener)) {
      _subscriptions.set(listener, []);
    }

    const subscriptions = _subscriptions.get(listener);
    if (subscriptions) {
      subscriptions.push({
        listener,
        callback: callback as unknown as EventCallback<T, unknown, unknown>,
        once: true,
      });
    }

    return ++subscriptionId;
  };

  const unsubscribe = (listener: string): void => {
    if (_subscriptions.has(listener)) {
      _subscriptions.delete(listener);
    }
  };

  /**
   * Composes a list of changes between two states.
   *
   * @param {T extends object} oldState
   * @param {T extends object} newState
   * @returns {string[]} The list of changes as array of paths.
   */
  const changedState = <T extends object>(
    oldState: T,
    newState: T
  ): string[] => {
    const paths = <R extends object>(
      state: R,
      path: string
    ): { path: string; value: unknown }[] => {
      const _paths = [] as { path: string; value: unknown }[];

      for (const key in state) {
        const currentPath = `${path}.${key}`;
        _paths.push({
          path: currentPath,
          value: state[key],
        });

        if (typeof state[key] === "object" && state[key] !== null) {
          _paths.push(...paths(state[key], currentPath));
        }
      }

      return _paths;
    };

    const differ = <S extends object>(oldState: S, newState: S): string[] => {
      const oldPaths = paths(oldState, "$");
      const oldPathKeys = oldPaths.map((x) => x.path);
      const newPaths = paths(newState, "$");
      const newPathKeys = newPaths.map((x) => x.path);

      // All new paths
      const added = newPathKeys.filter((path) => !oldPathKeys.includes(path));

      // All removed paths
      const removed = oldPathKeys.filter((path) => !newPathKeys.includes(path));

      // Paths that remained
      const same = oldPathKeys.filter((path) => newPathKeys.includes(path));

      // Paths that changed
      const changed = same.filter((path) => {
        const oldValue = oldPaths.find((x) => x.path === path)?.value;
        const newValue = newPaths.find((x) => x.path === path)?.value;

        return oldValue !== newValue;
      });

      return [...new Set([...added, ...removed, ...changed])];
    };

    return differ(oldState, newState);
  };

  /**
   * Dispatches an event with the given name and arguments.
   *
   * @param {string} to The name of the event to dispatch.
   * @param {unknown[]} withData The arguments to pass to the event listeners.
   * @returns {void}
   */
  const dispatch = <W extends unknown = undefined>(
    to: string,
    withData?: W
  ): void => {
    if (!_subscriptions.has(to)) {
      return;
    }

    const scopedSubsriptions = _subscriptions.get(to) ?? [];
    const remainingSubscriptions = [] as Array<
      Subscription<T, unknown, unknown>
    >;
    let callbackCount = 0;

    for (const subscription of scopedSubsriptions) {
      const callback = subscription.callback as unknown as EventCallback<
        T,
        W,
        unknown
      >;
      const response = withData ? callback(_state, withData) : callback(_state);

      // Updates state, and checks for state changes, and if any changes present,
      // fires a dispatch for all the state listeners (if there are any).
      if (typeof response.state !== "undefined") {
        const changes = changedState(_state, response.state);
        _state = response.state;

        for (let i = 0; i < changes.length; i++) {
          dispatch(changes[i]);
        }
      }

      // Dispatches events
      if (response.dispatch) {
        if (isSubscriptionResponseList(response.dispatch)) {
          for (const dispatchee of response.dispatch) {
            if (dispatchee.with) {
              dispatch(dispatchee.to, dispatchee.with);
            } else {
              dispatch(dispatchee.to);
            }
          }
        } else {
          if (response.dispatch.with) {
            dispatch(response.dispatch.to, response.dispatch.with);
          } else {
            dispatch(response.dispatch.to);
          }
        }
      }

      callbackCount++;

      if (!subscription.once) {
        remainingSubscriptions.push(subscription);
      }
    }

    _subscriptions.set(to, remainingSubscriptions);
  };

  /**
   * Returns the number of subscriptions for the given event name.
   *
   * @param {string} eventName The name of the event to check.
   * @returns {number} The number of subscriptions for the given event name.
   */
  const subscriptionCount = (eventName: string | null): number => {
    if (eventName) {
      return _subscriptions.get(eventName)?.length ?? 0;
    }

    return Array.from(_subscriptions.keys()).length;
  };

  /**
   * Returns the names of all subscriptions.
   *
   * @returns {string[]} An array of subscription names.
   */
  const subscriptions = (): string[] => {
    return Array.from(_subscriptions.keys());
  };

  /**
   * Returns the current state.
   *
   * @returns {T} The current state.
   */
  const state = (): T => {
    return _state;
  };

  return {
    subscribe,
    subscribeOnce,
    unsubscribe,
    subscriptionCount,
    subscriptions,
    dispatch,
    state,
  };
}
