import path from "path";
import { test, expect } from "@playwright/test";
import { signUpAndOnboard, selectOption } from "./helpers";

test("importar transacciones desde CSV", async ({ page }) => {
  const email = `e2e-import-${Date.now()}@example.com`;

  await signUpAndOnboard(page, {
    nombre: "Usuario Import",
    email,
    password: "Test1234!",
    familiaNombre: "Familia E2E Import",
    cuentaNombre: "Cuenta E2E Import",
  });

  await page.goto("/transacciones");
  await page.getByRole("button", { name: "Importar" }).click();

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(__dirname, "fixtures", "sample-transactions.csv"));

  // Paso 2: mapeo + cuenta destino
  await expect(page.getByText("3 filas detectadas")).toBeVisible();
  await selectOption(page, "Selecciona una cuenta", "Cuenta E2E Import");

  await page.getByRole("button", { name: /Importar 3 transacciones/ }).click();

  await expect(page.getByText("3 transacciones importadas")).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Cerrar" }).click();

  await expect(page.getByText("Compra Supermercado")).toBeVisible();
  await expect(page.getByText("Pago de servicios")).toBeVisible();
  await expect(page.getByText("Deposito nomina")).toBeVisible();
});
