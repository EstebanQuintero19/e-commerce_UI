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
