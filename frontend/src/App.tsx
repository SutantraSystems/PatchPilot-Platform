import { Routes, Route, Navigate } from "react-router-dom";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ProtectedRoute from "@/components/ProtectedRoute";
import PatchPilotDashboard from "@/components/PatchPilotDashboard";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <PatchPilotDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
