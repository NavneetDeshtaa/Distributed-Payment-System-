import React from 'react';
import { ShieldCheck, Activity, Key, Server, Cpu, Layers } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, health, token, user, setUser, onMintToken }) {
  const getBadgeClass = (status) => {
    if (status === 'UP') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (status === 'DEGRADED') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  };

  const navItems = [
    { id: 'topology', label: 'Topology & Health', icon: Layers },
    { id: 'terminal', label: 'Payment Terminal', icon: ShieldCheck },
    { id: 'fraud', label: 'Polyglot ML Fraud', icon: Cpu },
    { id: 'tracing', label: 'Distributed Tracing', icon: Activity },
    { id: 'backpressure', label: 'Adaptive Backpressure', icon: Server },
    { id: 'reconciliation', label: 'Financial Recon (5 Audits)', icon: ShieldCheck },
    { id: 'webhooks', label: 'Reliable Webhooks', icon: Key },
    { id: 'ledger', label: 'Double-Entry Ledger', icon: Layers }
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-600/30">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">FinScale Engine</span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-full">
                  Phase 5 Full Stack
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">Distributed • Exactly-Once • Polyglot ML • Reconciled</p>
            </div>
          </div>

          {/* Microservices Health Bar */}
          <div className="hidden lg:flex items-center gap-2 text-xs font-mono">
            <div className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${getBadgeClass(health?.gateway?.status)}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${health?.gateway?.status === 'UP' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              Gateway :8090
            </div>
            <div className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${getBadgeClass(health?.payment?.status)}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${health?.payment?.status === 'UP' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              Payment :8080
            </div>
            <div className={`px-2.5 py-1 rounded-md border flex items-center gap-1.5 ${getBadgeClass(health?.fraud?.status)}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${health?.fraud?.status === 'UP' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
              Fraud AI :8000
            </div>
          </div>

          {/* User & Auth Controls */}
          <div className="flex items-center gap-3">
            <select
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="alice">Alice (Payer)</option>
              <option value="bob">Bob (Merchant)</option>
              <option value="attacker-1">Attacker (Velocity Test)</option>
            </select>

            <button
              onClick={onMintToken}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
                token
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 hover:bg-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              {token ? 'Token Active' : 'Mint JWT'}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 overflow-x-auto py-2 border-t border-slate-800/80 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
