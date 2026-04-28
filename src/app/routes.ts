import { createBrowserRouter } from 'react-router';
import { createElement } from 'react';

import { RequireAuth } from './components/RequireAuth';
import ActionRequired from './pages/ActionRequired';
import Assets from './pages/Assets';
import DeviceInstallation from './pages/DeviceInstallation';
import DemoSimulationAdmin from './pages/DemoSimulationAdmin';
import Forbidden from './pages/Forbidden';
import Home from './pages/Home';
import Login from './pages/Login';
import Notifications from './pages/Notifications';
import Reservations from './pages/Reservations';
import Revenue from './pages/Revenue';
import Settings from './pages/Settings';
import SignUp from './pages/SignUp';
import SupportCenter from './pages/SupportCenter';
import TermsAgreement from './pages/TermsAgreement';

function RequireAuthenticatedRoute() {
  return createElement(RequireAuth);
}

function RequireRentalBusinessRoute() {
  return createElement(RequireAuth, { allowedRoles: ['rental-business'] });
}

function RequireDeviceInstallerRoute() {
  return createElement(RequireAuth, { allowedRoles: ['device-installer'] });
}

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/terms',
    Component: TermsAgreement,
  },
  {
    path: '/signup',
    Component: SignUp,
  },
  {
    path: '/forbidden',
    Component: Forbidden,
  },
  {
    Component: RequireAuthenticatedRoute,
    children: [
      {
        Component: RequireRentalBusinessRoute,
        children: [
          {
            path: '/',
            Component: Home,
          },
          {
            path: '/action-required',
            Component: ActionRequired,
          },
          {
            path: '/assets',
            Component: Assets,
          },
          {
            path: '/reservations',
            Component: Reservations,
          },
          {
            path: '/revenue',
            Component: Revenue,
          },
          {
            path: '/notifications',
            Component: Notifications,
          },
          {
            path: '/settings',
            Component: Settings,
          },
          {
            path: '/support-center',
            Component: SupportCenter,
          },
          {
            path: '/admin/demo-simulation',
            Component: DemoSimulationAdmin,
          },
        ],
      },
      {
        Component: RequireDeviceInstallerRoute,
        children: [
          {
            path: '/device-installation',
            Component: DeviceInstallation,
          },
        ],
      },
    ],
  },
]);
