import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* If user is authenticated, show protected pages */}
      {user ? (
        <Route path="/" element={<Layout><DevBackdoor /></Layout>}>
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
        </Route>
      ) : null}
      
      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <UserProvider>
      <DeveloperProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </DeveloperProvider>
    </UserProvider>
  );
}
