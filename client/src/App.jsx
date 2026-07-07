import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./components/ui/Toast";
import { RequireAdmin } from "./components/Guards";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import AdminPanel from "./pages/AdminPanel";
import RoomChat from "./pages/RoomChat";
import NotFound from "./pages/NotFound";

export default function App() {
  const RootLayout = () => (
    <AuthProvider>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </AuthProvider>
  );

  const router = createBrowserRouter(
    [
      {
        element: <RootLayout />,
        children: [
          { path: "/", element: <Landing /> },
          { path: "/login", element: <Auth /> },
          { path: "/register", element: <Auth /> },
          { path: "/auth/callback", element: <AuthCallback /> },
          { path: "/room/:slug", element: <RoomChat /> },
          {
            path: "/admin",
            element: (
              <RequireAdmin>
                <AdminPanel />
              </RequireAdmin>
            ),
          },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
    {
      future: {
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      },
    }
  );

  return <RouterProvider router={router} />;
}
