import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Landing from "@/pages/Landing";
import AuthPage from "@/pages/AuthPage";
import PatientDashboard from "@/pages/PatientDashboard";
import DoctorDashboard from "@/pages/DoctorDashboard";
import StaffDashboard from "@/pages/StaffDashboard";
import { FullLoader } from "@/components/Logo";

export const homeFor = (role) => ({ doctor: "/doctor", staff: "/staff", patient: "/patient" }[role] || "/");

const Protected = ({ role, children }) => {
  const { user } = useAuth();
  if (user === null) return <FullLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
};

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/patient" element={<Protected role="patient"><PatientDashboard /></Protected>} />
            <Route path="/doctor" element={<Protected role="doctor"><DoctorDashboard /></Protected>} />
            <Route path="/staff" element={<Protected role="staff"><StaffDashboard /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors closeButton />
      </AuthProvider>
    </div>
  );
}

export default App;
