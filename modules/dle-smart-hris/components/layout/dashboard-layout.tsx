'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const syncSidebar = () => setSidebarOpen(window.matchMedia('(min-width: 1024px)').matches);
    syncSidebar();
    window.addEventListener('resize', syncSidebar);
    return () => window.removeEventListener('resize', syncSidebar);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar isOpen={sidebarOpen} toggle={() => setSidebarOpen(!sidebarOpen)} />
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
        />
      ) : null}
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        />
        
        <main className="flex-1 overflow-hidden flex flex-col relative">
          <div className="flex-1 overflow-auto px-3 pb-32 pt-0 space-y-8 sm:px-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
