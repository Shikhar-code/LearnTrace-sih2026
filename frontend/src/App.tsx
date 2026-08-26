import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StudentLayout } from './components/layout/StudentLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { CurriculumExplorer } from './pages/Curriculum/CurriculumExplorer';
import { QuizRunner } from './pages/Assessment/QuizRunner';
import { MasteryDashboard } from './pages/Mastery/MasteryDashboard';
import { PdfIngestion } from './pages/Ingestion/PdfIngestion';
import { DocumentCatalogue } from './pages/Admin/DocumentCatalogue';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Student Routes Layout */}
        <Route element={<StudentLayout />}>
          <Route path="/" element={<Navigate to="/curriculum" replace />} />
          <Route path="/curriculum" element={<CurriculumExplorer />} />
          <Route path="/quiz" element={<QuizRunner />} />
          <Route path="/mastery" element={<MasteryDashboard />} />
        </Route>

        {/* Admin Routes Layout */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/ingest" replace />} />
          <Route path="ingest" element={<PdfIngestion />} />
          <Route path="catalogue" element={<DocumentCatalogue />} />
        </Route>

        {/* Fallback Catch-all Route */}
        <Route path="*" element={<Navigate to="/curriculum" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
