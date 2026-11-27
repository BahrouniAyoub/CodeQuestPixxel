import { beforeEach, describe, expect, it } from "vitest";
import { GIGBOARD_ADDRESS, SEARCH_ADDRESS } from "./browserRoutes";
import { useBrowserNavigationIntent } from "./browserNavigationIntent";

beforeEach(() => {
  useBrowserNavigationIntent.setState({ request: null });
});

describe("browserNavigationIntent", () => {
  it("replaces requests with monotonically increasing IDs", () => {
    expect(useBrowserNavigationIntent.getState().request).toBeNull();

    useBrowserNavigationIntent.getState().requestNavigation(GIGBOARD_ADDRESS);
    expect(useBrowserNavigationIntent.getState().request).toEqual({
      id: 1,
      address: GIGBOARD_ADDRESS,
    });

    useBrowserNavigationIntent.getState().requestNavigation(SEARCH_ADDRESS);
    expect(useBrowserNavigationIntent.getState().request).toEqual({
      id: 2,
      address: SEARCH_ADDRESS,
    });
  });

  it("consumes a request exactly once", () => {
    useBrowserNavigationIntent.getState().requestNavigation(GIGBOARD_ADDRESS);
    const first = useBrowserNavigationIntent.getState().request;
    expect(first).not.toBeNull();

    useBrowserNavigationIntent.getState().consumeNavigation();
    expect(useBrowserNavigationIntent.getState().request).toBeNull();

    useBrowserNavigationIntent.getState().consumeNavigation();
    expect(useBrowserNavigationIntent.getState().request).toBeNull();
  });
});
