import { describe, it, expect, vi } from "vitest";
import { ShapeX, type EventCallback } from "./shapex.ts";

describe("subscribe", () => {
  it("subscribes to an event", () => {
    const $ = ShapeX({ counter: 1 });
    const id = $.subscribe("test-event", (state) => ({ state }));

    expect(id).toBe(1);
    expect($.subscriptionCount("test-event")).toBe(1);
  });

  it("subscribes to an event once", () => {
    const $ = ShapeX({ counter: 1 });
    const id = $.subscribeOnce("test-event", (state) => ({ state }));

    expect(id).toBe(1);
    expect($.subscriptionCount("test-event")).toBe(1);
  });

  it("unsubscribes from an event", () => {
    const $ = ShapeX({ counter: 1 });

    $.subscribe("test-event", (state) => ({ state }));
    expect($.subscriptionCount("test-event")).toBe(1);

    $.unsubscribe("test-event");
    expect($.subscriptionCount("test-event")).toBe(0);
  });
});

describe("subscribe: async", () => {
  it("subscribes to an event", () => {
    const $ = ShapeX({ counter: 1 });
    const id = $.subscribe("test-event", async (state) =>
      Promise.resolve({ state }),
    );

    expect(id).toBe(1);
    expect($.subscriptionCount("test-event")).toBe(1);
  });

  it("subscribes to an event once", () => {
    const $ = ShapeX({ counter: 1 });
    const id = $.subscribeOnce("test-event", async (state) =>
      Promise.resolve({ state }),
    );

    expect(id).toBe(1);
    expect($.subscriptionCount("test-event")).toBe(1);
  });

  it("unsubscribes from an event", () => {
    const $ = ShapeX({ counter: 1 });

    $.subscribe("test-event", async (state) => Promise.resolve({ state }));
    expect($.subscriptionCount("test-event")).toBe(1);

    $.unsubscribe("test-event");
    expect($.subscriptionCount("test-event")).toBe(0);
  });
});

