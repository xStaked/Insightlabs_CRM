import React from "react";
import { render, screen } from "@testing-library/react";

import { EmptyState, ErrorState, LoadingState } from "@/components/ui/data-state";

describe("state components", () => {
  it("renders loading copy", () => {
    render(<LoadingState title="Loading" copy="Please wait" />);
    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.getByText("Please wait")).toBeInTheDocument();
  });

  it("renders empty copy", () => {
    render(<EmptyState title="Empty" copy="Nothing here yet" />);
    expect(screen.getByText("Empty")).toBeInTheDocument();
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders retry action on error state", () => {
    render(<ErrorState title="Error" copy="Failure" action={{ label: "Retry", onClick: () => undefined }} />);
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
