import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/app-shell';
import { RequireAuth, RequireRole } from './features/auth/guards';
import { LoginPage } from './pages/login-page';
import { DashboardPage } from './pages/dashboard-page';
import { AdminGymsPage } from './pages/admin-gyms-page';
import { OnboardingPage } from './pages/onboarding-page';
import { MembersListPage } from './pages/members-list-page';
import { MemberFormPage } from './pages/member-form-page';
import { MemberProfilePage } from './pages/member-profile-page';
import { PlansPage } from './pages/plans-page';
import { PaymentsListPage } from './pages/payments-list-page';
import { ReceiptPage } from './pages/receipt-page';
import { ImportPage } from './pages/import-page';
import { NotFoundPage } from './pages/not-found-page';

// Routes mirror docs/SCREENS.md. Phase 1B lands login + the guarded shell;
// later phases add their own rows (members, plans, payments, dashboard…).
export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          {
            element: <RequireRole roles={['owner']} />,
            children: [
              { path: 'onboarding', element: <OnboardingPage /> },
              { path: 'members', element: <MembersListPage /> },
              { path: 'members/new', element: <MemberFormPage /> },
              { path: 'members/:id', element: <MemberProfilePage /> },
              { path: 'members/:id/edit', element: <MemberFormPage /> },
              { path: 'plans', element: <PlansPage /> },
              { path: 'payments', element: <PaymentsListPage /> },
              { path: 'payments/:id/receipt', element: <ReceiptPage /> },
              { path: 'import', element: <ImportPage /> },
            ],
          },
          {
            element: <RequireRole roles={['admin']} />,
            children: [{ path: 'admin/gyms', element: <AdminGymsPage /> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
