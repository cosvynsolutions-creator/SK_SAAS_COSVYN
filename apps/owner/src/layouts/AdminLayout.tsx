import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, CreditCard, BarChart3, MessageSquare, User, 
  Menu, X, LogOut, ShieldCheck, Bell, AlertCircle, Tag, Send, FileStack
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAdminTenants } from '../services/dbService';

const AdminLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Desktop default
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false); // Mobile default
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();
  
  // Real Data for notifications
  const { tenants } = useAdminTenants();
  
  // State for dynamic avatar
  const [adminAvatar, setAdminAvatar] = useState(currentUser?.photoURL || 'https://ui-avatars.com/api/?name=Admin&background=0D8ABC&color=fff');

  // Load avatar on mount and listen for changes
  useEffect(() => {
     const loadAvatar = () => {
        const saved = localStorage.getItem('admin_avatar_url');
        if (saved) setAdminAvatar(saved);
        else if (currentUser?.photoURL) setAdminAvatar(currentUser.photoURL);
     };
     loadAvatar();

     window.addEventListener('storage', loadAvatar);
     return () => window.removeEventListener('storage', loadAvatar);
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Filter tenants expiring in <= 10 days based on REAL DATA
  const expiringTenants = tenants.filter(t => {
    if (!t.planExpiryDate) return false;
    const expiry = new Date(t.planExpiryDate).getTime();
    const now = new Date().getTime();
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return daysLeft <= 10 && daysLeft >= 0;
  });

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
    { icon: Users, label: 'Owners', path: '/admin/users' },
    { icon: FileStack, label: 'Invoice Credits', path: '/admin/invoice-credits' },
    { icon: Send, label: 'Broadcast & Outreach', path: '/admin/messages' },
    { icon: CreditCard, label: 'Payments', path: '/admin/payments' },
    { icon: Tag, label: 'Plans & Offers', path: '/admin/plans' },
    { icon: BarChart3, label: 'Analytics', path: '/admin/analytics' },
    { icon: MessageSquare, label: 'Feedback', path: '/admin/feature-support' },
    { icon: User, label: 'Profile', path: '/admin/profile' },
  ];

  const getPageTitle = () => {
    const item = navItems.find(i => i.path === location.pathname);
    return item ? item.label : 'Admin';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30 flex overflow-hidden">
      
      {/* Sidebar (Desktop) */}
      <aside 
        className={`hidden md:flex fixed inset-y-0 left-0 z-50 bg-slate-900/90 backdrop-blur-xl border-r border-slate-800 transition-all duration-300 flex-col
          ${isSidebarOpen ? 'w-64' : 'w-20'}
        `}
      >
        <div className="h-16 flex items-center justify-center border-b border-slate-800/50 relative">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
                 <ShieldCheck size={18} />
              </div>
              {isSidebarOpen && (
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                  ScaleKitchen Admin
                </span>
              )}
           </div>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto no-scrollbar">
           {navItems.map((item) => {
             const isActive = location.pathname === item.path;
             return (
               <NavLink
                 key={item.path}
                 to={item.path}
                 className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200 group
                   ${isActive 
                     ? 'bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                     : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'}
                 `}
               >
                 <item.icon size={20} className={`shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-cyan-400' : ''}`} />
                 {isSidebarOpen && <span className="font-medium text-sm">{item.label}</span>}
               </NavLink>
             );
           })}
        </nav>

        <div className="p-4 border-t border-slate-800/50">
           <button onClick={handleLogout} className={`flex items-center gap-4 w-full px-3 py-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors ${!isSidebarOpen && 'justify-center'}`}>
              <LogOut size={20} />
              {isSidebarOpen && <span className="text-sm font-medium">Sign Out</span>}
           </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm md:hidden animate-in fade-in" onClick={() => setIsMobileNavOpen(false)}>
           <aside 
             onClick={e => e.stopPropagation()}
             className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col animate-in slide-in-from-left duration-300 shadow-2xl"
           >
              <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/50">
                 <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                    ScaleKitchen Admin
                 </span>
                 <button onClick={() => setIsMobileNavOpen(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
              </div>
              <nav className="flex-1 py-6 px-3 space-y-2 no-scrollbar overflow-y-auto">
                 {navItems.map((item) => {
                   const isActive = location.pathname === item.path;
                   return (
                     <NavLink
                       key={item.path}
                       to={item.path}
                       onClick={() => setIsMobileNavOpen(false)}
                       className={`flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-200
                         ${isActive 
                           ? 'bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 text-cyan-400' 
                           : 'text-slate-400 hover:text-white hover:bg-slate-800'}
                       `}
                     >
                       <item.icon size={20} />
                       <span className="font-medium text-sm">{item.label}</span>
                     </NavLink>
                   );
                 })}
              </nav>
              <div className="p-4 border-t border-slate-800/50">
                 <button onClick={handleLogout} className="flex items-center gap-4 w-full px-3 py-2 rounded-xl text-slate-400 hover:text-red-400 transition-colors">
                    <LogOut size={20} />
                    <span className="text-sm font-medium">Sign Out</span>
                 </button>
              </div>
           </aside>
        </div>
      )}

      {/* Main Content */}
      <main className={`flex-1 flex flex-col h-screen transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>
         
         {/* Top Bar */}
         <header className="h-16 border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40 px-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <button 
                 onClick={() => {
                    if (window.innerWidth >= 768) setIsSidebarOpen(!isSidebarOpen);
                    else setIsMobileNavOpen(true);
                 }}
                 className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
               >
                 <Menu size={20} />
               </button>
               <h1 className="text-xl font-bold text-white tracking-wide">{getPageTitle()}</h1>
            </div>

            <div className="flex items-center gap-6">
               
               {/* Notifications */}
               <div className="relative">
                  <button 
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors relative"
                  >
                     <Bell size={20} />
                     {expiringTenants.length > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-slate-900" />
                     )}
                  </button>

                  {/* Dropdown */}
                  {isNotificationsOpen && (
                     <>
                        <div className="fixed inset-0 z-30" onClick={() => setIsNotificationsOpen(false)} />
                        <div className="absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-40 overflow-hidden animate-in fade-in zoom-in-95">
                           <div className="p-3 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                              <h4 className="font-bold text-white text-sm">Expiring Soon</h4>
                              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{expiringTenants.length}</span>
                           </div>
                           <div className="max-h-64 overflow-y-auto no-scrollbar">
                              {expiringTenants.length === 0 ? (
                                 <div className="p-4 text-center text-slate-500 text-sm">No alerts.</div>
                              ) : (
                                 expiringTenants.map(t => (
                                    <div key={t.id} className="p-3 border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                                       <div className="flex justify-between items-start mb-1">
                                          <span className="font-bold text-slate-200 text-sm">{t.businessName}</span>
                                          <span className="text-xs text-red-400 font-medium">Ends {t.planExpiryDate}</span>
                                       </div>
                                       <p className="text-xs text-slate-500">{t.ownerName} • {t.planName}</p>
                                       <button className="mt-2 w-full text-center text-xs font-bold text-cyan-400 bg-cyan-500/10 py-1.5 rounded hover:bg-cyan-500/20 transition-colors">
                                          Notify Owner
                                       </button>
                                    </div>
                                 ))
                              )}
                           </div>
                        </div>
                     </>
                  )}
               </div>

               <div className="flex items-center gap-3 pl-6 border-l border-slate-800/50">
                  <div className="text-right hidden sm:block">
                     <p className="text-sm font-bold text-white">{currentUser?.displayName || 'Admin'}</p>
                     <p className="text-xs text-cyan-400">Super Admin</p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 overflow-hidden cursor-pointer hover:border-cyan-500 transition-colors" onClick={() => navigate('/admin/profile')}>
                     <img src={adminAvatar} alt="Admin" className="w-full h-full object-cover" />
                  </div>
               </div>
            </div>
         </header>

         {/* Scrollable Area */}
         <div className="flex-1 overflow-y-auto p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
            <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <Outlet />
            </div>
         </div>

      </main>

    </div>
  );
};

export default AdminLayout;