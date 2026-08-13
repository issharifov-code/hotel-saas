import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  moduleKey?: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Bosh sahifa' },
  { to: '/bookings', label: 'Bronlar taqvimi', moduleKey: 'booking' },
  { to: '/rooms', label: 'Xonalar', moduleKey: 'booking' },
  { to: '/guests', label: 'Mehmonlar', moduleKey: 'guest_crm' },
  { to: '/housekeeping', label: 'Housekeeping', moduleKey: 'housekeeping' },
  { to: '/warehouse', label: 'Ombor', moduleKey: 'warehouse' },
  { to: '/pos', label: 'POS', moduleKey: 'pos' },
  { to: '/invoicing', label: 'Hisob-fakturalar', moduleKey: 'invoicing' },
];

export function AppLayout({ children, title }: { children: ReactNode; title: string }) {
  const { user, property, logout, can } = useAuth();

  const visibleNav = NAV_ITEMS.filter((item) => !item.moduleKey || can(item.moduleKey, 'view'));

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-60 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-100">
          <p className="font-semibold text-slate-900">Hotel SaaS</p>
          {property && <p className="text-xs text-slate-500 mt-0.5">{property.name}</p>}
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-slate-100">
          <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          <button onClick={logout} className="mt-1 text-xs text-slate-600 hover:text-slate-900 underline">
            Chiqish
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-slate-200 px-8 py-4">
          <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        </header>
        <main className="px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
