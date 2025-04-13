# EventX

Create scaleable event-driven applications with EventX, inspired by [re-frame](https://github.com/day8/re-frame/). EventX uses zero dependencies and is runtime agnostic, meaning that you can use it in Node, Deno, Bun, browsers, or really anywhere where JavaScript runs.

## Example application

This is an example application that demonstrates how to use the EventX library. It has a single starting point event called `request`, which returns an updated state, which changes the `counter`. When that state changes, the subscriber for the `counter` state fires.

```typescript
import EventX from "eventx";

type AppState = {
  counter: number;
};

const $ = EventX<AppState>({
  counter: 1,
});

$.subscribe("$counter", (state) => {
  console.log("counter changed", state);

  return {
    state,
  };
});

$.subscribe("request", (state) => {
  return {
    state: {
      ...state,
      counter: state.counter + 1;
    }
  }
});

// Dispatch an event somewhere.
$.dispatch("request");
```

## Installation

```shell
npm i @askonmm/eventx
```

## Documentation

### State

At the core of your application is state. You start by initiating EventX with some initial state, like so:

```typescript
import eventx from "eventx";

type AppState = {
  counter: number;
};

const $ = eventx<AppState>({
  counter: 1,
});
```

You can model your `AppState` however you like. It does not have to be called `AppState`.

### Events

Events set things in motion. You can dispatch events like so:

```typescript
$.dispatch("some-event-name");
```

And, if there's a subscription for that event name, that subscription will then fire. The above example is a data-less event, but you can also dispatch events with data, like so:

```typescript
$.dispatch("some-event-name", arg1, arg2, arg3);
```

### Subscriptions

Subscriptions listen to events or changes to state. Each subscription must return a `Response` object.

#### Event subscriptions

You can listen to events like so:

```typescript
$.subscribe("some-event-name", (state, arg1, arg2, arg3) => {
  return {
    state,
  };
});
```

Each subscription has a callback function which gets passed to it the app state and whatever data was passed
when the event was dispatched. Subscription callbacks must return an `Response` which consists of updated state and/or further event dispatches. If you don't want to update state, just return the same state that the callback got in the first place.

#### State change subscriptions

You can also listen to state changes with subscriptions, which will fire when the listened state changes. You can listen to state changes like so:

```typescript
$.subscribe("$counter", (state) => {
  return {
    state,
  };
});
```

Notable difference here is the `$` prefix in the subscription listener name, which tells EventX what state to look for. Here `$counter` will look for the root-level `counter` key in state. To look for nested state, simply add a dot (`.`) followed by the key name, i.e: `$counter.nestedKey`. Additionally, state change subscriptions do not get any additional data passed to them, only state.

#### Subscribe only once

If you want to subscribe to an event or state change only once, you can use the `$.subscribeOnce` method. This method works similarly to `$.subscribe`, but it will automatically unsubscribe after the first event or state change.

```typescript
$.subscribeOnce("$counter", (state) => {
  return {
    state,
  };
});
```

#### Unsubscribe

If you want to unsubscribe from an event or state change, you can use the `$.unsubscribe` method. This method takes the event or state change name as its argument and removes the subscription.

```typescript
$.unsubscribe("counter++");
```

#### Change state

You can change state by returning a new state object, like so:

```typescript
$.subscribe("counter++", (state) => {
  return {
    state: {
      ...state,
      counter: state.counter + 1,
    },
  };
});
```

#### Dispatch events

You can also dispatch events from within subscriptions, like so:

```typescript
$.subscribe("counter++", (state) => {
  return {
    state: {
      ...state,
      counter: state.counter + 1,
    },
  };
});

$.subscribe("some-event-name", (state) => {
  return {
    state,
    dispatch: {
      event: "counter++",
    },
  };
});
```

Now if `some-event-name` is dispatched, it also dispatches `counter++`. You can also pass data along, like so:

```typescript
$.subscribe("counter-increase", (state, increase: number) => {
  return {
    state: {
      ...state,
      counter: state.counter + increase,
    },
  };
});

$.subscribe("some-event-name", (state) => {
  return {
    state,
    dispatch: {
      event: "counter-increase",
      args: [5],
    },
  };
});
```

So now if `some-event-name` is dispatched, it also dispatches `counter-increase` with an increase of 5.

#### Get the subscription count

If you want to get the number of subscriptions for a specific event or state change, you can use the `$.getSubscriptionCount` method. This method takes the event or state change name as its argument and returns the number of subscriptions.

```typescript
// State change subscriptions
$.getSubscriptionCount("$counter");

// Event subscriptions
$.getSubscriptionCount("some-event-name");
```

#### Get all subscriptions

If you want to get all subscriptions, you can use the `$.subscriptions` method. This method returns an array of all the subscription names.

```typescript
$.subscriptions();
```
