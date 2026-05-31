import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FloorMap, type FloorTable } from "../FloorMap";

const tables: FloorTable[] = [
  { id: "t1", label: "T1", capacity: 4, status: "free", shape: "round", x: 10, y: 10, width: 72, height: 72 },
  { id: "t2", label: "T2", capacity: 2, status: "occupied", shape: "square", x: 120, y: 10, width: 68, height: 68 },
];

describe("FloorMap", () => {
  it("renders tables with the expected aria labels in read-only mode", () => {
    render(<FloorMap branchId="branch-1" tables={tables} readOnly />);

    expect(screen.getByLabelText("Table T1, free, 4 seats")).toBeInTheDocument();
    expect(screen.getByLabelText("Table T2, occupied, 2 seats")).toBeInTheDocument();
  });

  it("invokes onTableClick when a table is clicked in read-only mode", async () => {
    const user = userEvent.setup();
    const onTableClick = jest.fn();

    render(<FloorMap branchId="branch-1" tables={tables} readOnly onTableClick={onTableClick} />);

    await user.click(screen.getByLabelText("Table T1, free, 4 seats"));
    expect(onTableClick).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
  });

  it("applies status color styles inline", () => {
    render(<FloorMap branchId="branch-1" tables={tables} readOnly />);

    const freeTable = screen.getByLabelText("Table T1, free, 4 seats");
    expect(freeTable).toHaveStyle({ borderColor: "#1E7E34" });
  });

  it("shows the merged legend entry when merge mode is enabled", () => {
    render(<FloorMap branchId="branch-1" tables={tables} readOnly mergeMode />);

    expect(screen.getByText("Merged")).toBeInTheDocument();
  });
});