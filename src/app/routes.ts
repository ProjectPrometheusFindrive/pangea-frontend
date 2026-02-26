import { createBrowserRouter } from 'react-router';
import { createElement } from 'react';

import { RequireAuth } from './components/RequireAuth';
import ActionRequired from './pages/ActionRequired';
import Assets from './pages/Assets';
import DeviceInstallation from './pages/DeviceInstallation';
import Forbidden from './pages/Forbidden';
import Home from './pages/Home';
import Login from './pages/Login';
import Reservations from './pages/Reservations';
import Revenue from './pages/Revenue';
import Settings from './pages/Settings';
import SupportCenter from './pages/SupportCenter';

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
            path: '/settings',
            Component: Settings,
          },
          {
            path: '/support-center',
            Component: SupportCenter,
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
