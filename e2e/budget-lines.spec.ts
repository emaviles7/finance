import { test, expect } from "@playwright/test";
import { signUpAndOnboard, selectOption } from "./helpers";

test("categorías y líneas presupuestarias independientes (mismo mes, misma categoría)", async ({ page }) => {
  const email = `e2e-lineas-${Date.now()}@example.com`;

  await signUpAndOnboard(page, {
    nombre: "Usuario Lineas",
    email,
    password: "Test1234!",
  });

  // Crear categoría "Alimentación" desde Configuración
  await page.goto("/configuracion");
  await page.getByRole("button", { name: "Nueva categoría" }).click();
  await page.locator("#nombre").fill("Alimentación");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Alimentación")).toBeVisible({ timeout: 10000 });

  // Crear dos líneas presupuestarias bajo la misma categoría
  await page.goto("/presupuestos");
  await page.getByRole("button", { name: "Nueva línea" }).click();
  await page.locator("#nombre").fill("Mercado Local");
  await selectOption(page, "Selecciona una categoría", "Alimentación");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("link", { name: "Mercado Local" }).first()).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Nueva línea" }).click();
  await page.locator("#nombre").fill("Restaurantes");
  await selectOption(page, "Selecciona una categoría", "Alimentación");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("link", { name: "Restaurantes" }).first()).toBeVisible({ timeout: 10000 });

  // Asignar presupuesto a "Mercado Local"
  await page.getByRole("button", { name: "Editar presupuesto Mercado Local" }).click();
  await page.locator('input[type="number"]').first().fill("200");
  await page.getByRole("button", { name: "Guardar" }).click();
  // El toast es efímero (se autodescarta); en vez de esperarlo, se espera a
  // que el popover de edición se cierre, señal de que el guardado terminó.
  await expect(page.locator('input[type="number"]')).toBeHidden({ timeout: 10000 });

  // Asignar presupuesto a "Restaurantes" en el MISMO mes: no debe fallar
  // (este es exactamente el bug que se corrigió: dos líneas de la misma
  // categoría deben poder tener presupuesto independiente el mismo mes)
  await page.getByRole("button", { name: "Editar presupuesto Restaurantes" }).click();
  await page.locator('input[type="number"]').first().fill("80");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator('input[type="number"]')).toBeHidden({ timeout: 10000 });

  // Ambas líneas deben mostrar su propio presupuesto en la tabla general,
  // de forma independiente.
  const filaMercadoLocal = page.getByRole("row", { name: /Mercado Local/ });
  const filaRestaurantes = page.getByRole("row", { name: /Restaurantes/ });
  await expect(filaMercadoLocal).toContainText("$200.00");
  await expect(filaRestaurantes).toContainText("$80.00");
});
