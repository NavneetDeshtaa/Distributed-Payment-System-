import React, { useState } from 'react';
import { Send, RefreshCw, CheckCircle2, XCircle, Clock, ShieldCheck, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';
import { submitPayment, getPayment, getLedgerForPayment } from '../services/api';

export default function PaymentTerminal({ token, defaultUser = 'alice', onPaymentComplete }) {
  const [userId, setUserId] = useState(defaultUser);
  const [merchantId, setMerchantId] = useState('m1');
  const [amount, setAmount] = useState('50.00');
  const [currency, setCurrency] = useState('USD');
  const [idempotencyKey, setIdempotencyKey] = useState(crypto.randomUUID());
  const [useGateway, setUseGateway] = useState(true);

  const [loading, setLoading] = useState(false);
  const [currentPayment, setCurrentPayment] = useState(null);
  const [paymentLedger, setPaymentLedger] = useState([]);
  const [error, setError] = useState(null);

  const handleGenerateKey = () => {
    setIdempotencyKey(crypto.randomUUID());
  };

  const setPreset = (amt, curr = 'USD') => {
    setAmount(amt);
    setCurrency(curr);
    setIdempotencyKey(crypto.randomUUID());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCurrentPayment(null);
    setPaymentLedger([]);

    try {
      const payload = {
        userId,
        merchantId,
        amount: parseFloat(amount),
        currency
      };

      // 1. Ingestion Request
      const res = await submitPayment(payload, idempotencyKey, token, useGateway);
      if (res.status >= 400) {
        throw new Error(res.data?.message || `HTTP ${res.status}: ${JSON.stringify(res.data)}`);
      }

      const initialData = res.data;
      setCurrentPayment(initialData);

      // 2. Poll for async settlement (Outbox -> Kafka -> Python ML -> Settle)
      const paymentId = initialData.id;
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const updated = await getPayment(paymentId);
          setCurrentPayment(updated);

          if (updated.status === 'SUCCESS' || updated.status === 'FRAUD_REJECTED' || attempts >= 8) {
            clearInterval(pollInterval);
            setLoading(false);

            if (updated.status === 'SUCCESS') {
              const entries = await getLedgerForPayment(paymentId);
              setPaymentLedger(entries);
            }
            if (onPaymentComplete) onPaymentComplete();
          }
        } catch (err) {
          clearInterval(pollInterval);
          setLoading(false);
        }
      }, 1000);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Payment Form */}
      <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-400" />
              Ingestion Terminal
            </h2>
            <p className="text-xs text-slate-400">
              Submit transactions via Edge Gateway with JWT auth & Idempotency Key
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">Route via Gateway</span>
            <button
              type="button"
              onClick={() => setUseGateway(!useGateway)}
              className={`w-9 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                useGateway ? 'bg-indigo-600 justify-end' : 'bg-slate-700 justify-start'
              }`}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md" />
            </button>
          </div>
        </div>

        {/* Quick Test Presets */}
        <div className="mb-4">
          <label className="text-[11px] font-mono uppercase text-slate-400 block mb-1.5">Quick Presets</label>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => setPreset('25.00', 'USD')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono border border-slate-700"
            >
              $25.00 Clean
            </button>
            <button
              type="button"
              onClick={() => setPreset('500.00', 'USD')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono border border-slate-700"
            >
              $500.00 Mid-Tier
            </button>
            <button
              type="button"
              onClick={() => setPreset('15000.00', 'USD')}
              className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-mono border border-rose-500/30 flex items-center gap-1"
            >
              <ShieldAlert className="w-3 h-3 text-rose-400" />
              $15k Rule Breach
            </button>
            <button
              type="button"
              onClick={() => setPreset('50.00', 'XYZ')}
              className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30"
            >
              XYZ Currency Breach
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Payer (User ID)</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Merchant ID</label>
              <input
                type="text"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="USD">USD - United States Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="INR">INR - Indian Rupee</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="XYZ">XYZ - Non-Allowlisted (Fraud Test)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400">Idempotency-Key Header</label>
              <button
                type="button"
                onClick={handleGenerateKey}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> New UUID
              </button>
            </div>
            <input
              type="text"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-slate-300 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>

          {error && (
            <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 rounded-md font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
              loading
                ? 'bg-indigo-600/50 text-indigo-200 cursor-wait'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing Transaction & Polyglot Fraud ML...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Authorize Payment ({amount} {currency})
              </>
            )}
          </button>
        </form>
      </div>

      {/* Transaction & Settlement State */}
      <div className="lg:col-span-6 space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-full flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Live Transaction Monitor
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Inspect instant HTTP response and asynchronous lifecycle updates
            </p>

            {currentPayment ? (
              <div className="space-y-4 text-xs font-mono">
                {/* Status Card */}
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Payment ID:</span>
                    <span className="text-white select-all">{currentPayment.id}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Amount & Currency:</span>
                    <span className="font-bold text-white">{currentPayment.amount} {currentPayment.currency}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400">Payer & Merchant:</span>
                    <span className="text-slate-300">{currentPayment.userId} &rarr; {currentPayment.merchantId}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                    <span className="text-slate-400">Status:</span>
                    <div>
                      {currentPayment.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          <Clock className="w-3.5 h-3.5 animate-spin" /> PENDING (Evaluating ML)
                        </span>
                      )}
                      {currentPayment.status === 'SUCCESS' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" /> SUCCESS (Settled)
                        </span>
                      )}
                      {currentPayment.status === 'FRAUD_REJECTED' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30">
                          <XCircle className="w-3.5 h-3.5" /> FRAUD_REJECTED
                        </span>
                      )}
                    </div>
                  </div>
                  {currentPayment.idempotentReplay && (
                    <div className="mt-2 text-xs text-amber-400 font-semibold flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5" /> Cached Idempotent Replay (Zero DB write)
                    </div>
                  )}
                </div>

                {/* Double Entry Ledger Entries */}
                {paymentLedger.length > 0 && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                    <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center justify-between">
                      <span>Double-Entry Ledger Invariant Recorded:</span>
                      <span className="text-emerald-400">&Sigma; DEBIT = &Sigma; CREDIT</span>
                    </div>
                    <div className="space-y-1.5">
                      {paymentLedger.map((e) => (
                        <div key={e.id} className="flex items-center justify-between text-[11px] p-1.5 rounded bg-slate-900 border border-slate-800/80">
                          <span className={e.entryType === 'DEBIT' ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                            {e.entryType}
                          </span>
                          <span className="text-slate-300 font-mono">{e.amount} {e.currency}</span>
                          <span className="text-slate-500 truncate max-w-[150px]">{e.accountId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-48 border border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center text-slate-500 text-xs font-mono">
                <Send className="w-8 h-8 mb-2 opacity-30 text-indigo-400" />
                Submit a payment above to monitor its async ML lifecycle
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-mono mt-4 pt-3 border-t border-slate-800/80">
            Phase 2 Outbox guarantees at-least-once Kafka publishing; Phase 3 processed_events table ensures exactly-once execution.
          </div>
        </div>
      </div>
    </div>
  );
}
