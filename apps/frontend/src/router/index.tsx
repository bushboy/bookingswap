import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import {
  ProtectedRoute,
  LoginForm,
  RegisterForm,
  PasswordResetRequest,
  PasswordReset,
} from '@/components/auth';
import { BookingsPage } from '@/pages/BookingsPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
// Lazy-loaded components for performance optimization
import {
  BookingSwapSpecificationPageWithLoading,
  BrowsePageWithLoading,
  SwapsPageWithLoading,
  DashboardPageWithLoading,
  ProfilePageWithLoading,
  AdminPageWithLoading,
  intelligentPreload,
} from './lazyComponents';

const router = createBrowserRouter([
  // Public routes - accessible to all users
  {
    path: '/',
    element: <Layout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <BrowsePageWithLoading />, // New default - Browse Page without authentication
      },
      {
        path: 'browse',
        element: <BrowsePageWithLoading />,
      },
    ],
  },
  // Authentication routes - public
  {
    path: '/login',
    element: <LoginForm />,
  },
  {
    path: '/register',
    element: <RegisterForm />,
  },
  {
    path: '/auth/forgot-password',
    element: <PasswordResetRequest />,
  },
  {
    path: '/auth/reset-password',
    element: <PasswordReset />,
  },
  // Protected routes - authentication required
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'bookings',
        element: <BookingsPage />,
      },
      {
        path: 'bookings/new',
        element: <BookingsPage />,
      },
      {
        path: 'bookings/:id',
        element: <BookingsPage />,
      },
      {
        path: 'bookings/:id/edit',
        element: <BookingsPage />,
      },
      {
        path: 'bookings/:bookingId/swap-specification',
        element: <BookingSwapSpecificationPageWithLoading />,
        loader: () => {
          // Trigger intelligent preloading when navigating to swap specification
          intelligentPreload.onSwapButtonHover();
          return null;
        },
      },
      {
        path: 'swaps',
        element: <SwapsPageWithLoading />,
      },
      {
        path: 'swaps/:id',
        element: <SwapsPageWithLoading />,
      },
      {
        path: 'dashboard',
        element: <DashboardPageWithLoading />,
      },
      {
        path: 'profile',
        element: <ProfilePageWithLoading />,
      },
      {
        path: 'admin',
        element: <AdminPageWithLoading />,
      },
    ],
  },
]);

export const AppRouter = () => (
  <RouterProvider router={router} future={{ v7_startTransition: true }} />
);
