import { test, expect } from "@playwright/test";
import { signUpAndOnboard, selectOption } from "./helpers";

test("crear tarjeta de crédito y cerrar estado de cuenta", async ({ page }) => {
  const email = `e2e-card-${Date.now()}@example.com`;

  await signUpAndOnboard(page, {
    nombre: "Usuario Tarjeta",
    email,
    password: "Test1234!",
  });

  await page.goto("/cuentas");
  await page.getByRole("button", { name: "Nueva cuenta" }).click();

  await page.locator("#nombre").fill("Visa E2E");
  await selectOption(page, "Cuenta bancaria", "Tarjeta de crédito");

  await page.locator("#limite_credito").fill("2000");
  await page.locator("#dia_corte").fill("15");
  await page.locator("#dia_pago").fill("5");

  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Visa E2E")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Disponible: $2,000.00 de $2,000.00")).toBeVisible();

  await page.goto("/tarjetas");
  await expect(page.getByText("Visa E2E")).toBeVisible();
  await expect(page.getByText(/Período actual/)).toBeVisible();

  await page.getByRole("button", { name: "Cerrar estado de cuenta" }).click();

  // El historial pasa de "sin estados" a mostrar la tabla con el período cerrado
  await expect(page.getByRole("columnheader", { name: "Mínimo a pagar" })).toBeVisible({
    timeout: 10000,
  });
});
