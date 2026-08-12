import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { EmployeeLayout } from './layouts/EmployeeLayout';
import { PosLayout } from './layouts/PosLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { EmployeeWelcomePage } from './pages/EmployeeWelcomePage';
import { AdminLoginPage } from './pages/AdminLoginPage';
import { RoleSelectPage } from './pages/RoleSelectPage';
import { PosShellPage } from './pages/PosShellPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { AdminOverviewPage } from './features/admin/AdminOverviewPage';
import { AdminSalesPerformancePage } from './features/admin/AdminSalesPerformancePage';
import { AdminTransactionsPage } from './features/admin/AdminTransactionsPage';
import { AdminMembersLoyaltyReportPage } from './features/admin/AdminMembersLoyaltyReportPage';
import { AdminLocationsPage } from './features/admin/AdminLocationsPage';
import { AdminTerminalsPage } from './features/admin/AdminTerminalsPage';
import { AdminShiftsPage } from './features/admin/AdminShiftsPage';
import { AdminEmployeesPage } from './features/admin/AdminEmployeesPage';
import { AdminMenuPage } from './features/admin/AdminMenuPage';
import { AdminMenuEditorPage } from './features/admin/AdminMenuEditorPage';
import { AdminInventoryPage } from './features/admin/AdminInventoryPage';
import { AdminLoyaltyProgramPage } from './features/admin/AdminLoyaltyProgramPage';
import { AdminMarketingPage } from './features/admin/AdminMarketingPage';
import { AdminAuditPage } from './features/admin/AdminAuditPage';
import { AdminIntegrationsPage } from './features/admin/AdminIntegrationsPage';
import { AdminSettingsPage } from './features/admin/AdminSettingsPage';
import { AdminTableDemoPage } from './features/admin/AdminTableDemoPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/employee" replace />} />

          <Route element={<ProtectedRoute product="employee" allowAnonymous />}>
            <Route element={<EmployeeLayout />}>
              <Route path="/employee" element={<EmployeeWelcomePage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute product="admin" allowAnonymous />}>
            <Route element={<EmployeeLayout />}>
              <Route path="/admin/login" element={<AdminLoginPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute product="employee" />}>
            <Route element={<EmployeeLayout />}>
              <Route path="/employee/select-role" element={<RoleSelectPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute product="pos" />}>
            <Route element={<PosLayout />}>
              <Route path="/pos" element={<PosShellPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute product="admin" />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminOverviewPage />} />
              <Route path="/admin/reports/sales" element={<AdminSalesPerformancePage />} />
              <Route path="/admin/reports/transactions" element={<AdminTransactionsPage />} />
              <Route path="/admin/reports/members" element={<AdminMembersLoyaltyReportPage />} />
              <Route path="/admin/operations/branches" element={<AdminLocationsPage />} />
              <Route path="/admin/operations/terminals" element={<AdminTerminalsPage />} />
              <Route path="/admin/operations/shifts" element={<AdminShiftsPage />} />
              <Route path="/admin/operations/employees" element={<AdminEmployeesPage />} />
              <Route path="/admin/catalogue/menu" element={<AdminMenuPage />} />
              <Route path="/admin/catalogue/menu/:id" element={<AdminMenuEditorPage />} />
              <Route path="/admin/inventory/stock" element={<AdminInventoryPage />} />
              <Route path="/admin/rewards/loyalty" element={<AdminLoyaltyProgramPage />} />
              <Route path="/admin/rewards/campaigns" element={<AdminMarketingPage />} />
              <Route path="/admin/system/audit" element={<AdminAuditPage />} />
              <Route path="/admin/system/integrations" element={<AdminIntegrationsPage />} />
              <Route path="/admin/system/settings" element={<AdminSettingsPage />} />
              <Route path="/admin/preview/data-table" element={<AdminTableDemoPage />} />
            </Route>
          </Route>

          <Route path="/unauthorized" element={<UnauthorizedPage />} />
          <Route path="*" element={<Navigate to="/employee" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
