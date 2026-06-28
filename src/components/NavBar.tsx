'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Scale, TrendingUp, Receipt, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase'

const navItems = [
  { href: '/',         label: '總覽',     icon: LayoutDashboard },
  { href: '/balance',  label: '資產負債表', icon: Scale },
  { href: '/strategy', label: '策略監控',  icon: TrendingUp },
  { href: '/cashflow', label: '每月收支',  icon: Receipt },
]

export default function NavBar() {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (pathname === '/login') return null

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <span className="font-bold text-lg text-indigo-600">個人財務</span>
        <div className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === href
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <LogOut size={16} />
            登出
          </button>
        </div>
      </div>
    </nav>
  )
}
