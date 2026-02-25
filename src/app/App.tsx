import { RouterProvider } from 'react-router';
import { router } from './routes';
import { AuthProvider } from './context/AuthContext';
import { CompanyProvider } from './context/CompanyContext';

function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <RouterProvider router={router} />
      </CompanyProvider>
    </AuthProvider>
  );
}

export default App;
