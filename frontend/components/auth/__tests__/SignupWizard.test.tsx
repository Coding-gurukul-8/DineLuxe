import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignupWizard } from "../SignupWizard";
import { signup } from "@/lib/auth-client";
import { ApiError } from "@repo/shared";

jest.mock("@/lib/auth-client", () => ({
  signup: jest.fn(),
}));

jest.mock("../PasswordStrengthMeter", () => ({
  PasswordStrengthMeter: ({ password }: { password: string }) => (
    <div data-testid="password-meter" data-password={password} />
  ),
}));

const mockedSignup = signup as jest.MockedFunction<typeof signup>;

describe("SignupWizard", () => {
  beforeEach(() => {
    mockedSignup.mockReset();
  });

  it("renders the first step", () => {
    render(<SignupWizard />);

    expect(screen.getByText("Your Profile")).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeInTheDocument();
  });

  it("moves to contact details after validating the first step", async () => {
    const user = userEvent.setup();
    render(<SignupWizard />);

    await user.type(screen.getByLabelText("First name"), "Asha");
    await user.type(screen.getByLabelText("Last name"), "Khan");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    expect(screen.getByText("Contact Details")).toBeInTheDocument();
  });

  it("flags taken emails during the debounced availability check", async () => {
    const user = userEvent.setup();
    render(<SignupWizard initialStep={1} />);

    await user.type(screen.getByLabelText("Email address"), "taken@example.com");

    await waitFor(() => {
      expect(screen.getByText("This email is already taken")).toBeInTheDocument();
    }, { timeout: 1600 });
  });

  it("passes the password through to the strength meter", async () => {
    const user = userEvent.setup();
    render(<SignupWizard initialStep={2} />);

    await user.type(screen.getByLabelText("Password"), "VeryStrong123!");

    expect(screen.getByTestId("password-meter")).toHaveAttribute("data-password", "VeryStrong123!");
  });

  it("submits and redirects on success", async () => {
    const user = userEvent.setup();
    mockedSignup.mockResolvedValueOnce(undefined as never);

    render(<SignupWizard />);

    await user.type(screen.getByLabelText("First name"), "Asha");
    await user.type(screen.getByLabelText("Last name"), "Khan");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.type(screen.getByLabelText("Email address"), "asha@example.com");
    await user.type(screen.getByLabelText("Phone number"), "9876543210");
    await waitFor(() => expect(screen.queryByText("This email is already taken")).not.toBeInTheDocument(), { timeout: 1400 });
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.type(screen.getByLabelText("Password"), "VeryStrong123!");
    await user.type(screen.getByLabelText("Confirm password"), "VeryStrong123!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockedSignup).toHaveBeenCalled();
    });
  });

  it("shows an ApiError message when signup fails with conflict", async () => {
    const user = userEvent.setup();
    mockedSignup.mockRejectedValueOnce(new ApiError(409, "conflict", "duplicate"));

    render(<SignupWizard />);

    await user.type(screen.getByLabelText("First name"), "Asha");
    await user.type(screen.getByLabelText("Last name"), "Khan");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.type(screen.getByLabelText("Email address"), "asha@example.com");
    await user.type(screen.getByLabelText("Phone number"), "9876543210");
    await waitFor(() => expect(screen.queryByText("This email is already taken")).not.toBeInTheDocument(), { timeout: 1400 });
    await user.click(screen.getByRole("button", { name: /continue/i }));

    await user.type(screen.getByLabelText("Password"), "VeryStrong123!");
    await user.type(screen.getByLabelText("Confirm password"), "VeryStrong123!");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText("An account with this email already exists.")).toBeInTheDocument();
    });
  });
});