describe("dispatch", () => {
  it("dispatches an event without arguments", () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX<AppState>({ counter: 1 });
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = vi.fn(cb);

    $.subscribe("test-event", spyCb);
    $.dispatch("test-event");

    expect(spyCb).toHaveBeenCalledWith({ counter: 1 });
  });

  it("dispatches an event with arguments", () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX<AppState>({ counter: 1 });

    const testEventCb: EventCallback<AppState, string> = (state, data) => ({
      state,
    });

    const callback = vi.fn(testEventCb);

    $.subscribe("test-event", callback);
    $.dispatch("test-event", "arg1-value");

    expect(callback).toHaveBeenCalledWith({ counter: 1 }, "arg1-value");
  });

  it("updates state when event handler returns new state", () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX<AppState>({ counter: 1 });
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = vi.fn(cb);

    $.subscribe("$.counter", spyCb);

    $.subscribe("increment", (state) => ({
      state: { ...state, counter: state.counter + 1 },
    }));

    $.dispatch("increment");

    expect(spyCb).toHaveBeenCalledWith({ counter: 2 });
  });

  it("dispatches nested events", () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX({ counter: 1 });
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = vi.fn(cb);

    $.subscribe("nested-event", spyCb);

    $.subscribe("parent-event", (state) => ({
      state,
      dispatch: { to: "nested-event" },
    }));

    $.dispatch("parent-event");

    expect(spyCb).toHaveBeenCalled();
  });

  it("dispatches multiple nested events", () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX({ counter: 1 });
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = vi.fn(cb);
    const spyCb2 = vi.fn(cb);

    $.subscribe("nested-event-1", spyCb);

    $.subscribe("nested-event-2", spyCb2);

    $.subscribe("parent-event", (state) => ({
      state,
      dispatch: [
        { to: "nested-event-1" },
        {
          to: "nested-event-2",
        },
      ],
    }));

    $.dispatch("parent-event");

    expect(spyCb).toHaveBeenCalled();
    expect(spyCb2).toHaveBeenCalled();
  });

  it("dispatches nested events with arguments", () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX<AppState>({ counter: 1 });
    const cb: EventCallback<AppState, string> = (state, arg) => ({ state });
    const spyCb = vi.fn(cb);

    $.subscribe("nested-event", spyCb);

    $.subscribe("parent-event", (state) => ({
      state,
      dispatch: { to: "nested-event", with: "arg-value" },
    }));

    $.dispatch("parent-event");

    expect(spyCb).toHaveBeenCalledWith({ counter: 1 }, "arg-value");
  });

  it("supports different data types for event callback and dispatch", () => {
    type AppState = {
      counter: number;
    };

    type ParentEventData = {
      id: number;
    };

    type ChildEventData = {
      message: string;
    };

    const $ = ShapeX<AppState>({ counter: 1 });

    // This callback receives ChildEventData
    const childEventCb: EventCallback<AppState, ChildEventData> = (
      state,
      data,
    ) => ({
      state: data ? { ...state, counter: data.message.length } : state,
    });

    const spyChildCb = vi.fn(childEventCb);

    $.subscribe("child-event", spyChildCb);

    // This callback receives ParentEventData but dispatches ChildEventData
    const parentEventCb: EventCallback<
      AppState,
      ParentEventData,
      ChildEventData
    > = (state, data) => ({
      state,
      dispatch: {
        to: "child-event",
        with: { message: `ID ${data?.id ?? 0} processed` },
      },
    });

    $.subscribe("parent-event", parentEventCb);

    // Dispatch with parent event data
    $.dispatch("parent-event", { id: 123 });

    // Child event should be called with the child event data
    expect(spyChildCb).toHaveBeenCalledWith(
      { counter: 1 },
      { message: "ID 123 processed" },
    );

    // State should be updated based on the message length
    expect($.state().counter).toBe(16);
  });
});

