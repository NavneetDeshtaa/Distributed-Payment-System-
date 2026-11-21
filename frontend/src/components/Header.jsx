import React from 'react';
import { ShieldCheck, Activity, Key, Server, Cpu, Layers, CheckCircle2, ChevronRight, User } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, health, token, user, setUser, onMintToken }) {
  const getBadgeClass = (status) => {
    if (status === 'UP') return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    if (status === 'DEGRADED') return 'bg-amber-50 text-amber-700 border-amber-200/80';
    return 'bg-rose-50 text-rose-700 border-rose-200/80';
  };

  const navItems = [
    { id: 'topology', label: 'Topology & Flow', icon: Layers },
    { id: 'terminal', label: 'Payment Terminal', icon: ShieldCheck },
    { id: 'fraud', label: 'ML Fraud Detection', icon: Cpu },
    { id: 'tracing', label: 'Distributed Tracing', icon: Activity },
    { id: 'backpressure', label: 'Adaptive Backpressure', icon: Server },
    { id: 'reconciliation', label: 'Financial Recon', icon: ShieldCheck },
    { id: 'webhooks', label: 'Webhooks & HMAC', icon: Key },
    { id: 'ledger', label: 'Double-Entry Ledger', icon: Layers }
  ];

  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Product Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight text-base">FinScale Engine</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  v5.0 Enterprise
                </span>
              </div>
              <p className="text-xs text-slate-500">Distributed • Exactly-Once • Polyglot ML • Reconciled</p>
            </div>
          </div>

          {/* Microservices Health Bar */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono">
            <div className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${getBadgeClass(health?.gateway?.status)}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${health?.gateway?.status === 'UP' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              Gateway :8090
            </div>
            <div className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${getBadgeClass(health?.payment?.status)}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${health?.payment?.status === 'UP' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              Payment :8080
            </div>
            <div className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${getBadgeClass(health?.fraud?.status)}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${health?.fraud?.status === 'UP' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              Fraud AI :8000
            </div>
          </div>

          {/* User & Auth Controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-700">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="alice">Alice (Payer)</option>
                <option value="bob">Bob (Merchant)</option>
                <option value="attacker-1">Attacker (Velocity Test)</option>
              </select>
            </div>

            <button
              onClick={onMintToken}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                token
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100/70'
                  : 'bg-indigo-600 text-white border-transparent hover:bg-indigo-700 shadow-xs'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              {token ? 'JWT Active' : 'Mint JWT'}
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Minimalist Light Segmented Control) */}
        <nav className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-100 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
