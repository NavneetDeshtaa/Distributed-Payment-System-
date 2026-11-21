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
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-indigo-600" />
              Automated Financial Reconciliation Engine
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Verifies 5 core ledger invariants against database anomalies & emits critical alerts to <code className="text-indigo-600 bg-slate-100 px-1 py-0.5 rounded font-mono">reconciliation.alerts</code>
            </p>
          </div>
          <button
            onClick={handleRunAudit}
            disabled={loading}
            className={`self-start sm:self-auto px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 transition-all font-sans cursor-pointer ${
              loading
                ? 'bg-slate-300 text-slate-600 cursor-wait'
                : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
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
          <div key={a.id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="font-semibold text-slate-900 text-xs font-sans truncate">{a.title}</div>
            <p className="text-[11px] text-slate-500 leading-tight h-8 font-sans">{a.desc}</p>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 font-mono text-xs">
              <span className="text-[11px] text-slate-400 font-sans">Violations:</span>
              <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                a.count > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {a.count}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Active Reconciliation Alerts Feed */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            Active Reconciliation Alerts & Kafka Anomaly Feed
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {alerts.length} Total Alerts Detected
          </span>
        </div>

        {alerts.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200 font-sans">
                <tr>
                  <th className="py-3 px-4">Alert Type</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4">Detected At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-amber-700">{alert.alertType}</td>
                    <td className="py-3 px-4 text-slate-500 truncate max-w-[140px]">{alert.entityId}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 font-sans">
                        {alert.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-sans">{alert.details}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(alert.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs font-sans">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/60 mx-auto mb-2" />
            All financial invariants are clean and verified. No ledger anomalies detected.
          </div>
        )}
      </div>
    </div>
  );
}
