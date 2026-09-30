import { afterEach, describe, expect, it, vi } from "vitest";
import { driver, type Driver } from "../src/driver";
import { nextFrame, popoverEl, popoverTitle, useDriverHarness } from "./utils";

// #504: destroy() on a stale instance must not tear down the tour that is
// actually on the page.

useDriverHarness();

const extra: Driver[] = [];
function track(d: Driver): Driver {
  extra.push(d);
  return d;
}
afterEach(() => {
  while (extra.length) {
    extra.pop()?.destroy();
  }
});

function liveTour(): Driver {
  return track(
    driver({
      animate: false,
      steps: [{ element: "#intro", popover: { title: "Live tour" } }],
    })
  );
}

function expectTourIntact(tour: Driver) {
  expect(tour.isActive()).toBe(true);
  expect(popoverTitle()).toBe("Live tour");
  expect(popoverEl()).not.toBeNull();
  expect(document.body.classList.contains("driver-active")).toBe(true);
  expect(document.querySelector("#intro")?.classList.contains("driver-active-element")).toBe(true);
}

describe("destroy isolation (#504)", () => {
  it("ignores a second destroy after the instance already tore down", async () => {
    const onDestroyed = vi.fn();
    const demo = track(driver({ animate: false, onDestroyed }));
    demo.highlight({ element: "#card-1", popover: { title: "Highlight" } });
    await nextFrame();
    demo.destroy();

    const tour = liveTour();
    tour.drive();
    await nextFrame();

    demo.destroy();

    expect(demo.isActive()).toBe(false);
    expectTourIntact(tour);
    expect(onDestroyed).toHaveBeenCalledTimes(1);
  });

  it("does not let a still-active stale instance wipe the tour that replaced it", async () => {
    const demoDestroyed = vi.fn();
    const tourDestroyed = vi.fn();
    const demo = track(
      driver({
        animate: false,
        onDestroyed: demoDestroyed,
      })
    );
    demo.highlight({ element: "#card-1", popover: { title: "Highlight" } });
    await nextFrame();

    const tour = track(
      driver({
        animate: false,
        onDestroyed: tourDestroyed,
        steps: [{ element: "#intro", popover: { title: "Live tour" } }],
      })
    );
    tour.drive();
    await nextFrame();

    // The highlight object is still active. That is the timeout in #504:
    // isActive() is true, so the caller does call destroy().
    expect(demo.isActive()).toBe(true);
    const popovers = document.querySelectorAll(".driver-popover");
    const overlays = document.querySelectorAll(".driver-overlay");
    const livePopover = popovers[popovers.length - 1];
    const liveOverlay = overlays[overlays.length - 1];
    demo.destroy();

    expect(demo.isActive()).toBe(false);
    expect(demoDestroyed).toHaveBeenCalledTimes(1);
    expect(tourDestroyed).not.toHaveBeenCalled();
    const remainingPopovers = document.querySelectorAll(".driver-popover");
    const remainingOverlays = document.querySelectorAll(".driver-overlay");
    expect(remainingPopovers[remainingPopovers.length - 1]).toBe(livePopover);
    expect(remainingOverlays[remainingOverlays.length - 1]).toBe(liveOverlay);
    expect(document.querySelector("#card-1")?.classList.contains("driver-active-element")).toBe(false);
    expectTourIntact(tour);
  });

  it("leaves the live tour alone when destroy() runs on an instance that never started", () => {
    const idle = track(driver({ animate: false }));
    const tour = liveTour();
    tour.drive();

    idle.destroy();

    expect(idle.isActive()).toBe(false);
    expectTourIntact(tour);
  });

  it("can highlight again after destroy", () => {
    const demo = track(driver({ animate: false }));
    demo.highlight({ element: "#intro", popover: { title: "First" } });
    demo.destroy();
    demo.highlight({ element: "#card-1", popover: { title: "Second" } });

    expect(demo.isActive()).toBe(true);
    expect(popoverTitle()).toBe("Second");
    expect(document.querySelector("#card-1")?.classList.contains("driver-active-element")).toBe(true);
    expect(document.querySelector("#intro")?.classList.contains("driver-active-element")).toBe(false);
  });

  it("keeps the replacement tour after an animated highlight is destroyed", async () => {
    const demo = track(driver({ animate: true, duration: 50 }));
    demo.highlight({ element: "#card-1", popover: { title: "Highlight" } });
    await nextFrame();
    demo.destroy();

    const tour = liveTour();
    tour.drive();
    await nextFrame();
    demo.destroy();
    await nextFrame();

    expectTourIntact(tour);
  });
});
