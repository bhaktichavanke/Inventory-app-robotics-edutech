'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Package,
  Boxes,
  FolderKanban,
  Settings,
  ChevronLeft,
  ChevronRight,
  Upload,
  Layers,
  LogOut,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/invoices/upload', label: 'Upload Invoice', icon: Upload, highlight: true },
  { href: '/products', label: 'Product Master', icon: Package },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/assets', label: 'Assets', icon: Wrench },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className={cn(
        'flex flex-col bg-slate-950 text-slate-100 transition-all duration-300 relative border-r border-slate-800 shadow-xl shrink-0 z-30',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className={cn('flex items-center gap-3 px-5 py-5 border-b border-slate-800/80', collapsed && 'justify-center px-0')}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
          <Layers className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-extrabold text-base tracking-tight text-white leading-none">InventiX</p>
            <p className="text-[11px] text-slate-400 font-medium mt-1">Smart Inventory AI</p>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-5 space-y-1.5 px-3">
        {navItems.map(({ href, label, icon: Icon, highlight }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150',
                collapsed && 'justify-center px-0',
                active
                  ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                  : highlight
                  ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-white' : highlight ? 'text-blue-400' : 'text-slate-400')} />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className={cn('px-3 pb-2', collapsed && 'flex justify-center')}>
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-900 hover:text-red-400 transition-all w-full',
            collapsed && 'justify-center px-0 w-auto'
          )}
          title={collapsed ? 'Log out' : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>

      {/* Toggle Collapse Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center hover:bg-slate-700 hover:text-white transition-all shadow-md"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Footer info */}
      <div className={cn('p-4 border-t border-slate-800/80 text-xs text-slate-500 font-medium', collapsed && 'text-center')}>
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <span>Inventory System</span>
            <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded text-[10px] font-mono">v1.0</span>
          </div>
        ) : (
          'v1.0'
        )}
      </div>
    </aside>
  )
}
