import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';
import { Toaster } from 'sonner';

function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors closeButton />
      </CompanyProvider>
    </AuthProvider>
  );
}

export default App;
