# E-commerce UI

Frontend Angular 22 (standalone, signals, SCSS, sin SSR). Consume la API en `http://localhost:8000/api/v1` (Swagger en `/api/documentation`).

## Arranque
```sh
npm install --legacy-peer-deps   # npm 10.9.x falla resolviendo el peer opcional `canvas` de jsdom sin este flag
npm start                        # http://localhost:4200
```
Requiere Node 22.22+ (`nvm use 22`). La API debe estar corriendo (`docker compose up -d` en `../e-commerce_API`).

## Estructura
```
src/app/
├── core/          models.ts (tipos = schemas Swagger), api.service.ts (un método por endpoint),
│                  auth.service.ts (token/usuario en signals + localStorage), auth.interceptor.ts (Bearer, 401 → /login), guards.ts
├── layout/        shell.ts (cabecera + nav + outlet)
└── features/      una carpeta por área, componentes lazy: auth, catalog, cart, checkout, orders, invoices, account, admin
```

## Rutas
| Ruta | Acceso |
|---|---|
| `/productos`, `/productos/:id` | público |
| `/login`, `/registro`, `/reset-password` | público |
| `/carrito`, `/checkout`, `/checkout/result`, `/pedidos`, `/pedidos/:id`, `/facturas`, `/cuenta` | cliente |
| `/admin/pedidos`, `/admin/productos`, `/admin/inventario`, `/admin/cupones` | admin |

`/checkout/result` es la URL a la que Mercado Pago devuelve al cliente (`MP_BACK_URL` en la API).

## Diseño
Tokens en `src/styles.scss` (`--bg` gris tela, `--indigo` estructura, `--thread` única acción, `.tag` etiqueta de precio). Fuente Schibsted Grotesk (Google Fonts, `index.html`). Utilidades globales: `.btn`, `.input`, `.card`, `.badge`, `.chip`, `.qty`, `.table-wrap`; los componentes solo añaden layout propio.

## Patrones
- Datos a partir de inputs de ruta: `toObservable(input).pipe(switchMap(api))` (no `effect()` + HTTP).
- Errores: `errorMessage(err)` para toasts, `applyFormErrors(form, err)` para 422 por campo (`shared/ui.ts`).
- Carrito global en `CartStore` (contador de la cabecera); cada operación de la API reemplaza el carrito entero.
- Pago: `POST /payments` → si `checkout_url` (Mercado Pago) redirige; si no (fake) va a `/checkout/result?payment=ID`, que también recibe el retorno de MP (`?external_reference=MP-ID`) y consulta el pago hasta que deje de estar pendiente.

## Tests e2e (Playwright)
Con la API corriendo en Docker (`docker compose up -d` en `../e-commerce_API`):

```sh
npm run e2e        # desktop + móvil, levanta `ng serve` si no está
npm run e2e:ui     # modo interactivo
```

Cubren: compra completa como invitado → registro en el checkout → dirección → pago simulado → pedido pagado; filtros y orden; favoritos de invitado; vista rápida.

## Build de producción
`npx ng build --configuration production` → `dist/e-commerce_UI/browser`. Servir con fallback a `index.html` (SPA). Lighthouse móvil de referencia: rendimiento 88–91, accesibilidad 100, SEO 100.

## Seguridad del frontend (hardening 2026-09-16)
Qué protege y dónde está:

| Riesgo | Medida |
|---|---|
| XSS | Angular escapa todo; no hay `innerHTML` ni `bypassSecurityTrust`. CSP `script-src 'self'` sin inline (por eso `inlineCritical: false` en `angular.json`). |
| Open redirect | `?redirect=` pasa por `core/safe-url.ts` (`safeInternalPath`): solo rutas internas. |
| Redirección a pasarela | `safeGatewayUrl`: solo `https` (http únicamente a localhost). Enlaces externos con `rel="noopener noreferrer"`. |
| Fuga de credenciales | El interceptor solo añade `Authorization`/`X-Cart-Token` a `environment.apiUrl`; nunca a otros hosts. Test e2e lo verifica. |
| Sesión manipulada | `localStorage` se valida por forma; el rol se confirma con `/auth/me` al arrancar y en el guard de `/admin`. Un 401 limpia la sesión. |
| Fugas en errores | 5xx y 429 muestran mensajes genéricos; nunca el texto del servidor. |
| Clickjacking / MIME / referrer | `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, HSTS: cabeceras en `deploy/nginx.conf.example` (no funcionan en `<meta>`). `<meta name="referrer">` como refuerzo. |
| Entradas | `maxlength`/`autocomplete` en formularios; la API valida siempre. |
| Terceros | Sin scripts ni fuentes externas (fuente local, fotos propias). `npm audit`: 0 vulnerabilidades. |
| Fuerza bruta | Login/registro limitados por IP en la API (`AUTH_RATE_LIMIT`, 5/min por defecto; 60 en local para e2e). |

- `src/index.html` lleva la CSP de producción (`connect-src 'self'`: la API va detrás del mismo dominio, `environment.prod.ts` → `/api/v1`). `src/index.dev.html` es la de `ng serve` (permite `localhost:8000` y el websocket).
- En producción `APP_URL` de la API debe ser el dominio público: las URLs de imágenes son absolutas y `img-src 'self'` bloquea cualquier otro host.
- Pendiente (decisión de arquitectura): mover el token a cookie `HttpOnly` con Sanctum en modo SPA (+ CSRF). Hoy el bearer vive en `localStorage`; la CSP estricta es la mitigación.
- Tests: `e2e/security.spec.ts` (open redirect, XSS reflejado, no fuga de credenciales/terceros, rol manipulado, rutas privadas, CSP, 401).
