import { expect, test, type Page } from '@playwright/test';

const API = 'http://localhost:8000/api/v1';

// Con Origin del front la API responde con la cookie de sesión (HttpOnly), que queda en el contexto del navegador.
// La SPA además cachea el usuario en localStorage para pintar sin esperar a /auth/me.
async function registerViaApi(page: Page) {
  const email = `sec-${Date.now()}@test.co`;
  const password = 'clave-segura-123';
  await page.request.get(`${API.replace(/\/api\/v1$/, '')}/sanctum/csrf-cookie`, { headers: { Origin: 'http://localhost:4200' } });
  const xsrf = (await page.context().cookies()).find((c) => c.name === 'XSRF-TOKEN')!.value;
  const res = await page.request.post(`${API}/auth/register`, {
    data: { name: 'Sec Test', email, password, password_confirmation: password },
    headers: { Origin: 'http://localhost:4200', 'X-XSRF-TOKEN': decodeURIComponent(xsrf) },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.token).toBeUndefined();
  return { email, password, user: body.user as { id: number; name: string; email: string; role: string } };
}

test.describe('Hardening', () => {
  test('no hay redirección abierta tras iniciar sesión', async ({ page }) => {
    const { email, password } = await registerViaApi(page);
    for (const evil of ['https://evil.example/phishing', '//evil.example', '/\evil.example', 'javascript:alert(1)']) {
      await page.goto(`/login?redirect=${encodeURIComponent(evil)}`);
      await page.getByLabel('Correo').fill(email);
      await page.getByLabel('Contraseña').fill(password);
      await page.getByRole('button', { name: 'Iniciar sesión' }).click();
      // Nunca sale del origen: aterriza en la tienda (o en la 404 propia si el parámetro era un path interno inexistente).
      await expect(page).not.toHaveURL(/\/login/); // el login terminó...
      expect(page.url()).toMatch(/^http:\/\/localhost:4200\//); // ...y nunca salió del origen
      if (/evil/.test(page.url())) await expect(page.locator('app-not-found')).toBeVisible(); // '/evil.example' es un path interno: 404 propia
      expect(await page.evaluate(() => localStorage.getItem('user'))).not.toBeNull(); // la sesión sí se creó
      await page.evaluate(() => localStorage.clear());
      await page.context().clearCookies();
    }
  });

  test('la sesión es una cookie HttpOnly y no hay token legible desde JS', async ({ page }) => {
    const { email, password } = await registerViaApi(page);
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Correo').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page).not.toHaveURL(/\/login/);
    const session = (await page.context().cookies()).find((c) => c.name.endsWith('-session'));
    expect(session?.httpOnly).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain('-session=');
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
    // Con la cookie, la API reconoce la sesión sin ninguna cabecera Authorization (un 401 mandaría a /login).
    await page.goto('/pedidos');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/pedidos$/);
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
    const { user } = await registerViaApi(page);
    await page.addInitScript((u) => localStorage.setItem('user', JSON.stringify(u)), user);
    const leaks: string[] = [];
    const thirdParty: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      const external = url.hostname !== 'localhost' && url.hostname !== '127.0.0.1';
      if (external) thirdParty.push(req.url());
      const h = req.headers();
      if ((h['x-xsrf-token'] || h['x-cart-token'] || h['authorization']) && !req.url().startsWith(API)) leaks.push(req.url());
    });
    await page.goto('/');
    await page.goto('/productos');
    await page.goto('/favoritos');
    await page.waitForLoadState('networkidle');
    expect(leaks).toEqual([]);
    expect(thirdParty).toEqual([]);
  });

  test('un rol manipulado en localStorage no abre el panel admin', async ({ page }) => {
    const { user } = await registerViaApi(page); // sesión real de cliente en la cookie
    await page.addInitScript((u) => localStorage.setItem('user', JSON.stringify({ ...u, role: 'admin' })), user);
    await page.goto('/admin/pedidos');
    await expect(page).toHaveURL(/^http:\/\/localhost:4200\/$/);
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });

  test('rutas privadas piden sesión y conservan el destino', async ({ page }) => {
    await page.goto('/pedidos');
    await expect(page).toHaveURL(/\/login\?redirect=%2Fpedidos/);
    await page.goto('/cuenta');
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

  test('un 401 con sesión vencida limpia el usuario cacheado y lleva a login', async ({ page }) => {
    // Usuario cacheado pero sin cookie de sesión: /auth/me responde 401.
    await page.addInitScript(() => {
      localStorage.setItem('user', JSON.stringify({ id: 99, name: 'X', email: 'x@test.co', role: 'customer' }));
    });
    await page.goto('/pedidos');
    await expect(page).toHaveURL(/\/login/);
    expect(await page.evaluate(() => localStorage.getItem('user'))).toBeNull();
  });
});
