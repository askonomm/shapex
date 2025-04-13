export type EventDispatcher = (eventName: string, ...args: unknown[]) => void;

export type SubscriptionResponseDispatch = {
  eventName: string;
  args?: unknown[];
};

export type SubscriptionResponse<T> = {
  state?: T;
  dispatch?: SubscriptionResponseDispatch | SubscriptionResponseDispatch[];
};

const isSubscriptionResponseList = (
  dispatch: SubscriptionResponseDispatch | SubscriptionResponseDispatch[],
): dispatch is SubscriptionResponseDispatch[] => Array.isArray(dispatch);

export type EventCallback<T> = (state: T, ...args: any[]) => SubscriptionResponse<T>;

export type Subscription<T> = {
  listener: string;
  callback: EventCallback<T>;
  once: boolean;
};

export type StateChange = "deleted" | "changed-type" | "changed-value";

export type ShapeX<T> = {
  subscribe: (listener: string, callback: EventCallback<T>) => number;
  subscribeOnce: (listener: string, callback: EventCallback<T>) => number;
  unsubscribe: (listener: string) => void;
  subscriptionCount: (eventName: string) => number;
  subscriptions: () => string[];
  dispatch: (eventName: string, ...args: any[]) => void;
};

/**
 * A function that creates an EventX object.
 *
 * @param {T extends object} initialState The initial application state.
 * @returns {EventX<T>} The EventX object.
 */
const ShapeX = <T extends object>(initialState: T): ShapeX<T> => {
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
  const subscribeOnce = (listener: string, callback: EventCallback<T>): number => {
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
   * @param {string} path
   * @returns {StateChange[]} The list of changes.
   */
  const changedState = <T extends object>(
    oldState: T,
    newState: T,
    path: string = "",
  ): Map<string, StateChange> => {
    let changes: Map<string, StateChange> = new Map();

    for (const k in oldState) {
      const currentPath = path ? `${path}.${k}` : k;

      // Missing?
      if (!(k in newState)) {
        if (!changes.has(currentPath)) {
          changes.set(currentPath, "deleted");
        }
      }

      // Type changed?
      if (typeof oldState[k] !== typeof newState[k]) {
        if (!changes.has(currentPath)) {
          changes.set(currentPath, "changed-type");
        }
      }

      // Recursive object check
      if (
        typeof oldState[k] === "object" &&
        typeof newState[k] === "object" &&
        oldState[k] !== null &&
        newState[k] !== null
      ) {
        changedState(oldState[k], newState[k], currentPath).forEach((v, k) => {
          changes.set(k, v);
        });
      }

      // Value changed?
      if (JSON.stringify(oldState[k]) !== JSON.stringify(newState[k])) {
        if (!changes.has(currentPath)) {
          changes.set(currentPath, "changed-value");
        }
      }
    }

    return changes;
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
    const remainingSubscriptions = [];
    let callbackCount = 0;

    for (const subscription of scopedSubsriptions) {
      const response = subscription.callback(_state, ...args);

      // Updates state, and checks for state changes, and if any changes present,
      // fires a dispatch for all the state listeners (if there are any).
      if (typeof response.state !== "undefined") {
        const changes = changedState(_state, response.state);
        _state = response.state;

        changes.forEach((_, v) => {
          dispatch(`\$${v}`);
        });
      }

      // Dispatches events
      if (response.dispatch) {
        if (isSubscriptionResponseList(response.dispatch)) {
          for (const dispatchee of response.dispatch) {
            dispatch(dispatchee.eventName, ...(dispatchee.args ?? []));
          }
        } else {
          dispatch(response.dispatch.eventName, ...(response.dispatch.args ?? []));
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
};

export default ShapeX;
