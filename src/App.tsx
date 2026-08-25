import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth, useRole } from './lib/auth';
import { canAccessPage, navFor, navPath } from './lib/roles';
import type { AppRole } from './lib/types';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import NoAccessPage from './pages/NoAccessPage';
import AccountPage from './pages/AccountPage';
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
// ---- operational spine
import MealPlansPage from './pages/MealPlansPage';
import DietaryPage from './pages/DietaryPage';
import OperationsPage from './pages/OperationsPage';
import DeliverySetupPage from './pages/DeliverySetupPage';
import DriverPage from './pages/DriverPage';
import HandoverPage from './pages/HandoverPage';

/**
 * Where a role belongs when it has nowhere specific to be.
 *
 * Uses navPath() rather than `.page`, because a nav entry may route to a URL
 * that differs from its RBAC resource id — `menubuilder` serves at
 * `/menu-builder`. Redirecting to the resource id would land on a route the
 * router never declares.
 */
function firstPageFor(role: AppRole): string {
  const first = navFor(role)[0];
  return first ? navPath(first) : 'parent';
}

function Guard({ page, children }: { page: string; children: ReactNode }) {
  const { session, loading, profileLoading } = useAuth();
  const role = useRole();

  // Decide nothing until the role is actually known. Rendering the page while
  // the role is still null showed protected screens for a moment to whoever was
  // signing in; RLS meant they held no data, but they were on screen.
  if (loading || profileLoading) return null;
  if (!session) return <Navigate to="/login" replace />;
  // A settled session with NO profile is a deactivated or unprovisioned
  // account (§9). The database already refuses it everything; this is the
  // application boundary saying so instead of rendering an empty product.
  if (!role) return <NoAccessPage />;
  if (!canAccessPage(role, page)) {
    return <Navigate to={`/${firstPageFor(role)}`} replace />;
  }
  return <>{children}</>;
}

function Home() {
  const { session, loading, profileLoading } = useAuth();
  const role = useRole();

  // WAIT for the role. This previously read `navFor(role ?? 'parent')`, which
  // treated "not loaded yet" as "is a parent" — and `loading` was already false
  // by then, because it only ever covered getSession(), never the profile
  // fetch. So every sign-in was redirected to /parent before the real role
  // arrived.
  //
  // Most roles recovered by accident: Guard bounced them off /parent because
  // they cannot view it. A SUPER ADMIN did not, because canAccessPage(
  // 'super_admin', 'parent') is deliberately true — the matrix decides what is
  // reachable, and a Super Admin may reach everything. So signing in as Super
  // Admin landed in the Parent portal and stayed there, instead of the Command
  // Center. Everyone else took a pointless detour through /parent first.
  if (loading || profileLoading) return null;
  if (!session) return <Navigate to="/login" replace />;

  // A session with no app_users row means the account cannot act: either it
  // was deactivated (migration 0044 hides an inactive account's own row from
  // itself, because every identity helper requires `active`) or it was never
  // provisioned. Sending it to /parent showed an empty Parent portal to people
  // who are not parents. Say what is actually true instead.
  if (!role) return <NoAccessPage />;
  return <Navigate to={`/${firstPageFor(role)}`} replace />;
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
              path="/account"
              element={
                <Page page="account">
                  <AccountPage />
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
            {/* Operational spine. Each path matches its NavItem `path` (or its
                resource id where they are the same), because a sidebar link
                that points at a route App.tsx never declares is a dead link —
                the catch-all silently bounces it to the dashboard. */}
            <Route
              path="/meal-plans"
              element={
                <Page page="mealplans">
                  <MealPlansPage />
                </Page>
              }
            />
            <Route
              path="/dietary"
              element={
                <Page page="dietary">
                  <DietaryPage />
                </Page>
              }
            />
            <Route
              path="/operations"
              element={
                <Page page="operations">
                  <OperationsPage />
                </Page>
              }
            />
            <Route
              path="/delivery"
              element={
                <Page page="delivery">
                  <DeliverySetupPage />
                </Page>
              }
            />
            <Route
              path="/my-deliveries"
              element={
                <Page page="mydeliveries">
                  <DriverPage />
                </Page>
              }
            />
            <Route
              path="/handover"
              element={
                <Page page="handover">
                  <HandoverPage />
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
