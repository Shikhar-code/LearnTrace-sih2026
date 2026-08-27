import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Student Routes Layout */}
        <Route element={<StudentLayout />}>
          <Route path="/" element={<Navigate to="/curriculum" replace />} />
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

        {/* Admin Routes Layout */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/ingest" replace />} />
          <Route path="ingest" element={<PdfIngestion />} />
          <Route path="catalogue" element={<DocumentCatalogue />} />
          <Route path="heatmap" element={<CohortHeatmap />} />
        </Route>

        {/* Fallback Catch-all Route */}
        <Route path="*" element={<Navigate to="/curriculum" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
