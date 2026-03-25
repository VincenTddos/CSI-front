export type UserRole = 'medical' | 'family' | 'admin';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
  assignedRooms?: string[]; // For medical staff
  patientName?: string; // For family members
}

export type Page = 
  | 'login' 
  | 'register' 
  | 'device' 
  | 'personnel' 
  | 'realtime' 
  | 'alerts' 
  | 'health' 
  | 'settings';
