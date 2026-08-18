import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth, useRole } from './lib/auth';
import { canAccessPage, navFor } from './lib/roles';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InstitutionsPage from './pages/InstitutionsPage';
import StudentsPage from './pages/StudentsPage';
import GuardiansPage from './pages/GuardiansPage';
import ClassesPage from './pages/ClassesPage';
import StatusPage from './pages/StatusPage';
import AuditPage from './pages/AuditPage';
import MenuPage from './pages/MenuPage';
import TodayPage from './pages/TodayPage';
import UsersPage from './pages/UsersPage';
import ParentPage from './pages/ParentPage';
import KitchenPage from './pages/KitchenPage';
import DeliveriesPage from './pages/DeliveriesPage';
import ReportsPage from './pages/ReportsPage';
import OpsPage from './pages/OpsPage';
import AbsencesPage from './pages/AbsencesPage';

function Guard({ page, children }: { page: string; children: ReactNode }) {
  const { session } = useAuth();
  const role = useRole();

  if (!session) return <Navigate to="/login" replace />;
  if (role && !canAccessPage(role, page)) {
    return <Navigate to={`/${navFor(role)[0]?.page ?? 'parent'}`} replace />;
  }
  return <>{children}</>;
}

function Home() {
  const { session } = useAuth();
  const role = useRole();
  if (!session) return <Navigate to="/login" replace />;
  const first = navFor(role ?? 'parent')[0]?.page ?? 'parent';
  return <Navigate to={`/${first}`} replace />;
}

function Page({ page, children }: { page: string; children: ReactNode }) {
  return <Guard page={page}>{children}</Guard>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route index element={<Home />} />
          <Route element={<Layout />}>
            <Route
              path="/dashboard"
              element={
                <Page page="dashboard">
                  <DashboardPage />
                </Page>
              }
            />
            <Route
              path="/institutions"
              element={
                <Page page="institutions">
                  <InstitutionsPage />
                </Page>
              }
            />
            <Route
              path="/users"
              element={
                <Page page="users">
                  <UsersPage />
                </Page>
              }
            />
            <Route
              path="/students"
              element={
                <Page page="students">
                  <StudentsPage />
                </Page>
              }
            />
            <Route
              path="/guardians"
              element={
                <Page page="guardians">
                  <GuardiansPage />
                </Page>
              }
            />
            <Route
              path="/classes"
              element={
                <Page page="classes">
                  <ClassesPage />
                </Page>
              }
            />
            <Route
              path="/status"
              element={
                <Page page="status">
                  <StatusPage />
                </Page>
              }
            />
            <Route
              path="/audit"
              element={
                <Page page="audit">
                  <AuditPage />
                </Page>
              }
            />
            <Route
              path="/menu"
              element={
                <Page page="menu">
                  <MenuPage />
                </Page>
              }
            />
            <Route
              path="/today"
              element={
                <Page page="today">
                  <TodayPage />
                </Page>
              }
            />
            <Route
              path="/kitchen"
              element={
                <Page page="kitchen">
                  <KitchenPage />
                </Page>
              }
            />
            <Route
              path="/deliveries"
              element={
                <Page page="deliveries">
                  <DeliveriesPage />
                </Page>
              }
            />
            <Route
              path="/reports"
              element={
                <Page page="reports">
                  <ReportsPage />
                </Page>
              }
            />
            <Route
              path="/ops"
              element={
                <Page page="ops">
                  <OpsPage />
                </Page>
              }
            />
            <Route
              path="/absences"
              element={
                <Page page="absences">
                  <AbsencesPage />
                </Page>
              }
            />
            <Route
              path="/parent"
              element={
                <Page page="parent">
                  <ParentPage />
                </Page>
              }
            />
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
