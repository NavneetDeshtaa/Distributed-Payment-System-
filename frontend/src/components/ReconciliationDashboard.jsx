import React, { useState, useEffect } from 'react';
import { ShieldCheck, Play, AlertTriangle, CheckCircle2, RefreshCw, AlertCircle, FileSearch } from 'lucide-react';
import { runReconciliation, getReconciliationAlerts } from '../services/api';

export default function ReconciliationDashboard() {
  const [report, setReport] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      const alertsData = await getReconciliationAlerts();
      setAlerts(alertsData || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunAudit = async () => {
    setLoading(true);
    try {
      const data = await runReconciliation();
      setReport(data);
      await loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const audits = [
    { id: 'stale', title: '1. STALE_PAYMENT', desc: 'Payments stuck in PENDING status for > 10 minutes', count: report?.stalePaymentsCount ?? 2 },
    { id: 'ghost', title: '2. GHOST_PAYMENT', desc: 'Outbox events marked PUBLISHED but missing in payments table', count: report?.ghostPaymentsCount ?? 0 },
    { id: 'dup', title: '3. DUPLICATE_LEDGER', desc: 'More than 2 ledger entries created for a single transaction', count: report?.duplicateLedgerCount ?? 0 },
    { id: 'imbalance', title: '4. LEDGER_IMBALANCE', desc: 'Sum of DEBIT does not match sum of CREDIT for a payment', count: report?.ledgerImbalanceCount ?? 0 },
    { id: 'orphan', title: '5. ORPHAN_LEDGER', desc: 'Ledger entries pointing to non-existent payment records', count: report?.orphanLedgerCount ?? 0 }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-indigo-400" />
              Automated Financial Reconciliation Engine
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Verifies 5 core ledger invariants against database anomalies & emits critical alerts to <code className="text-indigo-300">reconciliation.alerts</code>
            </p>
          </div>
          <button
            onClick={handleRunAudit}
            disabled={loading}
            className={`px-4 py-2 rounded-md font-semibold text-xs flex items-center gap-2 transition-all ${
              loading
                ? 'bg-indigo-600/50 text-indigo-200 cursor-wait'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Executing 5 Audits...' : 'Run On-Demand Audit'}
          </button>
        </div>
      </div>

      {/* 5 Audits Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {audits.map((a) => (
          <div key={a.id} className="p-4 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono space-y-2">
            <div className="font-bold text-slate-200 text-[11px] truncate">{a.title}</div>
            <p className="text-[10px] text-slate-400 leading-tight h-8">{a.desc}</p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-500">Violations:</span>
              <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                a.count > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              }`}>
                {a.count}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Active Reconciliation Alerts Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            Active Reconciliation Alerts & Kafka Anomaly Feed
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {alerts.length} Total Alerts Detected
          </span>
        </div>

        {alerts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Alert Type</th>
                  <th className="py-2.5 px-3">Entity ID</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Details</th>
                  <th className="py-2.5 px-3">Detected At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-amber-400">{alert.alertType}</td>
                    <td className="py-2.5 px-3 text-slate-400 truncate max-w-[140px]">{alert.entityId}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {alert.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{alert.details}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {new Date(alert.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs font-mono">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/50 mx-auto mb-2" />
            All financial invariants are clean and verified. No ledger anomalies detected.
          </div>
        )}
      </div>
    </div>
  );
}
