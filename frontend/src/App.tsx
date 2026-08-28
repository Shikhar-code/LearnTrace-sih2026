import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { Login } from "./pages/Auth/Login";
import { Register } from "./pages/Auth/Register";
import { StudentLayout } from "./components/layout/StudentLayout";
import { AdminLayout } from "./components/layout/AdminLayout";
import { CurriculumExplorer } from "./pages/Curriculum/CurriculumExplorer";
import { QuizRunner } from "./pages/Assessment/QuizRunner";
import { MasteryDashboard } from "./pages/Mastery/MasteryDashboard";
import { KnowledgeGraphExplorer } from "./pages/KnowledgeGraph/KnowledgeGraphExplorer";
import { AiTutor } from "./pages/Tutor/AiTutor";
import { PdfIngestion } from "./pages/Ingestion/PdfIngestion";
import { DocumentCatalogue } from "./pages/Admin/DocumentCatalogue";
import { CohortHeatmap } from "./pages/Admin/CohortHeatmap";

// Dynamic root redirect based on authentication and active role
const RootRedirect: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return <Navigate to="/admin/heatmap" replace />;
  return <Navigate to="/curriculum" replace />;
};

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Root Redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Student Portal (STRICTLY Accessible by Students) */}
          <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
            <Route element={<StudentLayout />}>
              <Route path="/curriculum" element={<CurriculumExplorer />} />
              <Route path="/knowledge-graph" element={<KnowledgeGraphExplorer />} />
              <Route
                path="/graph"
                element={<Navigate to="/knowledge-graph" replace />}
              />
              <Route path="/quiz" element={<QuizRunner />} />
              <Route path="/mastery" element={<MasteryDashboard />} />
              <Route path="/tutor" element={<AiTutor />} />
            </Route>
          </Route>

          {/* Admin Portal (STRICTLY Accessible by Admins) */}
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/heatmap" replace />} />
              <Route path="ingest" element={<PdfIngestion />} />
              <Route path="catalogue" element={<DocumentCatalogue />} />
              <Route path="heatmap" element={<CohortHeatmap />} />
            </Route>
          </Route>

          {/* Fallback Catch-all Route */}
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
