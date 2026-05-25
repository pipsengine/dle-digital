'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { RightPanel } from '@/components/layout/right-panel';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar isOpen={sidebarOpen} toggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          toggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
          toggleRightPanel={() => setRightPanelOpen(!rightPanelOpen)} 
          rightPanelOpen={rightPanelOpen}
        />
        
        <main className="flex-1 overflow-hidden flex flex-col xl:flex-row relative">
          <div className="flex-1 overflow-auto p-6 space-y-8 pb-32">
            {children}
          </div>

          {rightPanelOpen && (
            <div className="xl:w-[350px] w-full shrink-0 border-l border-slate-100 bg-white/50 backdrop-blur-sm overflow-hidden p-6 hidden xl:block z-10 transition-all duration-300">
               <RightPanel />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
