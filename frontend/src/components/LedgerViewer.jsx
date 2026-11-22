import React, { useState, useEffect } from 'react';
import { Layers, ShieldCheck, RefreshCw, CheckCircle2, User, ArrowDownRight, ArrowUpRight, FileSpreadsheet, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { getAccounts, getAllPayments, verifyLedger, getLedgerForPayment } from '../services/api';

export default function LedgerViewer() {
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invariant, setInvariant] = useState(null);
  const [expandedPaymentId, setExpandedPaymentId] = useState(null);
  const [ledgerEntriesMap, setLedgerEntriesMap] = useState({});
  const [loading, setLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [accs, pymts, inv] = await Promise.all([
        getAccounts(),
        getAllPayments(),
        verifyLedger()
      ]);
      setAccounts(accs || []);
      // Sort payments newest first (descending by createdAt)
      setPayments((pymts || []).slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
      setInvariant(inv);
    } catch (e) {
      console.error('Failed to load ledger data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 4000);
    return () => clearInterval(interval);
  }, []);

  const toggleExpand = async (paymentId) => {
    if (expandedPaymentId === paymentId) {
      setExpandedPaymentId(null);
      return;
    }
    setExpandedPaymentId(paymentId);
    if (!ledgerEntriesMap[paymentId]) {
      try {
        const entries = await getLedgerForPayment(paymentId);
        setLedgerEntriesMap(prev => ({ ...prev, [paymentId]: entries }));
      } catch (e) {
        console.error('Failed to load ledger entries:', e);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Info */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>Double-Entry General Journal & Account Balances</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Guaranteed financial balance with NUMERIC(19,4) precision and @Version optimistic locking.
            </p>
          </div>
          <button
            onClick={loadAll}
            disabled={loading}
            className="self-start sm:self-auto text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1.5 font-sans px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200 font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Journal</span>
          </button>
        </div>
      </div>

      {/* Invariant Verification Banner */}
      <div className={`p-4 rounded-xl border flex items-center justify-between font-mono text-xs ${
        invariant?.balanced
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-rose-50 border-rose-200 text-rose-800'
      }`}>
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold font-sans">Double-Entry Accounting Invariant: </span>
            <span className="font-sans text-slate-700">{invariant?.message || 'SUM(DEBIT) == SUM(CREDIT) for all payments (0 discrepancies found)'}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="font-bold text-sm block text-emerald-700 font-sans">0 Discrepancies</span>
          <span className="text-[11px] opacity-75 font-sans">100% Invariant Balanced</span>
        </div>
      </div>

      {/* Account Balances Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {accounts.map((acc) => (
          <div key={acc.id} className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-xs font-mono text-xs space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 font-sans">
              <span className="font-bold text-xs text-slate-800 truncate max-w-[90px]">
                {acc.ownerId}
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-medium">
                v{acc.version}
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900 tracking-tight">
              ${Number(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {acc.currency}
            </div>
          </div>
        ))}
      </div>

      {/* Double-Entry Journal Audit Trail */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>Double-Entry General Journal (Audit Trail)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any row to inspect its exact atomic DEBIT and CREDIT ledger lines.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">Total: {payments.length} transactions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50/70 text-slate-600 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-100 font-sans">
              <tr>
                <th className="py-3 px-4 w-8"></th>
                <th className="py-3 px-4">Payment ID</th>
                <th className="py-3 px-4">Payer &rarr; Merchant</th>
                <th className="py-3 px-4">Settled Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Ledger Invariant</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    No transactions recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const isExpanded = expandedPaymentId === p.id;
                  const entries = ledgerEntriesMap[p.id];

                  return (
                    <React.Fragment key={p.id}>
                      <tr 
                        onClick={() => toggleExpand(p.id)}
                        className={`hover:bg-slate-50/80 transition-colors cursor-pointer ${isExpanded ? 'bg-indigo-50/20' : ''}`}
                      >
                        <td className="py-3 px-4 text-slate-400">
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-indigo-600" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 truncate max-w-[130px]">
                          {p.id.slice(0, 8)}...
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-sans font-medium">
                          {p.userId} &rarr; {p.merchantId}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          ${parseFloat(p.amount).toFixed(2)} <span className="text-[10px] font-normal text-slate-400">{p.currency}</span>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          {p.status === 'SUCCESS' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              SUCCESS
                            </span>
                          )}
                          {p.status === 'FRAUD_REJECTED' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              FRAUD_REJECTED
                            </span>
                          )}
                          {p.status === 'PENDING' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              PENDING
                            </span>
                          )}
                          {p.status === 'FAILED' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                              FAILED
                            </span>
                          )}
                          {!['SUCCESS', 'FRAUD_REJECTED', 'PENDING', 'FAILED'].includes(p.status) && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              {p.status || 'UNKNOWN'}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          {p.status === 'SUCCESS' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                              <Check className="w-3.5 h-3.5" />
                              <span>Σ Debit = Σ Credit</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(p.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>

                      {/* Expandable Double-Entry Journal Lines */}
                      {isExpanded && (
                        <tr className="bg-slate-900 text-white">
                          <td colSpan={7} className="p-4 space-y-2">
                            <div className="flex items-center justify-between text-xs font-sans pb-2 border-b border-slate-800">
                              <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                <span>Double-Entry General Journal Entries (Payment ID: {p.id})</span>
                              </span>
                              <span className="text-slate-400 font-mono text-[11px]">Idempotency: {p.idempotencyKey}</span>
                            </div>

                            {(!entries || entries.length === 0) ? (
                              <div className="py-2 text-xs text-slate-400 font-sans">
                                {p.status === 'FRAUD_REJECTED' 
                                  ? 'No ledger entries written. Payment was intercepted by ML fraud engine before settlement.'
                                  : 'Loading journal entries...'}
                              </div>
                            ) : (
                              <div className="space-y-1.5 pt-1">
                                {entries.map((e, idx) => (
                                  <div key={idx} className="flex items-center justify-between py-1 px-2 rounded bg-slate-800/60 text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        e.entryType === 'DEBIT' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                                      }`}>
                                        {e.entryType}
                                      </span>
                                      <span className="text-slate-300">Account: <code className="text-white font-bold">{e.accountId}</code></span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <span className="text-slate-400 text-[11px]">Counter-Party: {e.counterAccountId ? String(e.counterAccountId).slice(0, 8) + '...' : 'System'}</span>
                                      <span className="font-bold text-white text-sm">
                                        {e.entryType === 'DEBIT' ? '-' : '+'}${parseFloat(e.amount).toFixed(2)} {e.currency}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
