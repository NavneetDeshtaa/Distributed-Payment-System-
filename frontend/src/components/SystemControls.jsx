import React, { useState } from 'react';
import { Server, FileSearch, Key, Activity, Database } from 'lucide-react';
import BackpressureController from './BackpressureController';
import ReconciliationDashboard from './ReconciliationDashboard';
import WebhooksSimulator from './WebhooksSimulator';
import TraceInspector from './TraceInspector';
import OutboxViewer from './OutboxViewer';

export default function SystemControls() {
  const [subTab, setSubTab] = useState('outbox');

  const subNavItems = [
    { id: 'outbox', label: 'Transactional Outbox & Events', icon: Database, desc: 'Dual-Write PostgreSQL & Kafka Events' },
    { id: 'backpressure', label: 'Adaptive Backpressure & Lag', icon: Server, desc: 'Dynamic Token Bucket Throttling' },
    { id: 'reconciliation', label: 'Financial Recon 5-Point Audit', icon: FileSearch, desc: 'Stale, Ghost, Orphan Checks' },
    { id: 'webhooks', label: 'Webhooks & HMAC Signatures', icon: Key, desc: 'Reliable Outbound Event Delivery' },
    { id: 'tracing', label: 'Distributed Tracing & Correlation', icon: Activity, desc: 'W3C TraceContext & Logs' }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Sub-navigation Segmented Control */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-2 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {subNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = subTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSubTab(item.id)}
                className={`p-3 rounded-lg text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  <span className="font-semibold text-xs truncate">{item.label}</span>
                </div>
                <p className={`text-[11px] mt-1 truncate ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                  {item.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Active Controller */}
      <div className="transition-all">
        {subTab === 'outbox' && <OutboxViewer />}
        {subTab === 'backpressure' && <BackpressureController />}
        {subTab === 'reconciliation' && <ReconciliationDashboard />}
        {subTab === 'webhooks' && <WebhooksSimulator />}
        {subTab === 'tracing' && <TraceInspector />}
      </div>
    </div>
  );
}
