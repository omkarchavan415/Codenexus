import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { GuestOnly, RequireAdmin, RequireAuth, RequireGoal } from './components/Guards';
import { PageLoading } from './components/ui';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import TestSetup from './pages/TestSetup';
import TestRunner from './pages/TestRunner';
import TestResult from './pages/TestResult';
import Roadmap from './pages/Roadmap';
import Today from './pages/Today';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

// The admin panel is only needed by admins, so it loads on demand.
const Progress = lazy(() => import('./pages/Progress'));
const AdminOverview = lazy(() => import('./pages/admin/Overview'));
const AdminQuestions = lazy(() => import('./pages/admin/Questions'));
const AdminGenerator = lazy(() => import('./pages/admin/Generator'));
const AdminQuality = lazy(() => import('./pages/admin/Quality'));
const AdminCompanies = lazy(() => import('./pages/admin/Companies'));
const AdminProblems = lazy(() => import('./pages/admin/Problems'));
const AdminStudyItems = lazy(() => import('./pages/admin/StudyItems'));

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route element={<RequireGoal />}>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="test" element={<TestSetup />} />
              <Route path="test/:id" element={<TestRunner />} />
              <Route path="test/:id/result" element={<TestResult />} />
              <Route path="roadmap" element={<Roadmap />} />
              <Route path="today" element={<Today />} />
              <Route path="progress" element={<Progress />} />
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>

          <Route element={<RequireAdmin />}>
            <Route path="admin" element={<Layout admin />}>
              <Route index element={<AdminOverview />} />
              <Route path="questions" element={<AdminQuestions />} />
              <Route path="generator" element={<AdminGenerator />} />
              <Route path="quality" element={<AdminQuality />} />
              <Route path="companies" element={<AdminCompanies />} />
              <Route path="problems" element={<AdminProblems />} />
              <Route path="study-items" element={<AdminStudyItems />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
