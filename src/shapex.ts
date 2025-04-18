/**
 * Dispatches an event with a given name and passes on
 * given arguments to it.
 */
export type SubscriptionResponseDispatch = {
  eventName: string;
  args?: unknown[];
};

/**
 * A response of the subscription callback. Should return new state
 * if you want to update state, and/or optionally also any events you
 * might want to dispatch.
 */
export type SubscriptionResponse<T> = {
  state?: T;
  dispatch?: SubscriptionResponseDispatch | SubscriptionResponseDispatch[];
};

const isSubscriptionResponseList = (
  dispatch: SubscriptionResponseDispatch | SubscriptionResponseDispatch[],
): dispatch is SubscriptionResponseDispatch[] => Array.isArray(dispatch);

/**
 * A callback passed to subcriptions, called when the event
 * that the subscription is listening to is called.
 */
export type EventCallback<T> = (
  state: T,
  ...args: unknown[]
) => SubscriptionResponse<T>;

type Subscription<T> = {
  listener: string;
  callback: EventCallback<T>;
  once: boolean;
};

/**
 * An instance of the ShapeX object.
 */
export type ShapeXInstance<T> = {
  /**
   * Subcribe to an event.
   */
  subscribe: (listener: string, callback: EventCallback<T>) => number;
  /**
   * Subscribe to an event once.
   */
  subscribeOnce: (listener: string, callback: EventCallback<T>) => number;

  /**
   * Unsubscribe from an event.
   */
  unsubscribe: (listener: string) => void;

  /**
   * Get the number of subscriptions for an event.
   */
  subscriptionCount: (eventName: string) => number;

  /**
   * Get the subscriptions for an event.
   */
  subscriptions: () => string[];

  /**
   * Dispatch an event.
   */
  dispatch: (eventName: string, ...args: unknown[]) => void;
};

/**
 * A function that creates an EventX object.
 *
 * @param {T extends object} initialState The initial application state.
 * @returns {ShapeXInstance<T>} The ShapeX object.
 */
export default function ShapeX<T extends object>(
  initialState: T,
): ShapeXInstance<T> {
  let _state = initialState;
  const _subscriptions: Map<string, Subscription<T>[]> = new Map();
  let subscriptionId = 0;

  /**
   * Subcribe to an event.
   *
   * @param {string} listener
   * @param {EventCallback<T>} callback
   * @returns
   */
  const subscribe = (listener: string, callback: EventCallback<T>): number => {
    if (!_subscriptions.has(listener)) {
      _subscriptions.set(listener, []);
    }

    _subscriptions.get(listener)?.push({
      listener,
      callback,
      once: false,
    });

    return ++subscriptionId;
  };

  /**
   * Subcribe to an event, once.
   *
   * @param {string} listener
   * @param {EventCallback<T>} callback
   * @returns
   */
  const subscribeOnce = (
    listener: string,
    callback: EventCallback<T>,
  ): number => {
    if (!_subscriptions.has(listener)) {
      _subscriptions.set(listener, []);
    }

    _subscriptions.get(listener)?.push({
      listener,
      callback,
      once: true,
    });

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
    newState: T,
  ): string[] => {
    const paths = <R extends object>(
      state: R,
      path: string,
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
   * @param {string} eventName The name of the event to dispatch.
   * @param {unknown[]} args The arguments to pass to the event listeners.
   * @returns {void}
   */
  const dispatch = (eventName: string, ...args: unknown[]): void => {
    if (!_subscriptions.has(eventName)) {
      return;
    }

    const scopedSubsriptions = _subscriptions.get(eventName) ?? [];
    const remainingSubscriptions = [] as Subscription<T>[];
    let callbackCount = 0;

    for (const subscription of scopedSubsriptions) {
      const response = subscription.callback(_state, ...args);

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
            dispatch(dispatchee.eventName, ...(dispatchee.args ?? []));
          }
        } else {
          dispatch(
            response.dispatch.eventName,
            ...(response.dispatch.args ?? []),
          );
        }
      }

      callbackCount++;

      if (!subscription.once) {
        remainingSubscriptions.push(subscription);
      }
    }

    _subscriptions.set(eventName, remainingSubscriptions);
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

  return {
    subscribe,
    subscribeOnce,
    unsubscribe,
    subscriptionCount,
    subscriptions,
    dispatch,
  };
}
