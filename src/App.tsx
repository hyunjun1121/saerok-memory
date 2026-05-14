import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';

const HomeScreen = React.lazy(() => import('./app/home/HomeScreen'));
const ResultScreen = React.lazy(() => import('./app/result/ResultScreen'));
const LessonScreen = React.lazy(() => import('./app/lesson/LessonScreen'));
const GardenScreen = React.lazy(() => import('./app/garden/GardenScreen'));
const SettingsScreen = React.lazy(() => import('./app/settings/SettingsScreen'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/result" element={<ResultScreen />} />
            <Route path="/lesson" element={<LessonScreen />} />
            <Route path="/garden" element={<GardenScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
