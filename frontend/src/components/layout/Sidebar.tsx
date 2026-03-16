'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BarChart3,
  Package,
  ShoppingCart,
  TrendingUp,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  FileText,
  Shirt,
  Boxes,
  Zap,
  Gauge,
  Receipt,
  Store,
  PieChart,
  DollarSign,
  Percent,
  Target,
  Layers,
  Megaphone,
  Truck,
  ClipboardList,
  Building2,
  PackageCheck,
  Scissors,
  CheckCircle,
  QrCode,
  Factory,
  BookOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavChild {
  name: string;
  href: string;
  icon?: LucideIcon;
}

interface NavItem {
  name: string;
  icon: LucideIcon;
  href?: string;
  children?: NavChild[];
}

const navigation: NavItem[] = [
  {
    name: 'Overview',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Reports',
    icon: BarChart3,
    children: [
      { name: 'All Reports', href: '/dashboard/reports/reports-index', icon: FileText },
      { name: 'Sales Report', href: '/dashboard/sales/reports/daily', icon: BarChart3 },
      { name: 'Return Report', href: '/dashboard/sales/reports/returns', icon: BarChart3 },
      { name: 'SKU Sales', href: '/dashboard/reports/sales/bundle-sku', icon: BarChart3 },
      { name: 'Discounts', href: '/dashboard/reports/sales/discount-general', icon: Percent },
      { name: 'Channels', href: '/dashboard/reports/panels/settlement', icon: Store },
    ],
  },
  {
    name: 'Garments',
    icon: Shirt,
    children: [
      { name: 'Master Data', href: '/dashboard/garments/master', icon: Package },
      { name: 'Orders', href: '/dashboard/garments/production', icon: ShoppingCart },
      { name: 'Best SKUs', href: '/dashboard/garments/best-skus', icon: Zap },
      { name: 'SKU Velocity', href: '/dashboard/garments/sku-velocity', icon: Gauge },
      { name: 'Bundle SKUs', href: '/dashboard/garments/bundle-skus', icon: Layers },
      { name: 'Bundle Sales', href: '/dashboard/garments/bundle-sales', icon: TrendingUp },
      { name: 'Fabric', href: '/dashboard/garments/fabric', icon: Boxes },
    ],
  },
  {
    name: 'Sales',
    icon: DollarSign,
    children: [
      { name: 'Transactions', href: '/dashboard/sales/transactions', icon: Receipt },
      { name: 'Panels', href: '/dashboard/sales/panels', icon: PieChart },
      { name: 'Sales Activity', href: '/dashboard/sales/activity', icon: BarChart3 },
      { name: 'COD vs Prepaid', href: '/dashboard/sales/cod-prepaid', icon: ShoppingCart },
      { name: 'Top Sellers', href: '/dashboard/sales/top-sellers', icon: TrendingUp },
    ],
  },
  {
    name: 'Financial',
    icon: TrendingUp,
    children: [
      { name: 'Overview', href: '/dashboard/financial', icon: BarChart3 },
      { name: 'Discounts', href: '/dashboard/financial/discounts', icon: Percent },
      { name: 'Ads', href: '/dashboard/financial/ads', icon: Megaphone },
      { name: 'ROI Analysis', href: '/dashboard/financial/roi', icon: Target },
    ],
  },
  {
    name: 'Procurement',
    icon: Truck,
    children: [
      { name: 'Product Master', href: '/dashboard/procurement/product-master', icon: BookOpen },
      { name: 'Suppliers', href: '/dashboard/procurement/suppliers', icon: Building2 },
      { name: 'Purchase Orders', href: '/dashboard/procurement/purchase-orders', icon: ClipboardList },
      { name: 'Gate Entry', href: '/dashboard/procurement/gate-entry', icon: PackageCheck },
      { name: 'MRN', href: '/dashboard/procurement/mrn', icon: FileText },
    ],
  },
  {
    name: 'Manufacturing',
    icon: Factory,
    children: [
      { name: 'Yarn Store', href: '/dashboard/manufacturing/yarn-store', icon: Package },
      { name: 'Knit Orders', href: '/dashboard/manufacturing/knit-orders', icon: Layers },
      { name: 'Processing', href: '/dashboard/manufacturing/processing', icon: Boxes },
      { name: 'Cutting', href: '/dashboard/manufacturing/cutting', icon: Scissors },
      { name: 'Stitching', href: '/dashboard/manufacturing/stitching', icon: Shirt },
      { name: 'Finishing', href: '/dashboard/manufacturing/finishing', icon: CheckCircle },
      { name: 'Barcoding', href: '/dashboard/manufacturing/barcoding', icon: QrCode },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    // Auto-expand the group containing the current page
    const initial: Record<string, boolean> = {};
    navigation.forEach((item) => {
      if (item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'))) {
        initial[item.name] = true;
      }
    });
    return initial;
  });

  const isActive = (href: string) => pathname === href;
  const isGroupActive = (children?: NavChild[]) =>
    children?.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'));

  const toggleGroup = (name: string) => {
    setOpenGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <aside
      className={`${collapsed ? 'w-[72px]' : 'w-[260px]'
        } flex flex-col h-screen sticky top-0 transition-all duration-300 ease-in-out
        bg-white dark:bg-slate-950 
        border-r border-slate-200/70 dark:border-slate-800/70
        z-40`}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-slate-100 dark:border-slate-800/50">
        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">A</span>
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-base font-bold text-slate-900 dark:text-white whitespace-nowrap"
            >
              Anthrilo
            </motion.span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {navigation.map((item) => {
          if (item.href) {
            // Direct link (no children)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`sidebar-item ${isActive(item.href) ? 'sidebar-active' : ''}`}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          }

          // Group with children
          const groupActive = isGroupActive(item.children);
          const isOpen = openGroups[item.name] || false;

          return (
            <div key={item.name} className="space-y-0.5">
              <button
                onClick={() => !collapsed && toggleGroup(item.name)}
                className={`sidebar-item w-full ${groupActive ? 'text-primary-700 dark:text-primary-300 font-semibold' : ''
                  }`}
                title={collapsed ? item.name : undefined}
              >
                <item.icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.8} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.name}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
                        }`}
                    />
                  </>
                )}
              </button>

              {/* Sub-items */}
              <AnimatePresence initial={false}>
                {!collapsed && isOpen && item.children && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="ml-3 pl-3 border-l border-slate-200 dark:border-slate-800 space-y-0.5">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors duration-150 ${isActive(child.href)
                            ? 'text-primary-600 dark:text-primary-400 bg-primary-50/80 dark:bg-primary-950/40 font-medium'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                        >
                          {child.icon && <child.icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />}
                          <span>{child.name}</span>
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800/50">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs 
                     text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 
                     hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
