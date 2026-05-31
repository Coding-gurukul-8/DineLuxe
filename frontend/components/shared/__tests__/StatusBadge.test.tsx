import { render, screen } from "@testing-library/react";
import { StatusBadge } from "../StatusBadge";

describe("StatusBadge", () => {
  it.each([
    ["free", "Free"],
    ["occupied", "Occupied"],
    ["reserved", "Reserved"],
    ["cleaning", "Cleaning"],
    ["maintenance", "Maintenance"],
    ["confirmed", "Confirmed"],
    ["preparing", "Preparing"],
    ["ready", "Ready"],
    ["cancelled", "Cancelled"],
  ])("renders %s as %s", (status, label) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each([
    ["free", "bg-status-success/10"],
    ["occupied", "bg-status-danger/10"],
    ["reserved", "bg-status-info/10"],
    ["cleaning", "bg-status-cleaning/10"],
    ["maintenance", "bg-status-neutral/10"],
    ["preparing", "bg-status-warning/10"],
    ["ready", "bg-status-success/10"],
  ])("applies the expected class for %s", (status, className) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByText(/./).parentElement).toHaveClass(className);
  });

  it("supports custom children", () => {
    render(<StatusBadge status="ready">Custom</StatusBadge>);

    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("matches the default snapshot", () => {
    const { asFragment } = render(<StatusBadge status="ready" />);
    expect(asFragment()).toMatchSnapshot();
  });

  it("matches the compact snapshot", () => {
    const { asFragment } = render(<StatusBadge status="maintenance" size="sm" />);
    expect(asFragment()).toMatchSnapshot();
  });
});