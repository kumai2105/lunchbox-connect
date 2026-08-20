import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth, useRole } from './lib/auth';
import { canAccessPage, navFor } from './lib/roles';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InstitutionsPage from './pages/InstitutionsPage';
import InstitutionDetailPage from './pages/InstitutionDetailPage';
import StudentsPage from './pages/StudentsPage';
import StudentProfilePage from './pages/StudentProfilePage';
import GuardiansPage from './pages/GuardiansPage';
import InstitutionSchedulePage from './pages/InstitutionSchedulePage';
import ClassesPage from './pages/ClassesPage';
import StatusPage from './pages/StatusPage';
import AuditPage from './pages/AuditPage';
import MealLibraryPage from './pages/MealLibraryPage';
import MenuBuilderPage from './pages/MenuBuilderPage';
import StaffPage from './pages/StaffPage';
import MealAnalyticsPage from './pages/MealAnalyticsPage';
import ReviewPage from './pages/ReviewPage';
import TodayPage from './pages/TodayPage';
import UsersPage from './pages/UsersPage';
import ParentShell from './pages/parent/ParentShell';
import ParentHome from './pages/parent/ParentHome';
import ParentMenu from './pages/parent/ParentMenu';
import ParentInsights from './pages/parent/ParentInsights';
import ParentProfile from './pages/parent/ParentProfile';
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
              path="/institutions/:id"
              element={
                <Page page="institutions">
                  <InstitutionDetailPage />
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
              path="/students/:id"
              element={
                <Page page="students">
                  <StudentProfilePage />
                </Page>
              }
            />
            <Route
              path="/schedule"
              element={
                <Page page="schedule">
                  <InstitutionSchedulePage />
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
              path="/staff"
              element={
                <Page page="staff">
                  <StaffPage />
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
              path="/meals"
              element={
                <Page page="meals">
                  <MealLibraryPage />
                </Page>
              }
            />
            <Route
              path="/menu-builder"
              element={
                <Page page="menubuilder">
                  <MenuBuilderPage />
                </Page>
              }
            />
            <Route
              path="/analytics"
              element={
                <Page page="analytics">
                  <MealAnalyticsPage />
                </Page>
              }
            />
            <Route
              path="/review"
              element={
                <Page page="review">
                  <ReviewPage />
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
                  <ParentShell />
                </Page>
              }
            >
              <Route index element={<ParentHome />} />
              <Route path="menu" element={<ParentMenu />} />
              <Route path="insights" element={<ParentInsights />} />
              <Route path="profile" element={<ParentProfile />} />
            </Route>
          </Route>
          <Route path="*" element={<Home />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
