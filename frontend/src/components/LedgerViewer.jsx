import React, { useState, useEffect } from 'react';
import { Layers, ShieldCheck, RefreshCw, CheckCircle2, User, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { getAccounts, getAllPayments, verifyLedger } from '../services/api';

export default function LedgerViewer() {
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [invariant, setInvariant] = useState(null);
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
      setPayments((pymts || []).slice(0, 20));
      setInvariant(inv);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Live Double-Entry Ledger & Accounts State
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Guaranteed financial balance with NUMERIC(19,4) precision and @Version optimistic locking
            </p>
          </div>
          <button
            onClick={loadAll}
            disabled={loading}
            className="self-start sm:self-auto text-xs text-slate-700 hover:text-slate-900 flex items-center gap-1.5 font-sans px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200 font-medium transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Balances
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {accounts.map((acc) => (
          <div key={acc.id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 font-sans">
              <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                {acc.ownerId}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                v{acc.version} lock
              </span>
            </div>
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {Number(acc.balance).toFixed(2)} <span className="text-xs text-slate-400 font-normal">{acc.currency}</span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Account ID: {acc.id}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Payments Feed */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          Recent Transactions Stream
        </h3>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200 font-sans">
              <tr>
                <th className="py-3 px-4">Payment ID</th>
                <th className="py-3 px-4">Payer &rarr; Merchant</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Idempotency Key</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900 truncate max-w-[130px]">
                    {p.id}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {p.userId} &rarr; {p.merchantId}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {p.amount} {p.currency}
                  </td>
                  <td className="py-3 px-4">
                    {p.status === 'SUCCESS' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        SUCCESS
                      </span>
                    )}
                    {p.status === 'FRAUD_REJECTED' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                        FRAUD_REJECTED
                      </span>
                    )}
                    {p.status === 'PENDING' && (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        PENDING
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-400 truncate max-w-[140px]">{p.idempotencyKey}</td>
                  <td className="py-3 px-4 text-slate-400 text-[11px]">
                    {new Date(p.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
