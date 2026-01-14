import { Navigate, Outlet } from "react-router-dom";
import { toast } from "react-toastify";

const TestRoute = () => {
    const isDev = import.meta.env.VITE_ENV === 'development';

    if (!isDev) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default TestRoute;
