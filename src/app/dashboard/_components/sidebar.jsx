'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from '../logout-button';
import BrandMark from '@/components/brand-mark';

const NAV = [
  {
    group: 'Office',
    items: [
      { label: 'Dashboard', icon: '◨', href: '/dashboard' },
      { label: 'Consumers', icon: '☰', href: '/dashboard/consumers', badge: 'consumers' },
      { label: 'Zones', icon: '⊞', href: '/dashboard/zones' },
      { label: 'Readings', icon: '◔', href: '/dashboard/readings', badge: 'exceptions' },
      { label: 'Cycles', icon: '◷', href: '/dashboard/cycles' },
      { label: 'Tariffs', icon: '≡', href: '/dashboard/tariffs' },
      { label: 'Billing', icon: '₵', href: '/dashboard/billing' },
      { label: 'Arrears', icon: '⚠', href: '/dashboard/arrears', badge: 'arrears' },
    ],
  },
];

function initialsFor(email) {
  const [local = ''] = email.split('@');
  const parts = local.split(/[._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : local.slice(0, 2);
  return letters.toUpperCase() || '—';
}

function NavItem({ item, active, count, onNavigate }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex w-full items-center gap-2.25 rounded-lg px-2.25 py-2 text-[12.8px] transition-colors ${
        active
          ? 'bg-brand-500 font-medium text-white'
          : 'text-[#9DBCBA] hover:bg-brand-800 hover:text-[#DCEDEC]'
      }`}
    >
      <span className="w-4 text-xs opacity-80">{item.icon}</span>
      {item.label}
      {count ? (
        <span
          className={`ml-auto rounded-full px-1.5 font-mono text-[10.5px] ${
            active ? 'bg-white/20 text-white' : 'bg-brand-800 text-[#7FA9A7]'
          }`}
        >
          {count > 999 ? `${(count / 1000).toFixed(1)}k` : count}
        </span>
      ) : null}
    </Link>
  );
}

export default function Sidebar({ email, isAdmin, counts = {}, org, className = '', onNavigate }) {
  const pathname = usePathname();

  const groups = isAdmin
    ? [
        ...NAV,
        {
          group: 'Admin',
          items: [
            { label: 'Users & roles', icon: '⚙', href: '/dashboard/admin' },
            { label: 'Settings', icon: '◈', href: '/dashboard/settings' },
          ],
        },
      ]
    : NAV;

  return (
    <aside className={`flex w-59 flex-none flex-col bg-brand-900 pt-4.5 pb-3 ${className}`}>
      <div className="flex items-center gap-2.75 px-4.5 pb-4.5">
        <BrandMark className="bg-brand-500" />
        <div className="leading-tight">
          <div className="text-[13.5px] font-semibold text-white">{org.name}</div>
          <div className="text-[11px] text-[#6E9694]">{org.tagline}</div>
        </div>
      </div>

      <nav className="flex flex-col gap-px overflow-y-auto px-3">
        {groups.map(({ group, items }) => (
          <div key={group} className="flex flex-col gap-px">
            <div className="px-2 pt-3 pb-1.5 text-[9.5px] font-semibold tracking-[.11em] text-[#4F7C7A] uppercase">
              {group}
            </div>
            {items.map((item) => (
              <NavItem
                key={item.label}
                item={item}
                active={
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href)
                }
                count={counts[item.badge]}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2.5 border-t border-[#143638] px-4.5 pt-3.5">
        <div className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[#2C5F5D] text-[11px] font-semibold text-[#CFE7E5]">
          {initialsFor(email)}
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-xs text-[#CFE7E5]">{email}</div>
          <div className="text-[10.5px] text-[#5C8785]">{isAdmin ? 'Administrator' : 'Staff'}</div>
        </div>
        <LogoutButton />
      </div>
    </aside>
  );
}
