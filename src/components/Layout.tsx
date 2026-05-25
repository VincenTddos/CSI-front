import React from 'react';
import { Sidebar } from './Sidebar';
import { Outlet } from 'react-router-dom';

interface LayoutProps {
  children?: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen w-full bg-[#E8E1D5] text-slate-800 font-sans overflow-hidden">
      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto p-6 md:p-8">
        <div className="max-w-7xl mx-auto h-full">
          <Outlet />
          {children}
        </div>
      </main>
    </div>
  );
}
