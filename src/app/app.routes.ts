import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/guards';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    children: [
      { path: '', redirectTo: 'productos', pathMatch: 'full' },
      { path: 'productos', loadComponent: () => import('./features/catalog/product-list').then((m) => m.ProductList) },
      { path: 'productos/:id', loadComponent: () => import('./features/catalog/product-detail').then((m) => m.ProductDetail) },
      { path: 'login', loadComponent: () => import('./features/auth/login').then((m) => m.Login) },
      { path: 'registro', loadComponent: () => import('./features/auth/register').then((m) => m.Register) },
      // Enlace del correo de recuperación: ?token=&email=
      { path: 'reset-password', loadComponent: () => import('./features/auth/reset-password').then((m) => m.ResetPassword) },
      {
        path: '',
        canActivate: [authGuard],
        children: [
          { path: 'carrito', loadComponent: () => import('./features/cart/cart').then((m) => m.Cart) },
          { path: 'checkout', loadComponent: () => import('./features/checkout/checkout').then((m) => m.Checkout) },
          // Aquí vuelve el cliente desde la pasarela (MP_BACK_URL). Con el driver fake se llega desde el checkout.
          { path: 'checkout/result', loadComponent: () => import('./features/checkout/payment-result').then((m) => m.PaymentResult) },
          { path: 'pedidos', loadComponent: () => import('./features/orders/order-list').then((m) => m.OrderList) },
          { path: 'pedidos/:id', loadComponent: () => import('./features/orders/order-detail').then((m) => m.OrderDetail) },
          { path: 'facturas', loadComponent: () => import('./features/invoices/invoice-list').then((m) => m.InvoiceList) },
          { path: 'cuenta', loadComponent: () => import('./features/account/addresses').then((m) => m.Addresses) },
        ],
      },
      {
        path: 'admin',
        canActivate: [authGuard, adminGuard],
        loadComponent: () => import('./features/admin/admin-layout').then((m) => m.AdminLayout),
        children: [
          { path: '', redirectTo: 'pedidos', pathMatch: 'full' },
          { path: 'pedidos', loadComponent: () => import('./features/admin/admin-orders').then((m) => m.AdminOrders) },
          { path: 'productos', loadComponent: () => import('./features/admin/admin-products').then((m) => m.AdminProducts) },
          { path: 'inventario', loadComponent: () => import('./features/admin/admin-inventory').then((m) => m.AdminInventory) },
          { path: 'cupones', loadComponent: () => import('./features/admin/admin-coupons').then((m) => m.AdminCoupons) },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
