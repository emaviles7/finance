import { test, expect } from "@playwright/test";
import { signUpAndOnboard, selectOption } from "./helpers";

test("registro -> onboarding -> crear transacción -> dashboard se actualiza", async ({ page }) => {
  const email = `e2e-tx-${Date.now()}@example.com`;

  await signUpAndOnboard(page, {
    nombre: "Usuario E2E",
    email,
    password: "Test1234!",
  });

  await expect(page.getByText("Familia de Usuario E2E")).toBeVisible();

  await page.goto("/transacciones");
  await page.getByRole("button", { name: "Nueva transacción" }).click();

  await selectOption(page, "Egreso", "Ingreso");

  await page.locator("#fecha").fill(new Date().toISOString().slice(0, 10));
  await page.locator("#descripcion").fill("Salario E2E");
  await page.locator("#monto").fill("500");

  await selectOption(page, "Selecciona una cuenta", "Cuenta Principal");

  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Salario E2E")).toBeVisible({ timeout: 10000 });

  await page.goto("/dashboard");
  // saldo_inicial 1000 + ingreso 500 = 1500 disponible
  await expect(page.getByText(/1,?500\.00/)).toBeVisible({ timeout: 10000 });
});
