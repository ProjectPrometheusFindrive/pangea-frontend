import { createBrowserRouter } from "react-router";
import Home from "./pages/Home";
import ActionRequired from "./pages/ActionRequired";
import Assets from "./pages/Assets";
import Reservations from "./pages/Reservations";
import Revenue from "./pages/Revenue";
import Settings from "./pages/Settings";
import DeviceInstallation from "./pages/DeviceInstallation";
import Login from "./pages/Login";
import { AuthRequiredRoute } from "./components/AuthRequiredRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    Component: AuthRequiredRoute,
    children: [
      {
        path: "/",
        Component: Home,
      },
      {
        path: "/action-required",
        Component: ActionRequired,
      },
      {
        path: "/assets",
        Component: Assets,
      },
      {
        path: "/reservations",
        Component: Reservations,
      },
      {
        path: "/revenue",
        Component: Revenue,
      },
      {
        path: "/settings",
        Component: Settings,
      },
      {
        path: "/device-installation",
        Component: DeviceInstallation,
      },
    ],
  },
]);
