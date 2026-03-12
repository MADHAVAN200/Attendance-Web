import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import ErrorBoundary from "./ErrorBoundary";

import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import ProtectedRoute from "./context/protection";
import PublicRoute from "./context/publicRoute";
import Unauthorized from "./pages/Unauthorized";
import TestRoute from "./context/TestRoute";
import Login from "./pages/user-auth/Login";
import ForgotPassword from "./pages/user-auth/ForgotPassword";
import SuperAdminLogin from "./pages/user-auth/SuperAdminLogin";
import WordCaptchaTest from "./pages/test/WordCaptchaTest"; // only for testing

import AdminDashboard from "./pages/dashboard/AdminDashboard"
import Attendance from "./pages/attendance/Attendance"
import EmployeeList from "./pages/employees/EmployeeList"
import EmployeeForm from "./pages/employees/EmployeeForm"
import BulkUpload from "./pages/employees/BulkUpload"
import AttendanceMonitoring from "./pages/attendance-monitoring/AttendanceMonitoring"
import Reports from "./pages/reports/Reports"
import HolidayManagement from "./pages/holidays/HolidayManagement"
import BulkHolidayImport from "./pages/holidays/BulkHolidayImport"
import PolicyBuilder from "./pages/policy-builder/PolicyBuilder"
import GeoFencing from "./pages/geofencing/GeoFencing"
import Profile from "./pages/profile/Profile"
import Subscription from "./pages/subscription/Subscription"
import TestAPI from "./pages/test/TestAPI"
import VisualScripting from "./pages/test/VisualScripting"
import DailyActivity from "./pages/dar/DailyActivity"
import DARAdmin from "./pages/dar/DARAdmin"
import LeaveApplication from "./pages/holidays/LeaveApplication"
import OrganizationList from "./pages/organizations/OrganizationList"
import SecurityAlerts from "./pages/super-admin/SecurityAlerts"
import UserFeedback from "./pages/super-admin/UserFeedback"
import SystemLogs from "./pages/super-admin/SystemLogs"

import SuperAdminDashboard from "./pages/dashboard/SuperAdminDashboard";
import EmployeeDashboard from "./pages/dashboard/EmployeeDashboard";
import { useAuth } from "./context/AuthContext";
import ShowcaseNavbar from "./showcase/components/Navbar";
import ShowcaseFooter from "./showcase/components/Footer";
import ShowcaseMobileNavbar from "./showcase/components/MobileNavbar";
import ShowcaseMobileFooter from "./showcase/components/MobileFooter";
import ShowcaseTabletNavbar from "./showcase/components/TabletNavbar";
import ShowcaseTabletFooter from "./showcase/components/TabletFooter";
import ShowcaseHomePage from "./showcase/pages/HomePage";
import ShowcaseMobileHomePage from "./showcase/pages/MobileHomePage";
import ShowcaseTabletHomePage from "./showcase/pages/TabletHomePage";
import useDeviceType from "./showcase/hooks/useDeviceType";
import "./showcase/showcase.css";

// Component to handle role-based dashboard view
const DashboardHandler = () => {
  const { user } = useAuth();
  if (user?.user_type === 'employee') {
    return <EmployeeDashboard />;
  }
  if (user?.user_type === 'super_admin') {
    return <SuperAdminDashboard />;
  }
  return <AdminDashboard />;
};

function ShowcaseScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pathname]);

  return null;
}

const ShowcaseShell = ({ children }) => {
  const { device } = useDeviceType();
  const NavComp = device === "mobile" ? ShowcaseMobileNavbar : device === "tablet" ? ShowcaseTabletNavbar : ShowcaseNavbar;
  const FootComp = device === "mobile" ? ShowcaseMobileFooter : device === "tablet" ? ShowcaseTabletFooter : ShowcaseFooter;

  return (
    <div className="showcase-root site-bg">
      <ShowcaseScrollToTop />
      <NavComp />
      <main>{children}</main>
      <FootComp />
    </div>
  );
};

const RootHandler = () => {
  const { user, authChecked } = useAuth();
  const { device } = useDeviceType();

  if (!authChecked) {
    return null;
  }

  if (!user) {
    const PageComp = device === "mobile" ? ShowcaseMobileHomePage : device === "tablet" ? ShowcaseTabletHomePage : ShowcaseHomePage;
    return (
      <ShowcaseShell>
        <PageComp />
      </ShowcaseShell>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["admin", "hr", "employee"]}>
      <DashboardHandler />
    </ProtectedRoute>
  );
};

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ToastContainer position="top-right" autoClose={3000} />
        <Routes>

          {/* Website Landing (shown first when not logged in) */}
          <Route path="/" element={<RootHandler />} />
          <Route path="/get-started" element={<Navigate to="/login" replace />} />

          {/* Public Route: Login */}
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/org-login" element={<SuperAdminLogin />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>

            {/* Test Routes - Only available in Development */}
            <Route element={<TestRoute />}>
              <Route path="/word-captcha-test" element={<WordCaptchaTest />} />
              <Route path="/test-api" element={<TestAPI />} />
              <Route path="/visual-scripting" element={<VisualScripting />} />
            </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/unauthorized" element={<Unauthorized />} />
            {/* Common Routes (Accessible by all authenticated users: Admin, HR, Employee) */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'hr', 'employee', 'super_admin']} />}>
              <Route path="/" element={<DashboardHandler />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/holidays" element={<HolidayManagement />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/daily-activity" element={<DailyActivity />} />
              <Route path="/apply-leave" element={<LeaveApplication />} />
            </Route>

            {/* Admin & HR Only Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'hr']} />}>
              <Route path="/attendance-monitoring" element={<AttendanceMonitoring />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/policy-builder" element={<PolicyBuilder />} />
              <Route path="/geofencing" element={<GeoFencing />} />
              <Route path="/employees" element={<EmployeeList />} />
              <Route path="/employees/add" element={<EmployeeForm />} />
              <Route path="/employees/edit/:id" element={<EmployeeForm />} />
              <Route path="/employees/bulk" element={<BulkUpload />} />
              <Route path="/holidays/bulk" element={<BulkHolidayImport />} />
            </Route>

            {/* Admin Only Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/dar-admin" element={<DARAdmin />} />
            </Route>

            {/* Super Admin Only Routes */}
            <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
              <Route path="/organizations" element={<OrganizationList />} />
              <Route path="/super-admin/alerts" element={<SecurityAlerts />} />
              <Route path="/super-admin/feedback" element={<UserFeedback />} />
              <Route path="/super-admin/logs" element={<SystemLogs />} />
            </Route>
          </Route>

          </Routes>
      </NotificationProvider>
    </AuthProvider>
  )
}

export default App
