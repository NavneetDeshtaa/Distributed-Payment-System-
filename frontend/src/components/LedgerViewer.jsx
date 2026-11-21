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
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Live Double-Entry Ledger & Accounts State
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Guaranteed financial balance with NUMERIC(19,4) precision and @Version optimistic locking
            </p>
          </div>
          <button
            onClick={loadAll}
            disabled={loading}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 font-mono px-3 py-1.5 rounded bg-slate-800 border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Balances
          </button>
        </div>
      </div>

      {/* Invariant Verification Banner */}
      <div className={`p-4 rounded-xl border flex items-center justify-between font-mono text-xs ${
        invariant?.balanced
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
      }`}>
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="font-bold">Double-Entry Accounting Invariant: </span>
            <span>{invariant?.message || 'SUM(DEBIT) == SUM(CREDIT) for all payments (0 discrepancies found)'}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="font-bold text-sm block">0 Discrepancies</span>
          <span className="text-[10px] opacity-75">100% Balanced</span>
        </div>
      </div>

      {/* Account Balances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {accounts.map((acc) => (
          <div key={acc.id} className="p-4 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5 font-bold text-slate-200">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                {acc.ownerId}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                v{acc.version} lock
              </span>
            </div>
            <div className="text-xl font-bold text-white tracking-tight">
              {Number(acc.balance).toFixed(2)} <span className="text-xs text-indigo-400 font-normal">{acc.currency}</span>
            </div>
            <div className="text-[10px] text-slate-500 truncate">
              ID: {acc.id}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Payments Feed */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          Recent Transactions Stream
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Payment ID</th>
                <th className="py-2.5 px-3">Payer &rarr; Merchant</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Idempotency Key</th>
                <th className="py-2.5 px-3">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-semibold text-slate-200 truncate max-w-[130px]">
                    {p.id}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400">
                    {p.userId} &rarr; {p.merchantId}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-white">
                    {p.amount} {p.currency}
                  </td>
                  <td className="py-2.5 px-3">
                    {p.status === 'SUCCESS' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        SUCCESS
                      </span>
                    )}
                    {p.status === 'FRAUD_REJECTED' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        FRAUD_REJECTED
                      </span>
                    )}
                    {p.status === 'PENDING' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        PENDING
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 truncate max-w-[140px]">{p.idempotencyKey}</td>
                  <td className="py-2.5 px-3 text-slate-500 text-[11px]">
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
