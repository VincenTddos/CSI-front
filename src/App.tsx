import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { 
  Login, 
  Register, 
  RealtimeMonitoring, 
  HealthReports, 
  DeviceManagement, 
  AlertNotifications, 
  SystemSettings, 
  PersonnelManagement,
  CareRecipients,
  DailyHealth,
  RoutineCheckup,
  FamilyHealthLog,
  SubcarrierAnalyzer,
  RoomOccupancy
} from './pages';
import { DeveloperProvider, useDeveloper } from './contexts/DeveloperContext';
import { UserProvider, useUser } from './contexts/UserContext';

// Protected Route Component
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user } = useUser();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
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

function AppContent() {
  const { user } = useUser();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/realtime" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/realtime" replace /> : <Register />} />
        
        {/* Protected Routes Layout */}
        <Route path="/" element={<ProtectedRoute><Layout><DevBackdoor /></Layout></ProtectedRoute>}>
          <Route index element={<Navigate to="/realtime" replace />} />
          <Route path="device" element={<DeviceManagement />} />
          <Route path="personnel" element={<PersonnelManagement />} />
          <Route path="realtime" element={<RealtimeMonitoring />} />
          <Route path="alerts" element={<AlertNotifications />} />
          <Route path="health" element={<HealthReports />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="patients" element={<CareRecipients />} />
          <Route path="daily-health" element={<DailyHealth />} />
          <Route path="routine-checkup" element={<RoutineCheckup />} />
          <Route path="health-log" element={<FamilyHealthLog />} />
          <Route path="subcarrier" element={<SubcarrierAnalyzer />} />
          <Route path="occupancy" element={<RoomOccupancy />} />
          
          <Route path="*" element={
            <div className="flex items-center justify-center h-full text-gray-500">
              <h2 className="text-2xl font-medium">此頁面正在建置中 (Under Construction)</h2>
            </div>
          } />
        </Route>
      </Routes>
    </Router>
  );
}

export default function App() {
  return (
    <UserProvider>
      <DeveloperProvider>
        <AppContent />
      </DeveloperProvider>
    </UserProvider>
  );
}
