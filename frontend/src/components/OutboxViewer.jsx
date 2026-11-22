import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, CheckCircle2, Clock, XCircle, ArrowRight, Zap, Code } from 'lucide-react';
import { getOutboxStatus } from '../services/api';

export default function OutboxViewer() {
  const [data, setData] = useState({ newCount: 0, publishedCount: 0, failedCount: 0, recentEvents: [] });
  const [loading, setLoading] = useState(false);

  const loadOutbox = async () => {
    try {
      const res = await getOutboxStatus();
      setData(res || { newCount: 0, publishedCount: 0, failedCount: 0, recentEvents: [] });
    } catch (e) {
      console.error('Failed to load outbox status:', e);
    }
  };

  useEffect(() => {
    loadOutbox();
    const interval = setInterval(loadOutbox, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    await loadOutbox();
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Info */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <span>Transactional Outbox Engine</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Guarantees dual-write consistency between PostgreSQL and Kafka without 2-phase commit (2PC). Polling rate: 1000ms.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="self-start sm:self-auto px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Outbox</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Queued Events (NEW)</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            {data.newCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Awaiting OutboxPublisher daemon</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Published to Kafka</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-600">
            {data.publishedCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Streamed to payment.created topic</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Failed Deliveries</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">
            {data.failedCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Retry backoff or dead-letter queue</p>
        </div>
      </div>

      {/* Outbox Events Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Recent Outbox Records (PostgreSQL Table)</h3>
            <p className="text-xs text-slate-500">Atomic records created in the same ACID transaction as the payment</p>
          </div>
          <span className="text-xs font-mono text-slate-400">Top 20 Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Aggregate Type</th>
                <th className="py-3 px-4">Aggregate ID</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Payload Preview</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {(!data.recentEvents || data.recentEvents.length === 0) ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                    No outbox events recorded yet.
                  </td>
                </tr>
              ) : (
                data.recentEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">{evt.id.slice(0, 8)}...</td>
                    <td className="py-3 px-4 text-slate-700">{evt.aggregateType}</td>
                    <td className="py-3 px-4 text-slate-600">{evt.aggregateId.slice(0, 8)}...</td>
                    <td className="py-3 px-4 font-sans">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        evt.status === 'PUBLISHED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : evt.status === 'NEW'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {evt.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 truncate max-w-[240px]">
                      {evt.payload}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(evt.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
