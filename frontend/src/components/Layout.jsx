import { Outlet, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, UserCircle, LogOut, MessageSquare, CalendarClock, BookOpen, Database, ClipboardCheck, RefreshCw, BarChart3, Zap, Send, FileText, Bot, VenetianMask, Contact2, Settings, Tag, PieChart, CheckSquare, Map } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (!token || !userStr) {
    return <Navigate to="/login" replace />;
  }

  let user = null;
  try {
    user = JSON.parse(userStr);
  } catch (e) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const menuGroups = [
    {
      label: 'Analytics',
      icon: BarChart3,
      items: [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/dashboard', icon: PieChart, label: 'Dashboard Analysis' },
        { to: '/bi-chat', icon: BarChart3, label: 'BI Analyst' },
        { to: '/group-analysis', icon: Users, label: 'Analisa Group' },
        { to: '/sales-coverage-map', icon: Map, label: 'Peta Kunjungan Sales' },
      ]
    },
    {
      label: 'Reports',
      icon: ClipboardCheck,
      items: [
        { to: '/schedules', icon: CalendarClock, label: 'Scheduled Reports' },
        { to: '/general-schedules', icon: CalendarClock, label: 'Scheduled General' },
        { to: '/raport', icon: ClipboardCheck, label: 'Buku Raport' },
        { to: '/task-monitoring', icon: CheckSquare, label: 'Tasks & Issues' },
      ]
    },
    {
      label: 'Messaging & CRM',
      icon: Send,
      items: [
        { to: '/broadcasts', icon: Send, label: 'Broadcasts' },
        { to: '/contacts', icon: Contact2, label: 'Contacts' },
        { to: '/personas', icon: VenetianMask, label: 'Personas' },
        { to: '/promos', icon: Tag, label: 'Manajemen Promo' },
      ]
    },
    {
      label: 'AI Tools',
      icon: Bot,
      items: [
        { to: '/chatbot', icon: Bot, label: 'AI Chatbot' },
        { to: '/knowledge', icon: Database, label: 'Knowledge Base' },
        { to: '/dictionary', icon: BookOpen, label: 'Dictionary' },
        { to: '/templates', icon: FileText, label: 'Templates' },
      ]
    }
  ];

  if (user.role === 'DEVELOPER' || user.role === 'ADMINISTRATOR') {
    menuGroups.push({
      label: 'System Admin',
      icon: Settings,
      items: [
        { to: '/users', icon: Users, label: 'User Management' },
        { to: '/data-management', icon: Database, label: 'Data Management' },
        { to: '/data-sources', icon: Database, label: 'Data Sources' },
        { to: '/database-explorer', icon: Database, label: 'Database Explorer' },
        { to: '/sync', icon: RefreshCw, label: 'Sinkronisasi Data' },
        { to: '/telegram-bots', icon: Bot, label: 'Telegram Bots' },
        { to: '/prompts', icon: Zap, label: 'Prompt Management' },
        { to: '/settings', icon: Settings, label: 'Settings' },
      ]
    });
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans selection:bg-emerald-200">
      {/* Thin Global Sidebar */}
      <aside className="w-16 sm:w-20 bg-slate-900 flex flex-col items-center py-6 shadow-xl shrink-0 z-50">
        <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg mb-8">
          <MessageSquare className="w-6 h-6" />
        </div>
        
        <nav className="flex-1 flex flex-col gap-3 w-full px-3 overflow-visible pb-4">
          {menuGroups.map((group) => {
            const isActiveGroup = group.items.some(item => {
              if (item.to === '/') return location.pathname === '/';
              return location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            });

            return (
              <div key={group.label} className="relative group w-full">
                {/* Group Icon (Main Button) */}
                <div 
                  className={`flex items-center justify-center w-full aspect-square rounded-xl transition-all cursor-pointer ${
                    isActiveGroup
                      ? 'bg-emerald-600 text-white shadow-md' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={group.label}
                >
                  <group.icon className="w-6 h-6" />
                </div>
                
                {/* Flyout Sub-menu */}
                <div className="absolute left-full top-0 pl-3 w-60 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="bg-slate-800 rounded-xl shadow-xl py-2 border border-slate-700/50">
                    <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/50 mb-2">
                      {group.label}
                    </div>
                    <div className="flex flex-col gap-1 px-2">
                      {group.items.map(item => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={({ isActive }) => 
                            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isActive 
                                ? 'bg-emerald-500/10 text-emerald-400' 
                                : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                            }`
                          }
                        >
                          <item.icon className="w-4 h-4" />
                          {item.label}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="w-full px-3 flex flex-col gap-2 mt-auto pt-4 border-t border-slate-800/50">
          <NavLink
            to="/profile"
            className={({ isActive }) => 
              `relative flex items-center justify-center w-full aspect-square rounded-xl transition-all group ${
                isActive 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`
            }
            title="Profile"
          >
            <UserCircle className="w-6 h-6" />
            <div className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-white text-xs font-medium rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
              Profile
            </div>
          </NavLink>

          <button 
            onClick={handleLogout}
            className="flex items-center justify-center w-full aspect-square rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors group relative"
            title="Logout"
          >
            <LogOut className="w-6 h-6" />
            <div className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-white text-xs font-medium rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 pointer-events-none">
              Logout
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content Rendered by Outlet */}
      <main className="flex-1 overflow-hidden relative flex">
        <Outlet />
      </main>
    </div>
  );
}
