import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import MobileNavbar from "./components/MobileNavbar";
import MobileFooter from "./components/MobileFooter";
import HomePage from "./pages/HomePage";
import MobileHomePage from "./pages/MobileHomePage";
import GenericPage from "./pages/GenericPage";
import useOrientation from "./hooks/useOrientation";

function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [pathname]);

    return null;
}

export default function App() {
    const isPortrait = useOrientation();
    const ActiveNavbar = isPortrait ? MobileNavbar : Navbar;
    const ActiveFooter = isPortrait ? MobileFooter : Footer;

    return (
        <div className="site-bg">
            <ScrollToTop />
            <ActiveNavbar />

            <main>
                <Routes>
                    <Route path="/" element={isPortrait ? <MobileHomePage /> : <HomePage />} />

                    <Route path="/product/overview" element={<GenericPage />} />
                    <Route path="/product/attendance-tracking" element={<GenericPage />} />
                    <Route path="/product/leave-management" element={<GenericPage />} />
                    <Route path="/product/workforce-analytics" element={<GenericPage />} />
                    <Route path="/product/policy-geofencing" element={<GenericPage />} />
                    <Route path="/product/reports-automation" element={<GenericPage />} />

                    <Route path="/solutions/hr-teams" element={<GenericPage />} />
                    <Route path="/solutions/managers" element={<GenericPage />} />
                    <Route path="/solutions/enterprises" element={<GenericPage />} />
                    <Route path="/solutions/remote-teams" element={<GenericPage />} />

                    <Route path="/features/smart-attendance" element={<GenericPage />} />
                    <Route path="/features/face-camera-verification" element={<GenericPage />} />
                    <Route path="/features/geofencing-location-tracking" element={<GenericPage />} />
                    <Route path="/features/correction-approval-workflows" element={<GenericPage />} />
                    <Route path="/features/daily-activity-reports" element={<GenericPage />} />
                    <Route path="/features/employee-management" element={<GenericPage />} />
                    <Route path="/features/payroll-ready-reports" element={<GenericPage />} />
                    <Route path="/features/real-time-notifications" element={<GenericPage />} />

                    <Route path="/pricing" element={<GenericPage />} />
                    <Route path="/security" element={<GenericPage />} />

                    <Route path="/resources/documentation" element={<GenericPage />} />
                    <Route path="/resources/blog" element={<GenericPage />} />
                    <Route path="/resources/faqs" element={<GenericPage />} />

                    <Route path="/company/about" element={<GenericPage />} />
                    <Route path="/company/contact" element={<GenericPage />} />

                    <Route path="/login" element={<GenericPage />} />
                    <Route path="/get-started" element={<GenericPage />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>

            <Footer />
        </div>
    );
}
