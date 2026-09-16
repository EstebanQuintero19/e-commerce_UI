import { expect, test, type Page } from '@playwright/test';

const API = 'http://localhost:8000/api/v1';

async function registerViaApi(page: Page) {
  const email = `sec-${Date.now()}@test.co`;
  const password = 'clave-segura-123';
  const res = await page.request.post(`${API}/auth/register`, { data: { name: 'Sec Test', email, password, password_confirmation: password } });
  expect(res.ok()).toBeTruthy();
  return { email, password, token: (await res.json()).token as string };
}

test.describe('Hardening', () => {
  test('no hay redirección abierta tras iniciar sesión', async ({ page }) => {
    const { email, password } = await registerViaApi(page);
    for (const evil of ['https://evil.example/phishing', '//evil.example', '/\evil.example', 'javascript:alert(1)']) {
      await page.goto(`/login?redirect=${encodeURIComponent(evil)}`);
      await page.getByLabel('Correo').fill(email);
      await page.getByLabel('Contraseña').fill(password);
      await page.getByRole('button', { name: 'Iniciar sesión' }).click();
      // Nunca sale del origen: aterriza en la tienda (o en el inicio si el router no pudo interpretar el parámetro).
      await expect(page).toHaveURL(/^http:\/\/localhost:4200\/(productos)?$/);
      expect(await page.evaluate(() => localStorage.getItem('token'))).not.toBeNull(); // la sesión sí se creó
      await page.evaluate(() => localStorage.clear());
    }
  });

  test('la búsqueda refleja texto sin ejecutar HTML', async ({ page }) => {
    const payload = '<img src=x onerror="window.__xss=1">';
    await page.goto(`/productos?q=${encodeURIComponent(payload)}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Resultados para');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('<img');
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(await page.locator('h1 img').count()).toBe(0);
  });

  test('las credenciales solo viajan a la API y no hay llamadas a terceros', async ({ page }) => {
    const { token } = await registerViaApi(page);
    await page.addInitScript((t) => localStorage.setItem('token', JSON.stringify(t)), token);
    const leaks: string[] = [];
    const thirdParty: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      const external = url.hostname !== 'localhost' && url.hostname !== '127.0.0.1';
      if (external) thirdParty.push(req.url());
      if (req.headers()['authorization'] && !req.url().startsWith(API)) leaks.push(req.url());
    });
    await page.goto('/');
    await page.goto('/productos');
    await page.goto('/favoritos');
    await page.waitForLoadState('networkidle');
    expect(leaks).toEqual([]);
    expect(thirdParty).toEqual([]);
  });

  test('un rol manipulado en localStorage no abre el panel admin', async ({ page }) => {
    const { token } = await registerViaApi(page);
    await page.addInitScript((t) => {
      localStorage.setItem('token', JSON.stringify(t));
      localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Falso', email: 'falso@test.co', role: 'admin' }));
    }, token);
    await page.goto('/admin/pedidos');
    await expect(page).toHaveURL(/^http:\/\/localhost:4200\/$/);
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });

  test('rutas privadas piden sesión y conservan el destino', async ({ page }) => {
    await page.goto('/pedidos');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpedidos/);
    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/login/);
  });

  test('la página declara CSP y referrer policy', async ({ page }) => {
    await page.goto('/');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'strict-origin-when-cross-origin');
  });

  test('un 401 con token vencido limpia la sesión y lleva a login', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('token', JSON.stringify('1|token-vencido-o-inventado-1234567890'));
      localStorage.setItem('user', JSON.stringify({ id: 99, name: 'X', email: 'x@test.co', role: 'customer' }));
    });
    await page.goto('/pedidos');
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });
});
