import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DeveloperProvider, useDeveloper } from './contexts/DeveloperContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { DataProvider } from './contexts/DataContext';

// 路由級 code-splitting：各頁按需載入，three.js / recharts 等重依賴只在進入該頁時下載，
// 大幅縮小首屏（登入/介紹頁）的初始 bundle。
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })));
const Landing = lazy(() => import('./pages/Landing').then(m => ({ default: m.Landing })));
const RealtimeMonitoring = lazy(() => import('./pages/RealtimeMonitoring').then(m => ({ default: m.RealtimeMonitoring })));
const HealthReports = lazy(() => import('./pages/HealthReports').then(m => ({ default: m.HealthReports })));
const DeviceManagement = lazy(() => import('./pages/DeviceManagement').then(m => ({ default: m.DeviceManagement })));
const AlertNotifications = lazy(() => import('./pages/AlertNotifications').then(m => ({ default: m.AlertNotifications })));
const SystemSettings = lazy(() => import('./pages/SystemSettings').then(m => ({ default: m.SystemSettings })));
const PersonnelManagement = lazy(() => import('./pages/PersonnelManagement').then(m => ({ default: m.PersonnelManagement })));
const CareRecipients = lazy(() => import('./pages/CareRecipients').then(m => ({ default: m.CareRecipients })));
const DailyHealth = lazy(() => import('./pages/DailyHealth').then(m => ({ default: m.DailyHealth })));
const RoutineCheckup = lazy(() => import('./pages/RoutineCheckup').then(m => ({ default: m.RoutineCheckup })));
const FamilyHealthLog = lazy(() => import('./pages/FamilyHealthLog').then(m => ({ default: m.FamilyHealthLog })));
const RoomOccupancy = lazy(() => import('./pages/RoomOccupancy').then(m => ({ default: m.RoomOccupancy })));
const MonitorOverview = lazy(() => import('./pages/MonitorOverview').then(m => ({ default: m.MonitorOverview })));
const Analytics = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));
const CareInsights = lazy(() => import('./pages/CareInsights').then(m => ({ default: m.CareInsights })));
const AccountManagement = lazy(() => import('./pages/AccountManagement').then(m => ({ default: m.AccountManagement })));

/** 路由切換時的載入指示（lazy chunk 下載期間顯示）。 */
function RouteFallback() {
  return (
    <div className="min-h-[50vh] w-full flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function DevBackdoor() {
  const { isDeveloperMode, setManualState } = useDeveloper();
  if (!import.meta.env.DEV || !isDeveloperMode) return null;

  return (
    <>
      <button
        onClick={() => setManualState('safe')}
        className="fixed top-0 left-0 w-16 h-16 z-[9999] opacity-0 cursor-default"
        title="Set Safe State"
      />
      <button
        onClick={() => setManualState('fall')}
        className="fixed top-0 right-0 w-16 h-16 z-[9999] opacity-0 cursor-default"
        title="Set Fall State"
      />
    </>
  );
}

function AppRoutes() {
  const { user } = useUser();

  return (
    <Routes>
      {/* 公開頁面 */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* 已登入才顯示的受保護頁面（無 path 的 Layout 包裹，子路由解析為 /realtime…） */}
      {user ? (
        <Route element={<Layout><DevBackdoor /></Layout>}>
          <Route path="device" element={<DeviceManagement />} />
          <Route path="personnel" element={<PersonnelManagement />} />
          <Route path="realtime" element={<RealtimeMonitoring />} />
          <Route path="alerts" element={<AlertNotifications />} />
          <Route path="health" element={<HealthReports />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="insights" element={<CareInsights />} />
          <Route path="accounts" element={<AccountManagement />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="patients" element={<CareRecipients />} />
          <Route path="daily-health" element={<DailyHealth />} />
          <Route path="routine-checkup" element={<RoutineCheckup />} />
          <Route path="health-log" element={<FamilyHealthLog />} />
          <Route path="occupancy" element={<RoomOccupancy />} />
          <Route path="overview" element={<MonitorOverview />} />
        </Route>
      ) : null}

      {/* 其餘未知路徑 → 介紹頁 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <UserProvider>
      <DeveloperProvider>
        <DataProvider>
          <ErrorBoundary>
            <BrowserRouter>
              {/* 公開頁面（Login/Landing 等）的 lazy 載入邊界；受保護頁面另有 Layout 內的 Suspense 保留側邊欄 */}
              <Suspense fallback={<RouteFallback />}>
                <AppRoutes />
              </Suspense>
            </BrowserRouter>
          </ErrorBoundary>
        </DataProvider>
      </DeveloperProvider>
    </UserProvider>
  );
}
