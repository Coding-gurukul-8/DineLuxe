import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FoodCard } from "../FoodCard";

describe("FoodCard", () => {
  it("renders the literal rupee price format", () => {
    render(
      <FoodCard
        item={{
          id: "1",
          name: "Paneer Tikka",
          price: 240,
          isAvailable: true,
        }}
      />
    );

    expect(screen.getByText("Rs 240")).toBeInTheDocument();
  });

  it("shows the sold out overlay when isSoldOut is true", () => {
    render(
      <FoodCard
        item={{
          id: "1",
          name: "Paneer Tikka",
          price: 240,
          isSoldOut: true,
        }}
      />
    );

    expect(screen.getByText("Sold Out")).toBeInTheDocument();
  });

  it("disables add when unavailable and does not call the callback", async () => {
    const user = userEvent.setup();
    const onAddToCart = jest.fn();

    render(
      <FoodCard
        item={{
          id: "1",
          name: "Paneer Tikka",
          price: 240,
          isAvailable: false,
        }}
        onAddToCart={onAddToCart}
      />
    );

    const button = screen.getByRole("button", { name: /add/i });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onAddToCart).not.toHaveBeenCalled();
  });

  it("uses discounted price when present", () => {
    render(
      <FoodCard
        item={{
          id: "1",
          name: "Paneer Tikka",
          price: 300,
          discountedPrice: 240,
        }}
      />
    );

    expect(screen.getByText("Rs 240")).toBeInTheDocument();
    expect(screen.getByText("Rs 300")).toBeInTheDocument();
  });
});