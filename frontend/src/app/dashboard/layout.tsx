'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { AuthGuard } from '@/components/auth/AuthGuard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  return (
    <AuthGuard>
      <div
        data-dashboard-scroll-container
        className="h-dvh flex overflow-hidden bg-surface-50 dark:bg-slate-950"
      >
        {/* Sidebar */}
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Navbar */}
          <Navbar onOpenSidebar={() => setMobileSidebarOpen(true)} />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto page-gradient px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6 2xl:px-8 2xl:py-8 3xl:px-10 3xl:py-10">
            <div className="page-shell">{children}</div>
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
