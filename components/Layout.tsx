
import React from 'react';
import { LayoutDashboard, FileText, Package, PieChart, ShieldCheck, LineChart, Users, Briefcase, Factory, Search } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  searchQuery?: string;
  onSearch?: (query: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, searchQuery = '', onSearch }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'analytics', label: 'Analytics', icon: PieChart },
    { id: 'price-analysis', label: 'Prices', icon: LineChart },
    { id: 'customer-insights', label: 'Customers', icon: Users },
    { id: 'supplier-insights', label: 'Suppliers', icon: Factory },
    { id: 'business-ledger', label: 'Ledger', icon: Briefcase },
  ];

  const formatTitle = (id: string) => {
      return id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="flex h-screen bg-slate-50/50 overflow-hidden">
      {/* Sidebar (Desktop) */}
      <aside className="w-72 bg-slate-950 text-slate-300 flex-shrink-0 hidden md:flex flex-col shadow-2xl z-30">
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3 mb-1">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center shadow-glow text-white">
                <ShieldCheck className="w-6 h-6" />
             </div>
             <div>
                <h1 className="text-xl font-bold text-white tracking-tight leading-none">BullionKeep</h1>
                <p className="text-[10px] text-gold-500 font-medium tracking-widest uppercase mt-1">Intelligence AI</p>
             </div>
          </div>
        </div>
        
        <nav className="mt-8 flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center px-4 py-3.5 rounded-xl text-left transition-all duration-300 group ${
                  isActive
                    ? 'bg-gold-500/10 text-gold-400 shadow-inner'
                    : 'hover:bg-slate-900 hover:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 transition-colors ${isActive ? 'text-gold-500' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className={`font-medium text-sm ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gold-500 shadow-glow" />}
              </button>
            );
          })}
        </nav>
        
        <div className="p-4 m-4 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 flex items-center justify-center text-white font-bold shadow-lg">
                    BO
                </div>
                <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-white truncate">Business Owner</p>
                    <p className="text-xs text-slate-500 truncate">Private Ledger</p>
                </div>
            </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-slate-950 text-white z-40 shadow-lg flex flex-col">
           <div className="flex justify-between items-center p-4 border-b border-slate-800">
               <div className="flex items-center gap-2">
                   <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5" />
                   </div>
                   <span className="font-bold text-lg">BullionKeep</span>
               </div>
               <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Mobile AI</div>
           </div>
           
           {/* Mobile Search */}
           <div className="px-4 py-3 bg-slate-900 border-b border-slate-800">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/>
                    <input 
                        type="text" 
                        placeholder="Search parties..." 
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-sm text-white placeholder-slate-600 focus:border-gold-500 focus:ring-1 focus:ring-gold-500 outline-none transition-all"
                        value={searchQuery}
                        onChange={(e) => onSearch?.(e.target.value)}
                    />
                </div>
           </div>

           {/* Scrollable Nav Bar */}
           <div className="flex items-center overflow-x-auto no-scrollbar px-2 py-2 bg-slate-900 gap-1">
                {navItems.map((item) => (
                    <button 
                        key={item.id} 
                        onClick={() => onTabChange(item.id)} 
                        className={`flex flex-col items-center justify-center min-w-[70px] py-2 rounded-lg transition-colors ${activeTab === item.id ? 'text-gold-400 bg-white/5' : 'text-slate-400'}`}
                    >
                        <item.icon className="w-5 h-5 mb-1" />
                        <span className="text-[9px] font-medium truncate w-full text-center">{item.label}</span>
                    </button>
                ))}
           </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 h-full flex flex-col overflow-hidden bg-[#F8FAFC]">
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-5 bg-white border-b border-slate-100 sticky top-0 z-20 shadow-sm/50">
            <h2 className="text-2xl font-bold text-slate-800">{formatTitle(activeTab)}</h2>
            
            <div className="relative group w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400 group-focus-within:text-gold-500 transition-colors" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl leading-5 bg-slate-50 text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 sm:text-sm transition-all shadow-inner-light"
                    placeholder="Search customers or suppliers..."
                    value={searchQuery}
                    onChange={(e) => onSearch?.(e.target.value)}
                />
            </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pt-[180px] md:pt-0">
            <div className="p-4 md:p-8 max-w-[1920px] mx-auto space-y-6 md:space-y-8 animate-fade-in pb-20 md:pb-8">
                {children}
            </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
