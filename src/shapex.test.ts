import { assertArrayIncludes, assertEquals } from "@std/assert";
import { assertSpyCall, spy } from "@std/testing/mock";
import { describe, it } from "@std/testing/bdd";
import ShapeX, { EventCallback } from "./shapex.ts";

describe("subscribe", () => {
  it("subscribes to an event", () => {
    const $ = ShapeX({ counter: 1 });
    const id = $.subscribe("test-event", (state) => ({ state }));

    assertEquals(id, 1);
    assertEquals($.subscriptionCount("test-event"), 1);
  });

  it("subscribes to an event once", () => {
    const $ = ShapeX({ counter: 1 });
    const id = $.subscribeOnce("test-event", (state) => ({ state }));

    assertEquals(id, 1);
    assertEquals($.subscriptionCount("test-event"), 1);
  });

  it("unsubscribes from an event", () => {
    const $ = ShapeX({ counter: 1 });

    $.subscribe("test-event", (state) => ({ state }));
    assertEquals($.subscriptionCount("test-event"), 1);

    $.unsubscribe("test-event");
    assertEquals($.subscriptionCount("test-event"), 0);
  });
});

describe("dispatch", () => {
  it("dispatches an event without arguments", () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX<AppState>({ counter: 1 });
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = spy(cb);

    $.subscribe("test-event", spyCb);
    $.dispatch("test-event");

    assertSpyCall(spyCb, 0, {
      args: [{ counter: 1 }],
    });
  });

  it("dispatches an event with arguments", () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX<AppState>({ counter: 1 });

    // deno-lint-ignore no-unused-vars
    const testEventCb: EventCallback<AppState> = (state, arg1, arg2) => ({
      state,
    });

    const callback = spy(testEventCb);

    $.subscribe("test-event", callback);
    $.dispatch("test-event", "arg1-value", "arg2-value");

    assertSpyCall(callback, 0, {
      args: [
        { counter: 1 },
        "arg1-value",
        "arg2-value",
      ],
    });
  });

  it("updates state when event handler returns new state", () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX<AppState>({ counter: 1 });
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = spy(cb);

    $.subscribe("$.counter", spyCb);

    $.subscribe("increment", (state) => ({
      state: { ...state, counter: state.counter + 1 },
    }));

    $.dispatch("increment");

    assertSpyCall(spyCb, 0, {
      args: [
        { counter: 2 },
      ],
    });
  });

  it("dispatches nested events", () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX({ counter: 1 });
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = spy(cb);

    $.subscribe("nested-event", spyCb);

    $.subscribe("parent-event", (state) => ({
      state,
      dispatch: { eventName: "nested-event" },
    }));

    $.dispatch("parent-event");

    assertSpyCall(spyCb, 0);
  });

  it("dispatches multiple nested events", () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX({ counter: 1 });
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = spy(cb);
    const spyCb2 = spy(cb);

    $.subscribe("nested-event-1", spyCb);

    $.subscribe("nested-event-2", spyCb2);

    $.subscribe("parent-event", (state) => ({
      state,
      dispatch: [{ eventName: "nested-event-1" }, {
        eventName: "nested-event-2",
      }],
    }));

    $.dispatch("parent-event");

    assertSpyCall(spyCb, 0);
    assertSpyCall(spyCb2, 0);
  });

  it("dispatches nested events with arguments", () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX<AppState>({ counter: 1 });
    // deno-lint-ignore no-unused-vars
    const cb: EventCallback<AppState> = (state, arg) => ({ state });
    const spyCb = spy(cb);

    $.subscribe("nested-event", spyCb);

    $.subscribe("parent-event", (state) => ({
      state,
      dispatch: { eventName: "nested-event", args: ["arg-value"] },
    }));

    $.dispatch("parent-event");

    assertSpyCall(spyCb, 0, {
      args: [{ counter: 1 }, "arg-value"],
    });
  });
});

