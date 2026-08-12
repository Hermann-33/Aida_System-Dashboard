import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import './layouts.css';

/**
 * Admin layout — separate product tree.
 * Must never render POS checkout controls or POS navigation.
 */
export function AdminLayout() {
  return (
    <div className="layout layout-admin" data-product="admin">
      <AdminSidebar />
      <main className="layout-main admin-main">
        <Outlet />
      </main>
    </div>
  );
}
