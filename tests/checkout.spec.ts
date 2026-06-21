import { expect, test } from "@playwright/test";

test("customer can place a priority checkout order with a public email", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Checkout Diagnostics" })).toBeVisible();

  await page.getByTestId("customer-name").fill("Sam Developer");
  await page.getByTestId("customer-email").fill("sam@example.com");
  await page.getByTestId("support-plan").selectOption("priority");
  await page.getByTestId("submit-order").click();

  await expect(page.getByTestId("order-status")).toContainText("Order confirmed for Sam Developer.");
  await expect(page.getByTestId("developer-handoff")).toContainText(
    "ready for fulfillment in the priority support queue",
  );
});