describe("state change detection", () => {
  it("detects value changes in state", () => {
    type AppState = {
      counter: number;
      nested: {
        value: string;
      };
    };

    const $ = ShapeX<AppState>({ counter: 1, nested: { value: "test" } });
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = spy(cb);

    $.subscribe("$.counter", spyCb);

    $.subscribe("change-counter", (state) => ({
      state: { ...state, counter: 2 },
    }));

    $.dispatch("change-counter");

    assertSpyCall(spyCb, 0, {
      args: [{ counter: 2, nested: { value: "test" } }],
    });
  });

  it("detects nested value changes in state", () => {
    type AppState = {
      counter: number;
      nested: {
        value: string;
      };
    };

    const $ = ShapeX<AppState>({ counter: 1, nested: { value: "test" } });
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = spy(cb);

    $.subscribe("$.nested.value", spyCb);

    $.subscribe("change-nested-value", (state) => ({
      state: {
        ...state,
        nested: { ...state.nested, value: "new value" },
      },
    }));

    $.subscribe("change-nested-value-again", (state) => ({
      state: {
        ...state,
        nested: { ...state.nested, value: "new value again" },
      },
    }));

    $.dispatch("change-nested-value");
    $.dispatch("change-nsted-value-again");

    assertSpyCall(spyCb, 0, {
      args: [{ counter: 1, nested: { value: "new value" } }],
    });
  });

  it("detects addition in state", () => {
    type AppState = {
      view?: string;
    };

    const $ = ShapeX<AppState>({});
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = spy(cb);

    $.subscribe("$.view", spyCb);

    $.subscribe("set-view", (state) => {
      return {
        state: {
          ...state,
          view: "test",
        },
      };
    });

    $.dispatch("set-view");

    assertSpyCall(spyCb, 0);
  });

  it("detects nested addition in state", () => {
    type AppState = {
      nested?: {
        value?: string;
      };
    };

    const $ = ShapeX<AppState>({});
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = spy(cb);
    const spyCb2 = spy(cb);

    $.subscribe("$.nested", spyCb);
    $.subscribe("$.nested.value", spyCb2);

    $.subscribe("set-nested-value", (state) => {
      return {
        state: {
          ...state,
          nested: { value: "test" },
        },
      };
    });

    $.subscribe("set-nested-value-again", (state) => {
      return {
        state: {
          ...state,
          nested: { value: "test-again" },
        },
      };
    });

    $.dispatch("set-nested-value");
    $.dispatch("set-nested-value-again");

    assertSpyCall(spyCb, 1);
    assertSpyCall(spyCb2, 1);
  });

  it("detects deleted properties in state", () => {
    type AppState = {
      counter: number;
      toDelete?: string;
    };

    const $ = ShapeX<AppState>({ counter: 1, toDelete: "value" });
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = spy(cb);

    $.subscribe("$.toDelete", spyCb);
    $.subscribe("delete-property", (state) => {
      const newState = { counter: state.counter };
      return { state: newState };
    });

    $.dispatch("delete-property");

    assertSpyCall(spyCb, 0);
  });

  it("detects type changes in state", () => {
    type AppState = {
      counter: string | number;
    };

    const $ = ShapeX<AppState>({ counter: 1 });
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = spy(cb);

    $.subscribe("$.counter", spyCb);
    $.subscribe("change-counter-type", (state) => ({
      state: { ...state, counter: "string now" },
    }));

    $.dispatch("change-counter-type");

    assertSpyCall(spyCb, 0);
  });
});

describe("utility methods", () => {
  it("returns all subscription names", () => {
    const $ = ShapeX({ counter: 1 });

    $.subscribe("event1", (state) => ({ state }));
    $.subscribe("event2", (state) => ({ state }));

    const subs = $.subscriptions();

    assertArrayIncludes(subs, ["event1"]);
    assertArrayIncludes(subs, ["event2"]);
    assertEquals(subs.length, 2);
  });

  it("returns subscription count for specific event", () => {
    const $ = ShapeX({ counter: 1 });

    $.subscribe("event1", (state) => ({ state }));
    $.subscribe("event1", (state) => ({ state }));
    $.subscribe("event2", (state) => ({ state }));

    assertEquals($.subscriptionCount("event1"), 2);
    assertEquals($.subscriptionCount("event2"), 1);
  });
});
