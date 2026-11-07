import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import { AdminLayout } from './layouts/AdminLayout';
import { AdminLogin } from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminPayments from './pages/AdminPayments';
import AdminPlans from './pages/AdminPlans';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminFeatureSupport from './pages/AdminFeatureSupport';
import AdminMessages from './pages/AdminMessages';
import AdminInvoiceCredits from './pages/AdminInvoiceCredits';
import AdminProfile from './pages/AdminProfile';
import { Loader2 } from 'lucide-react';

const ProtectedAdminRoute: React.FC = () => {
  const { currentUser, isAdmin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950">
        <Loader2 className="animate-spin text-cyan-400" size={40} />
      </div>
    );
  }

  if (!currentUser || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <AdminLayout />;
};

export const App: React.FC = () => {
  return (
    <AdminAuthProvider>
      <HashRouter>
        <Routes>
          {/* Public Authentication Gate */}
          <Route path="/login" element={<AdminLogin />} />

          {/* Protected Super Admin Console */}
          <Route element={<ProtectedAdminRoute />}>
            <Route path="/dashboard" element={<AdminDashboard />} />
            <Route path="/users" element={<AdminUsers />} />
            <Route path="/payments" element={<AdminPayments />} />
            <Route path="/plans" element={<AdminPlans />} />
            <Route path="/analytics" element={<AdminAnalytics />} />
            <Route path="/feature-support" element={<AdminFeatureSupport />} />
            <Route path="/messages" element={<AdminMessages />} />
            <Route path="/invoice-credits" element={<AdminInvoiceCredits />} />
            <Route path="/profile" element={<AdminProfile />} />
            <Route index element={<Navigate to="/dashboard" replace />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </HashRouter>
    </AdminAuthProvider>
  );
};

export default App;
