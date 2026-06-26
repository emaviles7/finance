import { type Page, expect } from "@playwright/test";

export async function signUpAndOnboard(
  page: Page,
  opts: {
    nombre: string;
    email: string;
    password: string;
    familiaNombre?: string;
    cuentaNombre?: string;
    balanceInicial?: string;
  }
) {
  await page.goto("/registro");
  await page.locator("#nombre").fill(opts.nombre);
  await page.locator("#email").fill(opts.email);
  await page.locator("#password").fill(opts.password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  // Onboarding simplificado a un solo paso: balance inicial de la
  // Cuenta Madre (se crea automáticamente, junto con categorías y
  // líneas presupuestarias base, sin pedirle nombre de familia/cuenta).
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 });
  await page.locator("#balance").fill(opts.balanceInicial ?? "1000");
  await page.getByRole("button", { name: "Finalizar" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

export async function selectOption(page: Page, triggerText: string | RegExp, optionName: string | RegExp) {
  await page
    .locator('[data-slot="select-trigger"]')
    .filter({ hasText: triggerText })
    .first()
    .click();
  await page.getByRole("option", { name: optionName }).click();
}
