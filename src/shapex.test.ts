import { describe, test, expect, vi, beforeEach } from "vitest";
import ShapeX from "./shapex.ts";

describe("EventX", () => {
  describe("subscribe", () => {
    test("subscribes to an event", () => {
      const $ = ShapeX({ counter: 1 });
      const id = $.subscribe("test-event", (state) => ({ state }));
      expect(id).toBe(1);
      expect($.subscriptionCount("test-event")).toBe(1);
    });

    test("subscribes to an event once", () => {
      const $ = ShapeX({ counter: 1 });
      const id = $.subscribeOnce("test-event", (state) => ({ state }));
      expect(id).toBe(1);
      expect($.subscriptionCount("test-event")).toBe(1);

      // Dispatch the event to trigger the one-time subscription
      $.dispatch("test-event");
      expect($.subscriptionCount("test-event")).toBe(0);
    });

    test("unsubscribes from an event", () => {
      const $ = ShapeX({ counter: 1 });
      $.subscribe("test-event", (state) => ({ state }));
      expect($.subscriptionCount("test-event")).toBe(1);

      $.unsubscribe("test-event");
      expect($.subscriptionCount("test-event")).toBe(0);
    });
  });

  describe("dispatch", () => {
    test("dispatches an event without arguments", () => {
      const $ = ShapeX({ counter: 1 });
      const callback = vi.fn((state) => ({ state }));

      $.subscribe("test-event", callback);
      $.dispatch("test-event");

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ counter: 1 });
    });

    test("dispatches an event with arguments", () => {
      const $ = ShapeX({ counter: 1 });
      const callback = vi.fn((state, arg1, arg2) => ({ state }));

      $.subscribe("test-event", callback);
      $.dispatch("test-event", "arg1-value", "arg2-value");

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith({ counter: 1 }, "arg1-value", "arg2-value");
    });

    test("updates state when event handler returns new state", () => {
      const $ = ShapeX({ counter: 1 });
      const stateChangeSpy = vi.fn((state) => ({ state }));

      $.subscribe("$counter", stateChangeSpy);
      $.subscribe("increment", (state) => ({
        state: { ...state, counter: state.counter + 1 },
      }));

      $.dispatch("increment");

      expect(stateChangeSpy).toHaveBeenCalledTimes(1);
      expect(stateChangeSpy).toHaveBeenCalledWith({ counter: 2 });
    });

    test("dispatches nested events", () => {
      const $ = ShapeX({ counter: 1 });
      const nestedEventSpy = vi.fn((state) => ({ state }));

      $.subscribe("nested-event", nestedEventSpy);
      $.subscribe("parent-event", (state) => ({
        state,
        dispatch: { eventName: "nested-event" },
      }));

      $.dispatch("parent-event");

      expect(nestedEventSpy).toHaveBeenCalledTimes(1);
    });

    test("dispatches multiple nested events", () => {
      const $ = ShapeX({ counter: 1 });
      const nestedEvent1Spy = vi.fn((state) => ({ state }));
      const nestedEvent2Spy = vi.fn((state) => ({ state }));

      $.subscribe("nested-event-1", nestedEvent1Spy);
      $.subscribe("nested-event-2", nestedEvent2Spy);
      $.subscribe("parent-event", (state) => ({
        state,
        dispatch: [{ eventName: "nested-event-1" }, { eventName: "nested-event-2" }],
      }));

      $.dispatch("parent-event");

      expect(nestedEvent1Spy).toHaveBeenCalledTimes(1);
      expect(nestedEvent2Spy).toHaveBeenCalledTimes(1);
    });

    test("dispatches nested events with arguments", () => {
      const $ = ShapeX({ counter: 1 });
      const nestedEventSpy = vi.fn((state, arg) => ({ state }));

      $.subscribe("nested-event", nestedEventSpy);
      $.subscribe("parent-event", (state) => ({
        state,
        dispatch: { eventName: "nested-event", args: ["arg-value"] },
      }));

      $.dispatch("parent-event");

      expect(nestedEventSpy).toHaveBeenCalledTimes(1);
      expect(nestedEventSpy).toHaveBeenCalledWith({ counter: 1 }, "arg-value");
    });
  });

  describe("state change detection", () => {
    test("detects value changes in state", () => {
      const $ = ShapeX({ counter: 1, nested: { value: "test" } });
      const counterChangeSpy = vi.fn((state) => ({ state }));

      $.subscribe("$counter", counterChangeSpy);
      $.subscribe("change-counter", (state) => ({
        state: { ...state, counter: 2 },
      }));

      $.dispatch("change-counter");

      expect(counterChangeSpy).toHaveBeenCalledTimes(1);
      expect(counterChangeSpy).toHaveBeenCalledWith({ counter: 2, nested: { value: "test" } });
    });

    test("detects nested value changes in state", () => {
      const $ = ShapeX({ counter: 1, nested: { value: "test" } });
      const nestedValueChangeSpy = vi.fn((state) => ({ state }));

      $.subscribe("$nested.value", nestedValueChangeSpy);
      $.subscribe("change-nested-value", (state) => ({
        state: {
          ...state,
          nested: { ...state.nested, value: "changed" },
        },
      }));

      $.dispatch("change-nested-value");

      expect(nestedValueChangeSpy).toHaveBeenCalledTimes(1);
      expect(nestedValueChangeSpy).toHaveBeenCalledWith({
        counter: 1,
        nested: { value: "changed" },
      });
    });

    test("detects deleted properties in state", () => {
      const $ = ShapeX({ counter: 1, toDelete: "value" } as { counter: number; toDelete?: string });
      const deleteChangeSpy = vi.fn((state) => ({ state }));

      $.subscribe("$toDelete", deleteChangeSpy);
      $.subscribe("delete-property", (state) => {
        const newState = { counter: state.counter };
        return { state: newState };
      });

      $.dispatch("delete-property");

      expect(deleteChangeSpy).toHaveBeenCalledTimes(1);
    });

    test("detects type changes in state", () => {
      const $ = ShapeX({ counter: 1 } as { counter: string | number });
      const counterChangeSpy = vi.fn((state) => ({ state }));

      $.subscribe("$counter", counterChangeSpy);
      $.subscribe("change-counter-type", (state) => ({
        state: { ...state, counter: "string now" },
      }));

      $.dispatch("change-counter-type");

      expect(counterChangeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("utility methods", () => {
    test("returns all subscription names", () => {
      const $ = ShapeX({ counter: 1 });
      $.subscribe("event1", (state) => ({ state }));
      $.subscribe("event2", (state) => ({ state }));

      const subs = $.subscriptions();
      expect(subs).toContain("event1");
      expect(subs).toContain("event2");
      expect(subs.length).toBe(2);
    });

    test("returns subscription count for specific event", () => {
      const $ = ShapeX({ counter: 1 });
      $.subscribe("event1", (state) => ({ state }));
      $.subscribe("event1", (state) => ({ state }));
      $.subscribe("event2", (state) => ({ state }));

      expect($.subscriptionCount("event1")).toBe(2);
      expect($.subscriptionCount("event2")).toBe(1);
    });
  });
});
