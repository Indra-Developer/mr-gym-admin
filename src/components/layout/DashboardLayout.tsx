'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, Users, CreditCard, Bell, 
  FileText, Settings, LogOut, Search, Menu, X, 
  Clock, User, FileOutput, ArrowRight, Loader2, Sparkles, ChevronRight 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { logoutAdmin } from '../../services/auth';
import { getMembers, type Member } from '../../services/members';
import { getPayments, type Payment } from '../../services/payments';
import { buildMemberReminders, type MemberReminder } from '../../services/reminders';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { admin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  // Layout States
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Global Search States
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<'All' | 'Members' | 'Payments'>('All');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // Global Data for Search
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<MemberReminder[]>([]);

  const handleLogout = async () => {
    await logoutAdmin();
    router.replace('/login');
    router.refresh();
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Members', path: '/members', icon: Users },
    { name: 'Payments', path: '/payments', icon: CreditCard },
    { name: 'Reminders', path: '/reminders', icon: Bell },
    { name: 'Reports', path: '/reports', icon: FileText },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  // --- SEARCH LOGIC & HISTORY ---
  
  // Load History from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('mrgym_search_history');
    if (saved) setSearchHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  // Fetch data only when search is opened for the first time
  useEffect(() => {
    if (searchOpen && !dataLoaded) {
      Promise.all([getMembers(), getPayments()]).then(([m, p]) => {
        setAllMembers(m);
        setAllPayments(p);
        setDataLoaded(true);
      });
    }
  }, [searchOpen, dataLoaded]);

  useEffect(() => {
    getMembers()
      .then((members) => setNotifications(buildMemberReminders(members)))
      .catch((error) => console.error('Failed to load notification count:', error));
  }, []);

  const saveToHistory = (query: string) => {
    if (!query.trim()) return;
    const newHistory = [query, ...searchHistory.filter(h => h.toLowerCase() !== query.toLowerCase())].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem('mrgym_search_history', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('mrgym_search_history');
  };

  const handleResultClick = (path: string) => {
    saveToHistory(searchQuery);
    setSearchOpen(false);
    setSearchQuery('');
    router.push(path);
  };

  const handleNotifications = async () => {
    const willOpen = !notificationsOpen;
    setNotificationsOpen(willOpen);
    if (!willOpen) return;

    setNotificationsLoading(true);
    try {
      const members = await getMembers();
      setNotifications(buildMemberReminders(members));
    } catch (error) {
      console.error('Failed to load notifications:', error);
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const openNotification = (memberId: string) => {
    setNotificationsOpen(false);
    router.push(`/members/${memberId}`);
  };

  const isPathActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  // Compute Search Results dynamically
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const results: Array<{ type: 'member' | 'payment', data: any }> = [];

    if (searchFilter === 'All' || searchFilter === 'Members') {
      const matchedMembers = allMembers.filter(m => 
        m.fullName.toLowerCase().includes(query) || 
        m.membershipId.toLowerCase().includes(query) || 
        m.mobileNumber.includes(query) || 
        (m.email && m.email.toLowerCase().includes(query))
      );
      results.push(...matchedMembers.map(m => ({ type: 'member' as const, data: m })));
    }

    if (searchFilter === 'All' || searchFilter === 'Payments') {
      const matchedPayments = allPayments.filter(p => 
        p.invoiceNumber.toLowerCase().includes(query) || 
        p.memberName.toLowerCase().includes(query) || 
        p.transactionDate.includes(query)
      );
      results.push(...matchedPayments.map(p => ({ type: 'payment' as const, data: p })));
    }

    return results.slice(0, 15); // Limit to top 15 results for performance
  }, [searchQuery, searchFilter, allMembers, allPayments]);

  const currentSection = navItems.find((item) => isPathActive(item.path))?.name || 'Dashboard';


  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F7FB] font-sans text-slate-900">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="relative z-20 hidden w-[280px] flex-col overflow-hidden border-r border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950 text-white shadow-2xl md:flex">
        <div className="pointer-events-none absolute -left-16 top-32 h-44 w-44 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="relative flex h-24 items-center border-b border-white/10 px-6">
          <div className="relative mr-3">
            <span className="absolute -inset-1 rounded-2xl bg-blue-500/30 blur-md" />
            <img src="/logo.png" alt="MR GYM" className="relative h-12 w-12 rounded-2xl border border-white/20 object-cover shadow-lg" />
          </div>
          <div>
            <span className="block text-lg font-black tracking-tight">MR GYM</span>
            <span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300"><Sparkles className="h-3 w-3" /> Admin Suite</span>
          </div>
        </div>
        
        <nav className="relative flex-1 space-y-2 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
          {navItems.map((item, index) => (
            <Link key={item.name} href={item.path} style={{ animationDelay: `${index * 45}ms` }} className={`mrgym-nav-enter group flex items-center rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all duration-300 ${isPathActive(item.path) ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-950/30' : 'text-slate-300 hover:translate-x-1 hover:bg-white/10 hover:text-white'}`}>
              <span className={`mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all ${isPathActive(item.path) ? 'bg-white/15' : 'bg-white/5 group-hover:bg-white/10'}`}><item.icon className="h-5 w-5" /></span>
              <span className="flex-1">{item.name}</span>
              <ChevronRight className={`h-4 w-4 transition-all ${isPathActive(item.path) ? 'opacity-100' : '-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`} />
            </Link>
          ))}
        </nav>

        <div className="relative border-t border-white/10 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-sm font-black text-blue-200">{admin?.name?.charAt(0) || 'A'}</div>
            <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{admin?.name || 'Admin'}</p><p className="truncate text-[11px] text-slate-400">System administrator</p></div>
          </div>
          <button onClick={handleLogout} className="flex w-full items-center rounded-xl px-4 py-3 text-sm font-semibold text-rose-300 transition-all hover:bg-rose-500/10 hover:text-rose-200">
            <LogOut className="mr-3 h-5 w-5 shrink-0" /> Logout
          </button>
        </div>
      </aside>

      {/* --- MOBILE MENU DRAWER --- */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="mrgym-drawer-enter relative flex h-full w-full max-w-[300px] flex-1 flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-blue-950 text-white shadow-2xl">
            <div className="absolute top-4 right-4">
              <button onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-slate-200 transition hover:rotate-90 hover:bg-white/20"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-3 flex h-24 items-center border-b border-white/10 px-6">
              <img src="/logo.png" alt="MR GYM" className="mr-3 h-12 w-12 rounded-2xl border border-white/20 object-cover shadow-lg" />
              <div><span className="block text-lg font-black tracking-tight">MR GYM</span><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">Admin Suite</span></div>
            </div>
            <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-6">
              <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
              {navItems.map((item, index) => (
                <Link key={item.name} href={item.path} onClick={() => setMobileMenuOpen(false)} style={{ animationDelay: `${index * 45}ms` }} className={`mrgym-nav-enter flex items-center rounded-2xl px-4 py-3.5 text-base font-semibold transition-all ${isPathActive(item.path) ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                  <span className="mr-4 flex h-9 w-9 items-center justify-center rounded-xl bg-white/10"><item.icon className="h-5 w-5" /></span><span className="flex-1">{item.name}</span><ChevronRight className="h-4 w-4 opacity-60" />
                </Link>
              ))}
            </nav>
            <div className="border-t border-white/10 p-4">
              <button onClick={handleLogout} className="flex w-full items-center rounded-xl px-4 py-3 text-base font-semibold text-rose-300 transition hover:bg-rose-500/10">
                <LogOut className="mr-4 h-5 w-5 shrink-0" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- GLOBAL SEARCH OVERLAY --- */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex justify-center bg-gray-100/95 backdrop-blur-sm pt-0 sm:pt-16 px-0 sm:px-4">
          <div className="bg-white w-full sm:max-w-3xl h-full sm:h-[80vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[#E5E7EB]">
            
            {/* Search Input Header */}
            <div className="p-4 border-b border-[#E5E7EB] flex items-center gap-3 bg-white">
              <Search className="h-5 w-5 text-[#9CA3AF] shrink-0" />
              <input 
                autoFocus
                type="text" 
                placeholder="Search members, invoices, mobile numbers..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 h-10 outline-none text-base sm:text-lg text-[#1F2937] placeholder-[#9CA3AF] bg-transparent"
              />
              <button onClick={() => {setSearchOpen(false); setSearchQuery('');}} className="p-2 bg-gray-100 rounded-full text-[#6B7280] hover:bg-gray-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Filter Chips */}
            <div className="px-4 py-3 border-b border-[#E5E7EB] flex gap-2 overflow-x-auto hide-scrollbar bg-gray-50/50">
              {['All', 'Members', 'Payments'].map(f => (
                <button 
                  key={f} 
                  onClick={() => setSearchFilter(f as any)} 
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${searchFilter === f ? 'bg-[#2563EB] text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280]'}`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#F9FAFB]">
              
              {!dataLoaded ? (
                <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" /></div>
              ) : !searchQuery.trim() ? (
                // HISTORY VIEW
                <div className="max-w-xl mx-auto mt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">Recent Searches</h3>
                    {searchHistory.length > 0 && <button onClick={clearHistory} className="text-xs text-[#2563EB] font-medium hover:underline">Clear All</button>}
                  </div>
                  {searchHistory.length > 0 ? (
                    <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                      {searchHistory.map((h, i) => (
                        <button key={i} onClick={() => setSearchQuery(h)} className="w-full flex items-center px-4 py-3 hover:bg-gray-50 border-b border-[#E5E7EB] last:border-0 text-left transition-colors">
                          <Clock className="w-4 h-4 text-[#9CA3AF] mr-3" />
                          <span className="text-sm text-[#4B5563] font-medium">{h}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[#6B7280] text-center py-10">No recent searches.</p>
                  )}
                </div>
              ) : (
                // RESULTS VIEW
                <div className="space-y-3">
                  {searchResults.length > 0 ? (
                    searchResults.map((item, idx) => {
                      if (item.type === 'member') {
                        const m = item.data as Member;
                        return (
                          <div key={idx} onClick={() => handleResultClick(`/members/${m.id}`)} className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm flex justify-between items-center cursor-pointer hover:border-[#2563EB]/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center shrink-0">
                                {m.profilePicUrl ? <img src={m.profilePicUrl} alt={m.fullName} className="h-10 w-10 rounded-full object-cover" /> : <User className="w-5 h-5" />}
                              </div>
                              <div>
                                <h4 className="font-bold text-[#1F2937] text-sm">{m.fullName}</h4>
                                <p className="text-xs text-[#6B7280]">{m.membershipId} • {m.mobileNumber}</p>
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                              <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded border ${m.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{m.status}</span>
                              <span className="text-xs text-[#2563EB] font-medium flex items-center gap-1">View <ArrowRight className="w-3 h-3"/></span>
                            </div>
                          </div>
                        );
                      } else {
                        const p = item.data as Payment;
                        return (
                          <div key={idx} onClick={() => handleResultClick(`/payments/invoice/${p.id}`)} className="bg-white p-4 rounded-xl border border-[#E5E7EB] shadow-sm flex justify-between items-center cursor-pointer hover:border-[#2563EB]/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                <FileOutput className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="font-bold text-[#1F2937] text-sm">{p.invoiceNumber}</h4>
                                <p className="text-xs text-[#6B7280]">{p.memberName} • {p.transactionDate}</p>
                              </div>
                            </div>
                            <div className="text-right flex flex-col items-end gap-1">
                              <span className="font-bold text-[#16A34A] text-sm">₹{p.amountPaid}</span>
                              <span className="text-xs text-[#2563EB] font-medium flex items-center gap-1">Invoice <ArrowRight className="w-3 h-3"/></span>
                            </div>
                          </div>
                        );
                      }
                    })
                  ) : (
                    <div className="text-center py-20">
                      <p className="text-[#6B7280] font-medium">No results found for "{searchQuery}"</p>
                      <p className="text-sm text-[#9CA3AF] mt-1">Try searching by name, invoice number, or phone.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* DESKTOP & MOBILE HEADER */}
        <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl sm:h-20 sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center">
            <div className="mr-3 flex items-center md:hidden">
              <button onClick={() => setMobileMenuOpen(true)} aria-label="Open menu" className="-ml-2 rounded-xl p-2 text-slate-500 transition hover:scale-105 hover:bg-blue-50 hover:text-blue-700">
                <Menu className="h-6 w-6" />
              </button>
            </div>
            <div className="min-w-0">
              <div className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:flex"><span>MR GYM</span><ChevronRight className="h-3 w-3" /><span className="text-blue-600">{currentSection}</span></div>
              <h1 className="truncate text-lg font-black tracking-tight text-slate-900 sm:mt-0.5 sm:text-2xl">{currentSection}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setSearchOpen(true)} className="group flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md sm:min-w-44 sm:px-3">
              <Search className="h-5 w-5" />
              <span className="hidden flex-1 text-left text-xs font-semibold sm:block">Search anything</span>
              <span className="hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400 lg:block">⌘ K</span>
            </button>
            <div className="relative">
              <button onClick={handleNotifications} aria-label="Open notifications" aria-expanded={notificationsOpen} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md">
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-[#DC2626] text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white">{Math.min(99, notifications.length)}</span>}
              </button>

              {notificationsOpen && (
                <>
                  <button aria-label="Close notifications" onClick={() => setNotificationsOpen(false)} className="fixed inset-0 z-40 cursor-default" />
                  <div className="fixed sm:absolute right-3 sm:right-0 left-3 sm:left-auto top-20 sm:top-11 z-50 sm:w-96 max-h-[70vh] overflow-hidden rounded-xl bg-white border border-[#E5E7EB] shadow-2xl">
                    <div className="p-4 border-b border-[#E5E7EB] flex items-center justify-between">
                      <div><p className="font-bold text-[#1F2937]">Notifications</p><p className="text-xs text-[#6B7280]">Member follow-ups requiring attention</p></div>
                      <span className="text-xs font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-1 rounded-full">{notifications.length}</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-[#E5E7EB]">
                      {notificationsLoading ? (
                        <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" /></div>
                      ) : notifications.length === 0 ? (
                        <div className="py-10 text-center text-sm text-[#6B7280]">No reminders right now.</div>
                      ) : notifications.slice(0, 8).map((notification) => (
                        <button key={notification.id} onClick={() => openNotification(notification.memberId)} className="w-full p-4 text-left hover:bg-[#F9FAFB] flex gap-3">
                          <span className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${notification.severity === 'critical' ? 'bg-[#DC2626]' : notification.severity === 'warning' ? 'bg-[#D97706]' : 'bg-[#2563EB]'}`} />
                          <span className="min-w-0"><span className="block text-sm font-semibold text-[#1F2937] truncate">{notification.fullName}</span><span className="block text-xs text-[#6B7280] mt-0.5">{notification.title} · {notification.message}</span></span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => { setNotificationsOpen(false); router.push('/reminders'); }} className="w-full h-11 border-t border-[#E5E7EB] text-sm font-semibold text-[#2563EB] hover:bg-[#EFF6FF]">View all reminders</button>
                  </div>
                </>
              )}
            </div>
            <div className="hidden h-8 w-px bg-slate-200 sm:block"></div>
            <div className="flex items-center gap-2 rounded-xl p-1 transition hover:bg-slate-50">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-black text-white shadow-md shadow-blue-200">
                {admin?.name?.charAt(0) || 'A'}
              </div>
              <div className="hidden min-w-0 sm:block"><span className="block max-w-28 truncate text-sm font-bold text-slate-800">{admin?.name || 'Admin'}</span><span className="block text-[10px] font-medium text-slate-400">Administrator</span></div>
            </div>
          </div>
        </header>

        {/* SCROLLABLE PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.07),_transparent_28%),#F4F7FB] p-4 pb-24 sm:p-7 md:pb-8 lg:p-8">
          <div key={pathname} className="mrgym-page-enter mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>

      {/* --- MOBILE BOTTOM NAVIGATION --- */}
      <nav className="fixed bottom-0 z-30 flex w-full items-center justify-around border-t border-slate-200 bg-white/95 pb-safe pt-1 shadow-[0_-8px_30px_-12px_rgba(15,23,42,0.35)] backdrop-blur-xl md:hidden">
        {[
          { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
          { name: 'Members', path: '/members', icon: Users },
          { name: 'Payments', path: '/payments', icon: CreditCard },
        ].map((item) => (
          <Link key={item.name} href={item.path} className={`relative flex min-w-[72px] flex-col items-center rounded-xl px-3 py-2 transition-all ${isPathActive(item.path) ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
            {isPathActive(item.path) && <span className="absolute -top-1 h-1 w-8 rounded-full bg-blue-600" />}
            <item.icon className="h-6 w-6 mb-1" strokeWidth={isPathActive(item.path) ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">{item.name}</span>
          </Link>
        ))}
        
        <button onClick={() => setMobileMenuOpen(true)} className="flex flex-col items-center py-2 px-3 min-w-[72px] text-[#9CA3AF] hover:text-[#6B7280] transition-colors">
          <Menu className="h-6 w-6 mb-1" strokeWidth={2} />
          <span className="text-[10px] font-semibold">Menu</span>
        </button>
      </nav>

      <style jsx global>{`
        @keyframes mrgym-page-enter {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mrgym-nav-enter {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes mrgym-drawer-enter {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        .mrgym-page-enter { animation: mrgym-page-enter 420ms cubic-bezier(.22,1,.36,1) both; }
        .mrgym-nav-enter { animation: mrgym-nav-enter 360ms cubic-bezier(.22,1,.36,1) both; }
        .mrgym-drawer-enter { animation: mrgym-drawer-enter 300ms cubic-bezier(.22,1,.36,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .mrgym-page-enter, .mrgym-nav-enter, .mrgym-drawer-enter { animation: none !important; }
        }
      `}</style>

    </div>
  );
};
