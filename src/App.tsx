import React, { useState, useEffect } from 'react';
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
import { Page } from './types';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const { isDeveloperMode, setManualState } = useDeveloper();
  const { user } = useUser();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user && currentPage !== 'register') {
      setCurrentPage('login');
    } else if (user && (currentPage === 'login' || currentPage === 'register')) {
      setCurrentPage('realtime');
    }
  }, [user, currentPage]);

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <Login onNavigate={setCurrentPage} />;
      case 'register':
        return <Register onNavigate={setCurrentPage} />;
      case 'device':
        return <DeviceManagement />;
      case 'personnel':
        return <PersonnelManagement />;
      case 'realtime':
        return <RealtimeMonitoring />;
      case 'alerts':
        return <AlertNotifications />;
      case 'health':
        return <HealthReports />;
      case 'settings':
        return <SystemSettings />;
      case 'patients':
        return <CareRecipients onNavigate={setCurrentPage} />;
      case 'daily-health':
        return <DailyHealth />;
      case 'routine-checkup':
        return <RoutineCheckup />;
      case 'health-log':
        return <FamilyHealthLog />;
      case 'subcarrier':
        return <SubcarrierAnalyzer />;
      case 'occupancy':
        return <RoomOccupancy />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-500">
            <h2 className="text-2xl font-medium">此頁面正在建置中 (Under Construction)</h2>
          </div>
        );
    }
  };

  if (currentPage === 'login' || currentPage === 'register') {
    return renderPage();
  }

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
      
      {/* Hidden Developer Buttons */}
      {isDeveloperMode && (
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
      )}
    </Layout>
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
