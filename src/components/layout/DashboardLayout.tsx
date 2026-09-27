'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, Users, CreditCard, Bell, 
  FileText, Settings, LogOut, Search, Menu, X, 
  Clock, User, FileOutput, ArrowRight, Loader2 
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
  ];

  // --- SEARCH LOGIC & HISTORY ---
  
  // Load History from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('mrgym_search_history');
    if (saved) setSearchHistory(JSON.parse(saved));
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


  return (
    <div className="flex h-screen bg-[#F7F8FA] overflow-hidden font-sans">
      
      {/* --- DESKTOP SIDEBAR --- */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-[#E5E7EB] z-20">
        <div className="h-20 flex items-center px-6 border-b border-[#E5E7EB]">
          <img src="/logo.png" alt="MR GYM" className="h-10 w-10 rounded-full mr-3 border border-gray-100" />
          <span className="font-bold text-lg tracking-tight text-[#1F2937]">MR GYM</span>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link key={item.name} href={item.path} className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isPathActive(item.path) ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'text-[#6B7280] hover:bg-gray-50 hover:text-[#1F2937]'}`}>
              <item.icon className="h-5 w-5 mr-3 shrink-0" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[#E5E7EB] space-y-1">
          <Link href="/settings" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${isPathActive('/settings') ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'text-[#6B7280] hover:bg-gray-50 hover:text-[#1F2937]'}`}>
            <Settings className="h-5 w-5 mr-3 shrink-0" /> Settings
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-[#DC2626] hover:bg-red-50 transition-colors">
            <LogOut className="h-5 w-5 mr-3 shrink-0" /> Logout
          </button>
        </div>
      </aside>

      {/* --- MOBILE MENU DRAWER --- */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={() => setMobileMenuOpen(false)}></div>
          <div className="relative flex-1 flex flex-col max-w-[280px] w-full bg-white h-full shadow-xl">
            <div className="absolute top-4 right-4">
              <button onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center h-10 w-10 rounded-full bg-gray-100 text-[#6B7280]"><X className="h-6 w-6" /></button>
            </div>
            <div className="h-20 flex items-center px-6 border-b border-[#E5E7EB] mt-4">
              <img src="/logo.png" alt="MR GYM" className="h-10 w-10 rounded-full mr-3 border border-gray-100" />
              <span className="font-bold text-lg tracking-tight text-[#1F2937]">MR GYM</span>
            </div>
            <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <Link key={item.name} href={item.path} onClick={() => setMobileMenuOpen(false)} className={`flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${isPathActive(item.path) ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'text-[#6B7280] hover:bg-gray-50'}`}>
                  <item.icon className="h-5 w-5 mr-4 shrink-0" /> {item.name}
                </Link>
              ))}
            </nav>
            <div className="p-4 border-t border-[#E5E7EB] space-y-1">
              <Link href="/settings" onClick={() => setMobileMenuOpen(false)} className={`flex items-center px-4 py-3 text-base font-medium rounded-lg transition-colors ${isPathActive('/settings') ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'text-[#6B7280] hover:bg-gray-50'}`}>
                <Settings className="h-5 w-5 mr-4 shrink-0" /> Settings
              </Link>
              <button onClick={handleLogout} className="w-full flex items-center px-4 py-3 text-base font-medium rounded-lg text-[#DC2626] hover:bg-red-50 transition-colors">
                <LogOut className="h-5 w-5 mr-4 shrink-0" /> Logout
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
        <header className="h-16 sm:h-20 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4 sm:px-8 z-10 shrink-0">
          <div className="flex items-center">
            <div className="md:hidden flex items-center mr-3">
              <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-[#6B7280] hover:text-[#1F2937]">
                <Menu className="h-6 w-6" />
              </button>
            </div>
            <h1 className="text-xl font-bold text-[#1F2937] capitalize">
              {pathname.split('/')[1] || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-5">
            {/* Global Search Button - NOW VISIBLE ON MOBILE TOO */}
            <button onClick={() => setSearchOpen(true)} className="flex text-[#6B7280] hover:text-[#2563EB] transition-colors p-2 bg-gray-50 rounded-full border border-gray-100 shadow-sm">
              <Search className="h-5 w-5" />
            </button>
            <div className="relative">
              <button onClick={handleNotifications} aria-label="Open notifications" aria-expanded={notificationsOpen} className="text-[#6B7280] hover:text-[#1F2937] transition-colors relative p-1">
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
            <div className="h-8 w-px bg-[#E5E7EB] hidden sm:block"></div>
            <div className="flex items-center space-x-2 cursor-pointer">
              <div className="h-8 w-8 rounded-full bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB] font-bold text-sm shrink-0">
                {admin?.name?.charAt(0) || 'A'}
              </div>
              <span className="hidden sm:block text-sm font-medium text-[#1F2937] whitespace-nowrap">
                {admin?.name || 'Admin'}
              </span>
            </div>
          </div>
        </header>

        {/* SCROLLABLE PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto bg-[#F7F8FA] p-4 sm:p-8 pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* --- MOBILE BOTTOM NAVIGATION --- */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-[#E5E7EB] flex justify-around items-center pb-safe pt-1 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        {[
          { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
          { name: 'Members', path: '/members', icon: Users },
          { name: 'Payments', path: '/payments', icon: CreditCard },
        ].map((item) => (
          <Link key={item.name} href={item.path} className={`flex flex-col items-center py-2 px-3 min-w-[72px] transition-colors ${isPathActive(item.path) ? 'text-[#2563EB]' : 'text-[#9CA3AF] hover:text-[#6B7280]'}`}>
            <item.icon className="h-6 w-6 mb-1" strokeWidth={isPathActive(item.path) ? 2.5 : 2} />
            <span className="text-[10px] font-semibold">{item.name}</span>
          </Link>
        ))}
        
        <button onClick={() => setMobileMenuOpen(true)} className="flex flex-col items-center py-2 px-3 min-w-[72px] text-[#9CA3AF] hover:text-[#6B7280] transition-colors">
          <Menu className="h-6 w-6 mb-1" strokeWidth={2} />
          <span className="text-[10px] font-semibold">Menu</span>
        </button>
      </nav>

    </div>
  );
};