describe("dispatch: async", () => {
  it("dispatches an event without arguments", () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX<AppState>({ counter: 1 });
    const cb: EventCallback<AppState> = async (state) =>
      Promise.resolve({ state });
    const spyCb = vi.fn(cb);

    $.subscribe("test-event", spyCb);
    $.dispatch("test-event");

    expect(spyCb).toHaveBeenCalledWith({ counter: 1 });
  });

  it("dispatches an event with arguments", () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX<AppState>({ counter: 1 });

    const testEventCb: EventCallback<AppState, string> = async (state, _) =>
      Promise.resolve({
        state,
      });

    const callback = vi.fn(testEventCb);

    $.subscribe("test-event", callback);
    $.dispatch("test-event", "arg1-value");

    expect(callback).toHaveBeenCalledWith({ counter: 1 }, "arg1-value");
  });

  it("updates state when event handler returns new state", async () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX<AppState>({ counter: 1 });

    const state = await vi.waitFor(
      () => {
        return new Promise((resolve) => {
          $.subscribe("$.counter", (state) => {
            resolve(state);
            return { state };
          });

          $.subscribe("increment", async (state) =>
            Promise.resolve({
              state: { ...state, counter: state.counter + 1 },
            }),
          );

          $.dispatch("increment");
        });
      },
      {
        timeout: 1000,
        interval: 100,
      },
    );

    expect(state).toStrictEqual({ counter: 2 });
  });

  it("dispatches nested events", async () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX({ counter: 1 });

    const state = await vi.waitFor(() => {
      return new Promise((resolve) => {
        $.subscribe("nested-event", (state) => {
          resolve(true);
          return { state };
        });

        $.subscribe("parent-event", (state) => ({
          state,
          dispatch: { to: "nested-event" },
        }));

        $.dispatch("parent-event");
      });
    });

    expect(state).toBe(true);
  });

  it("dispatches multiple nested events", async () => {
    type AppState = {
      counter: number;
    };

    const $ = ShapeX({ counter: 1 });

    const state = await vi.waitFor(() => {
      return new Promise((resolve) => {
        let count = 0;

        $.subscribe("nested-event-1", (state) => {
          count++;
          return { state };
        });

        $.subscribe("nested-event-2", (state) => {
          resolve(count + 1);
          return { state };
        });

        $.subscribe("parent-event", async (state) =>
          Promise.resolve({
            state,
            dispatch: [
              { to: "nested-event-1" },
              {
                to: "nested-event-2",
              },
            ],
          }),
        );

        $.dispatch("parent-event");
      });
    });

    expect(state).toBe(2);
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
    const spyCb = vi.fn(cb);

    $.subscribe("$.counter", spyCb);

    $.subscribe("change-counter", (state) => ({
      state: { ...state, counter: 2 },
    }));

    $.dispatch("change-counter");

    expect(spyCb).toHaveBeenCalledWith({
      counter: 2,
      nested: { value: "test" },
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
    const spyCb = vi.fn(cb);

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
    $.dispatch("change-nested-value-again");

    expect(spyCb).toHaveBeenCalledWith({
      counter: 1,
      nested: { value: "new value" },
    });
  });

  it("detects addition in state", () => {
    type AppState = {
      view?: string;
    };

    const $ = ShapeX<AppState>({});
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = vi.fn(cb);

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

    expect(spyCb).toHaveBeenCalled();
  });

  it("detects nested addition in state", () => {
    type AppState = {
      nested?: {
        value?: string;
      };
    };

    const $ = ShapeX<AppState>({});
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = vi.fn(cb);
    const spyCb2 = vi.fn(cb);

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

    expect(spyCb).toHaveBeenCalledTimes(2);
    expect(spyCb2).toHaveBeenCalledTimes(2);
  });

  it("detects deleted properties in state", () => {
    type AppState = {
      counter: number;
      toDelete?: string;
    };

    const $ = ShapeX<AppState>({ counter: 1, toDelete: "value" });
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = vi.fn(cb);

    $.subscribe("$.toDelete", spyCb);
    $.subscribe("delete-property", (state) => {
      const newState = { counter: state.counter };
      return { state: newState };
    });

    $.dispatch("delete-property");

    expect(spyCb).toHaveBeenCalled();
  });

  it("detects type changes in state", () => {
    type AppState = {
      counter: string | number;
    };

    const $ = ShapeX<AppState>({ counter: 1 });
    const cb: EventCallback<AppState> = (state) => ({ state });
    const spyCb = vi.fn(cb);

    $.subscribe("$.counter", spyCb);
    $.subscribe("change-counter-type", (state) => ({
      state: { ...state, counter: "string now" },
    }));

    $.dispatch("change-counter-type");

    expect(spyCb).toHaveBeenCalled();
  });
});

describe("utility methods", () => {
  it("returns all subscription names", () => {
    const $ = ShapeX({ counter: 1 });

    $.subscribe("event1", (state) => ({ state }));
    $.subscribe("event2", (state) => ({ state }));

    const subs = $.subscriptions();

    expect(subs).toContain("event1");
    expect(subs).toContain("event2");
    expect(subs).toHaveLength(2);
  });

  it("returns subscription count for specific event", () => {
    const $ = ShapeX({ counter: 1 });

    $.subscribe("event1", (state) => ({ state }));
    $.subscribe("event1", (state) => ({ state }));
    $.subscribe("event2", (state) => ({ state }));

    expect($.subscriptionCount("event1")).toBe(2);
    expect($.subscriptionCount("event2")).toBe(1);
  });

  it("returns updated state", () => {
    const $ = ShapeX({ counter: 1 });

    $.subscribe("event1", (state) => ({
      state: { counter: state.counter + 1 },
    }));

    $.dispatch("event1");

    expect($.state()).toEqual({
      counter: 2,
    });
  });
});
