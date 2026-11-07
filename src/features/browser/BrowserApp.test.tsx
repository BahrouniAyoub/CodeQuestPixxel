import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { APPS, APP_ORDER, PINNED_APPS } from "@/core/applications/registry";
import { useWindows } from "@/core/windows/windowStore";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { BrowserApp } from "./BrowserApp";
import { searchQuestSearch } from "./data/searchIndex";

function addressBar(): HTMLInputElement {
  return screen.getByLabelText("Address bar") as HTMLInputElement;
}

function navigateTo(value: string): void {
  const input = addressBar();
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

function tabs() {
  return screen.getAllByRole("tab");
}

function selectedTab() {
  return screen.getByRole("tab", { selected: true });
}

function clearFilters(): void {
  const buttons = screen.getAllByRole("button", { name: "Clear filters" });
  fireEvent.click(buttons[0]!);
}

afterEach(cleanup);

describe("BrowserApp", () => {
  it("renders the browser home page with its internal-site note", () => {
    render(<BrowserApp />);

    expect(screen.getByRole("heading", { name: /CodeQuest Browser/ })).toBeInTheDocument();
    expect(addressBar()).toHaveValue("home.codequest");
    expect(screen.getByRole("button", { name: /Visit GigBoard/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open QuestSearch/ })).toBeInTheDocument();
    expect(screen.getByText(/Only CodeQuest internal sites/)).toBeInTheDocument();
  });

  it("opens, switches, and closes browser tabs", () => {
    render(<BrowserApp />);
    expect(tabs()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "New tab" }));
    navigateTo("gigboard.codequest");

    expect(tabs()).toHaveLength(2);
    expect(selectedTab()).toHaveTextContent("GigBoard");

    fireEvent.click(tabs()[0]!);
    expect(selectedTab()).toHaveTextContent("CodeQuest Browser");
    expect(addressBar()).toHaveValue("home.codequest");

    fireEvent.click(screen.getByLabelText("Close GigBoard tab"));
    expect(tabs()).toHaveLength(1);
    expect(addressBar()).toHaveValue("home.codequest");
  });

  it("closing the last tab opens a fresh homepage tab", () => {
    render(<BrowserApp />);
    navigateTo("gigboard.codequest");

    fireEvent.click(screen.getByLabelText("Close GigBoard tab"));

    expect(tabs()).toHaveLength(1);
    expect(addressBar()).toHaveValue("home.codequest");
    expect(screen.getByRole("heading", { name: /CodeQuest Browser/ })).toBeInTheDocument();
  });

  it("keeps independent history per tab", () => {
    render(<BrowserApp />);
    navigateTo("gigboard.codequest");
    fireEvent.click(screen.getByRole("button", { name: "New tab" }));
    navigateTo("search.codequest");

    fireEvent.click(tabs()[0]!);
    expect(addressBar()).toHaveValue("gigboard.codequest");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(addressBar()).toHaveValue("home.codequest");

    fireEvent.click(tabs()[1]!);
    expect(addressBar()).toHaveValue("search.codequest");
  });

  it("navigates from the address bar and normalizes the address", () => {
    render(<BrowserApp />);
    navigateTo("  HTTPS://GigBoard.CodeQuest/  ");

    expect(
      screen.getByRole("heading", { name: /Find work that fits your skills/ }),
    ).toBeInTheDocument();
    expect(addressBar()).toHaveValue("gigboard.codequest");
  });

  it("turns non-address omnibox text into a QuestSearch query", () => {
    render(<BrowserApp />);
    navigateTo("python freelance jobs");

    expect(screen.getByRole("heading", { name: "Search results" })).toBeInTheDocument();
    expect(screen.getByText(/results for/i)).toBeInTheDocument();
    expect(addressBar()).toHaveValue("search.codequest?q=python+freelance+jobs");
    expect(
      screen.getByRole("button", { name: /GigBoard — Find Freelance Programming Jobs/ }),
    ).toBeInTheDocument();
  });

  it("renders the QuestSearch home page and submits a suggestion", () => {
    render(<BrowserApp />);
    navigateTo("search.codequest");

    expect(screen.getByRole("textbox", { name: "Search QuestSearch" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beginner Python jobs" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Beginner Python jobs" }));
    expect(addressBar()).toHaveValue("search.codequest?q=Beginner+Python+jobs");
    expect(screen.getByRole("heading", { name: "Search results" })).toBeInTheDocument();
  });

  it("navigates from search results and preserves them in history", () => {
    render(<BrowserApp />);
    navigateTo("freelance Python jobs");

    fireEvent.click(
      screen.getByRole("button", { name: /GigBoard — Find Freelance Programming Jobs/ }),
    );
    expect(addressBar()).toHaveValue("gigboard.codequest/jobs");
    expect(screen.getByRole("heading", { name: /Browse freelance jobs/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(addressBar()).toHaveValue("search.codequest?q=freelance+Python+jobs");
    expect(screen.getByRole("heading", { name: "Search results" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    expect(addressBar()).toHaveValue("gigboard.codequest/jobs");
  });

  it("renders GigBoard job listings with the café project", () => {
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs");

    expect(screen.getByRole("heading", { name: /Browse freelance jobs/ })).toBeInTheDocument();
    expect(screen.getByText("7 jobs found")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Build a Café Order Calculator" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rename Files with Python" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View details for Build a Café Order Calculator" }),
    ).toBeInTheDocument();
  });

  it("searches jobs and filters by category and difficulty", () => {
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs");

    const search = screen.getByLabelText("Search jobs");
    fireEvent.change(search, { target: { value: "calculator" } });
    expect(screen.getByText("1 job found")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Build a Café Order Calculator" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Rename Files with Python" }),
    ).not.toBeInTheDocument();

    clearFilters();
    fireEvent.change(screen.getByLabelText("Filter by category"), {
      target: { value: "Web Development" },
    });
    expect(screen.getByText("2 jobs found")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Build a Personal Portfolio" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter by difficulty"), {
      target: { value: "Beginner" },
    });
    expect(screen.getByText("1 job found")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Website Contact Form" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Build a Personal Portfolio" }),
    ).not.toBeInTheDocument();

    clearFilters();
    expect(screen.getByText("7 jobs found")).toBeInTheDocument();
  });

  it("shows an empty state when no jobs match", () => {
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs");

    fireEvent.change(screen.getByLabelText("Search jobs"), {
      target: { value: "underwater basket weaving" },
    });

    expect(
      screen.getByRole("heading", { name: "No jobs match those filters" }),
    ).toBeInTheDocument();
    clearFilters();
    expect(screen.getByText("7 jobs found")).toBeInTheDocument();
  });

  it("opens job details directly and through a job card", () => {
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs/cafe-calculator");

    expect(
      screen.getByRole("heading", { name: "Build a Café Order Calculator" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Alex Morgan/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("$50").length).toBeGreaterThan(0);
    expect(screen.getByText("Variables")).toBeInTheDocument();
    expect(screen.getByText(/A runnable Python script/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply for Project" })).toBeDisabled();
    expect(screen.getByTestId("gigboard-application-locked")).toBeInTheDocument();
    expect(screen.getByTestId("gigboard-application-status")).toHaveTextContent("Not applied");

    fireEvent.click(screen.getByRole("button", { name: /Back to job listings/ }));
    expect(screen.getByRole("heading", { name: /Browse freelance jobs/ })).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "View details for Build a Café Order Calculator" }),
    );
    expect(
      screen.getByRole("heading", { name: "Build a Café Order Calculator" }),
    ).toBeInTheDocument();
  });

  it("navigates back and forward between GigBoard pages", () => {
    render(<BrowserApp />);
    navigateTo("gigboard.codequest/jobs");
    fireEvent.click(
      screen.getByRole("button", { name: "View details for Build a Café Order Calculator" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: /Browse freelance jobs/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Forward" }));
    expect(
      screen.getByRole("heading", { name: "Build a Café Order Calculator" }),
    ).toBeInTheDocument();
  });

  it("supports default, added, and removed bookmarks", () => {
    render(<BrowserApp />);
    fireEvent.click(screen.getByRole("button", { name: "Bookmarks" }));

    expect(screen.getByRole("menuitem", { name: /QuestSearch/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /GigBoard/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: /QuestSearch/ }));
    expect(addressBar()).toHaveValue("search.codequest");

    navigateTo("gigboard.codequest/jobs");
    expect(screen.getByRole("button", { name: "Add bookmark" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add bookmark" }));
    expect(screen.getByRole("button", { name: "Remove bookmark" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bookmarks" }));
    expect(screen.getByRole("menuitem", { name: /GigBoard Jobs/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: /GigBoard Jobs/ }));
    expect(addressBar()).toHaveValue("gigboard.codequest/jobs");

    fireEvent.click(screen.getByRole("button", { name: "Remove bookmark" }));
    expect(screen.getByRole("button", { name: "Add bookmark" })).toBeInTheDocument();
  });

  it("offers functional actions in the browser menu", () => {
    render(<BrowserApp />);
    fireEvent.click(screen.getByRole("button", { name: "Browser menu" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "New tab" }));

    expect(tabs()).toHaveLength(2);
    expect(selectedTab()).toHaveTextContent("CodeQuest Browser");
  });

  it("focuses and selects the address bar with Ctrl+L while active", () => {
    render(<BrowserApp />);
    act(() => useWindows.getState().open("browser"));

    const input = addressBar();
    input.blur();
    fireEvent.keyDown(window, { key: "l", ctrlKey: true });

    expect(input).toHaveFocus();
    act(() => useWindows.getState().close("browser"));
  });

  it("shows a not-found page for unsupported addresses", () => {
    render(<BrowserApp />);
    navigateTo("https://unknown.example/");

    expect(screen.getByRole("heading", { name: "Website not found" })).toBeInTheDocument();
    expect(addressBar()).toHaveValue("unknown.example");
    expect(screen.getByText("unknown.example")).toBeInTheDocument();
  });

  it("never mutates Chapter 1 progress while browsing or previewing an application", () => {
    const before = JSON.stringify(useChapter1.getState().progress);
    render(<BrowserApp />);

    navigateTo("gigboard.codequest/jobs/cafe-calculator");
    fireEvent.click(screen.getByRole("button", { name: "Apply for Project" }));

    expect(JSON.stringify(useChapter1.getState().progress)).toBe(before);
  });

  it("uses deterministic keyword ranking for different searches", () => {
    expect(searchQuestSearch("cafe calculator")[0]?.title).toMatch(/Café Order Calculator/);
    expect(searchQuestSearch("questsearch engine")[0]?.title).toMatch(/QuestSearch/);
  });

  it("is registered as a pinned Pixel OS app that opens in the window manager", () => {
    expect(APPS.browser.id).toBe("browser");
    expect(APPS.browser.icon).toBe("browser");
    expect(APPS.browser.pinned).toBe(true);
    expect(APP_ORDER).toContain("browser");
    expect(PINNED_APPS).toContain("browser");

    act(() => useWindows.getState().open("browser"));

    expect(useWindows.getState().windows.browser.open).toBe(true);
    expect(useWindows.getState().focused).toBe("browser");

    act(() => useWindows.getState().close("browser"));
  });
});
