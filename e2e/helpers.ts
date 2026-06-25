import { type Page, expect } from "@playwright/test";

export async function signUpAndOnboard(
  page: Page,
  opts: { nombre: string; email: string; password: string; familiaNombre: string; cuentaNombre: string }
) {
  await page.goto("/registro");
  await page.locator("#nombre").fill(opts.nombre);
  await page.locator("#email").fill(opts.email);
  await page.locator("#password").fill(opts.password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15000 });
  await page.locator("#familia").fill(opts.familiaNombre);
  await page.getByRole("button", { name: "Siguiente" }).click();

  await page.locator("#cuenta").fill(opts.cuentaNombre);
  await page.locator("#saldo").fill("1000");
  await page.getByRole("button", { name: "Siguiente" }).click();

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
