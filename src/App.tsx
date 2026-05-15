import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { GamificationProvider } from './features/gamification/useGamification';

const HomeScreen = lazy(() => import('./app/home/HomeScreen'));
const ResultScreen = lazy(() => import('./app/result/ResultScreen'));
const LessonScreen = lazy(() => import('./app/lesson/LessonScreen'));
const GardenScreen = lazy(() => import('./app/garden/GardenScreen'));
const FamilyScreen = lazy(() => import('./app/family/FamilyScreen'));
const SettingsScreen = lazy(() => import('./app/settings/SettingsScreen'));

export default function App() {
  return (
    <GamificationProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/result" element={<ResultScreen />} />
              <Route path="/lesson" element={<LessonScreen />} />
              <Route path="/garden" element={<GardenScreen />} />
              <Route path="/family" element={<FamilyScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </GamificationProvider>
  );
}
