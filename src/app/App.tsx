import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { AuthorizationProvider } from './context/AuthorizationContext';
import { CompanyProvider } from './context/CompanyContext';
import { Toaster } from 'sonner';

function App() {
  return (
    <AuthProvider>
      <AuthorizationProvider>
        <CompanyProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" richColors closeButton />
        </CompanyProvider>
      </AuthorizationProvider>
    </AuthProvider>
  );
}

export default App;
