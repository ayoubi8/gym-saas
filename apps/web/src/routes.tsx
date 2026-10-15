import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/app-shell';
import { RequireAuth, RequireRole } from './features/auth/guards';
import { LoginPage } from './pages/login-page';
import { HomePage } from './pages/home-page';
import { AdminGymsPage } from './pages/admin-gyms-page';
import { OnboardingPage } from './pages/onboarding-page';
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
          { index: true, element: <HomePage /> },
          {
            element: <RequireRole roles={['owner']} />,
            children: [{ path: 'onboarding', element: <OnboardingPage /> }],
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
