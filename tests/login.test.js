import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/vitest/hooks";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

describe("FuelTrack Operations Portal - Login", () => {
  it("should display the login page with operations portal branding", async (context) => {
    const testdriver = TestDriver(context);

    await testdriver.provision.chrome({
      url: APP_URL,
    });

    const emailInput = await testdriver.find("Email input field");
    expect(emailInput).toBeDefined();

    const result = await testdriver.assert(
      "the FuelTrack login card is visible with email and password fields"
    );
    expect(result).toBeTruthy();
  });

  it("should toggle password visibility when clicking Show/Hide button", async (context) => {
    const testdriver = TestDriver(context);

    await testdriver.provision.chrome({
      url: APP_URL,
    });

    const passwordInput = await testdriver.find("Password input field");
    await passwordInput.click();
    await testdriver.type("FuelTrack123!");

    const showButton = await testdriver.find("Show button");
    await showButton.click();

    const result = await testdriver.assert(
      "the password text is visible and the toggle shows Hide"
    );
    expect(result).toBeTruthy();
  });

  it("should fill and submit admin credentials", async (context) => {
    const testdriver = TestDriver(context);

    await testdriver.provision.chrome({
      url: APP_URL,
    });

    const emailInput = await testdriver.find("Email input field");
    await emailInput.click();
    await testdriver.type("admin@fueltrack.local");

    const passwordInput = await testdriver.find("Password input field");
    await passwordInput.click();
    await testdriver.type("FuelTrack123!");

    const signInButton = await testdriver.find("Sign in button");
    await signInButton.click();

    const result = await testdriver.assert(
      "the login form was submitted"
    );
    expect(result).toBeTruthy();
  });
});
