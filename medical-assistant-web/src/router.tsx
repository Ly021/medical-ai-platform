import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import Home from '@/pages/Home';
import Report from '@/pages/Report';
import HealthQA from '@/pages/HealthQA';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'report', element: <Report /> },
      { path: 'health-qa', element: <HealthQA /> },
    ],
  },
]);

export default router;
