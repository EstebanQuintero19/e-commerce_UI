import { expect, test, type Page } from '@playwright/test';

const API = 'http://localhost:8000/api/v1';

async function firstProductWithStock(page: Page) {
  const res = await page.request.get(`${API}/products?per_page=5`);
  const { data } = await res.json();
  return data.find((p: { variants: { available: number }[] }) => p.variants.some((v) => v.available > 0));
}

test.describe('Compra completa', () => {
  test('invitado agrega a la bolsa y paga sin cuenta; el pedido se sigue por token', async ({ page, isMobile }) => {
    const product = await firstProductWithStock(page);

    // Catálogo: el listado carga y la tarjeta lleva al detalle.
    await page.goto('/productos');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Toda la tienda/);
    await page.goto(`/productos/${product.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(product.name);

    // Agregar como invitado (sin sesión): se abre la mini-bolsa.
    await page.getByRole('button', { name: 'Agregar a la bolsa' }).click();
    const drawer = page.getByRole('dialog', { name: 'Tu bolsa' });
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(product.name);
    await drawer.getByRole('link', { name: 'Ver bolsa' }).click();
    await expect(page).toHaveURL(/\/carrito/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu bolsa');

    // El checkout no pide cuenta: correo + dirección (no se guarda) y cotización de envío.
    await page.getByRole('link', { name: 'Continuar al pago' }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.getByText(product.name).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirmar y pagar' })).toBeDisabled();
    await page.getByLabel('Correo').fill(`e2e-${Date.now()}@test.co`);
    await page.getByLabel('Quién recibe').fill('E2E Invitado');
    await page.getByLabel('Teléfono').fill('3000000000');
    await page.getByPlaceholder('Calle 10 # 20-30').fill('Calle 1 # 2-3');
    await page.getByLabel('Ciudad').fill('Bogotá');
    await page.getByLabel('Departamento').selectOption('Cundinamarca');
    await page.getByRole('button', { name: 'Usar esta dirección' }).click();
    await expect(page.getByRole('button', { name: 'Cambiar' })).toBeVisible();

    // Confirmar → pago simulado → aprobado.
    await page.getByRole('button', { name: 'Confirmar y pagar' }).click();
    await expect(page).toHaveURL(/\/checkout\/result/);
    await page.getByRole('button', { name: /Simular pago/ }).click();
    await expect(page.getByRole('heading', { name: 'Pago aprobado' })).toBeVisible();
    await page.getByRole('link', { name: 'Ver pedido' }).click();
    await expect(page.getByText('Pagado').first()).toBeVisible();
    if (!isMobile) await expect(page.getByRole('list', { name: 'Estado del pedido' })).toContainText('Pagado');

    // Sin el token (otro navegador, sin el enlace del correo) el pedido no se ve.
    const orderUrl = page.url();
    await page.evaluate(() => localStorage.removeItem('guest_orders'));
    await page.goto(orderUrl);
    await expect(page).not.toHaveURL(/\/pedidos\//);
  });
});

test.describe('Catálogo', () => {
  test('filtros y orden cambian la URL y el listado', async ({ page }) => {
    await page.goto('/productos?gender=mujer');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mujer');
    await page.getByRole('button', { name: /Filtros/ }).click();
    await page.getByRole('link', { name: 'M', exact: true }).click();
    await expect(page).toHaveURL(/size=M/);
    await page.getByLabel('Ordenar').selectOption('price_asc');
    await expect(page).toHaveURL(/sort=price_asc/);
    const prices = await page.locator('app-product-card .price').allTextContents();
    const nums = prices.map((p) => Number(p.replace(/\D/g, '')));
    expect(nums).toEqual([...nums].sort((a, b) => a - b));
    await page.getByRole('link', { name: 'Quitar filtros' }).click();
    await expect(page).not.toHaveURL(/size=M/);
  });

  test('favoritos como invitado se guardan en el navegador', async ({ page }) => {
    await page.goto('/productos');
    const card = page.locator('app-product-card').first();
    const name = await card.locator('.name').textContent();
    await card.getByRole('button', { name: 'Guardar en favoritos' }).click();
    await page.goto('/favoritos');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Favoritos');
    await expect(page.locator('app-product-card')).toHaveCount(1);
    await expect(page.locator('app-product-card .name')).toHaveText(name!);
  });

  test('vista rápida agrega sin salir del listado', async ({ page, isMobile }) => {
    test.skip(isMobile, 'La vista rápida no existe en táctil');
    await page.goto('/productos');
    const card = page.locator('app-product-card').first();
    await card.hover();
    await card.getByRole('button', { name: /Vista rápida/ }).click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog.getByRole('button', { name: 'Agregar a la bolsa' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Agregar a la bolsa' }).click();
    await expect(page.getByRole('dialog', { name: 'Tu bolsa' })).toBeVisible();
    await expect(page).toHaveURL(/\/productos$/);
  });
});
