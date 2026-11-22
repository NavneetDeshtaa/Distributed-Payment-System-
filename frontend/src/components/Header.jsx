import React from 'react';
import { 
  ShieldCheck, 
  Layers, 
  Cpu, 
  Activity, 
  BarChart3, 
  ExternalLink, 
  Key, 
  User, 
  CheckCircle2, 
  AlertTriangle,
  RotateCw
} from 'lucide-react';

export default function Header({ 
  activeTab, 
  setActiveTab, 
  health, 
  token, 
  user, 
  setUser, 
  onMintToken,
  isMintingToken 
}) {
  const isHealthy = health?.gateway?.status === 'UP' && health?.payment?.status === 'UP' && health?.fraud?.status === 'UP';

  const navItems = [
    { id: 'command', label: 'Command Center', icon: Layers, badge: 'Unified' },
    { id: 'topology', label: 'Pipeline & Flow', icon: Activity },
    { id: 'ledger', label: 'Double-Entry Ledger', icon: BarChart3 },
    { id: 'fraud', label: 'ML Fraud AI', icon: Cpu },
    { id: 'controls', label: 'System Controls', icon: ShieldCheck }
  ];

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-50 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight text-base">FinScale Engine</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 uppercase tracking-wider">
                  Enterprise
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Distributed Payment & Settlement Mesh</p>
            </div>
          </div>

          {/* Right Controls: Health Badge, User Selector, Token, Grafana Link */}
          <div className="flex items-center gap-3">
            
            {/* System Status Pill (Clean Stripe style, not cluttered) */}
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
              isHealthy 
                ? 'bg-emerald-50/70 text-emerald-800 border-emerald-200/80' 
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{isHealthy ? 'All Systems Healthy' : 'Degraded Service'}</span>
            </div>

            {/* Grafana Dashboard Quick Link */}
            <a 
              href="http://localhost:3001" 
              target="_blank" 
              rel="noreferrer"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all shadow-2xs"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Grafana Metrics</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            {/* Active Payer Selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 text-[11px] font-normal">Payer:</span>
              <select
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="bg-transparent font-medium text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value="alice">Alice (User)</option>
                <option value="bob">Bob (User)</option>
                <option value="charlie">Charlie (User)</option>
                <option value="diana">Diana (User)</option>
                <option value="suite-attacker-1">Attacker (Velocity)</option>
              </select>
            </div>

            {/* JWT Auto-Auth Pill */}
            <button
              onClick={onMintToken}
              disabled={isMintingToken}
              title="Click to refresh Edge Gateway JWT token"
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                token
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300/80 hover:bg-emerald-100/70'
                  : 'bg-indigo-600 text-white border-transparent hover:bg-indigo-700 shadow-xs'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>{token ? 'JWT Verified' : 'Mint Token'}</span>
              <RotateCw className={`w-3 h-3 ${isMintingToken ? 'animate-spin' : 'opacity-60'}`} />
            </button>
          </div>
        </div>

        {/* Segmented Navigation Bar */}
        <nav className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-100 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-indigo-500/30 text-indigo-200' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
