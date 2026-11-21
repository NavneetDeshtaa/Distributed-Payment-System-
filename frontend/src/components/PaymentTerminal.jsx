import React, { useState } from 'react';
import { Send, RefreshCw, CheckCircle2, XCircle, Clock, ShieldCheck, ArrowRight, ShieldAlert, Sparkles, CreditCard } from 'lucide-react';
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
      <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              Payment Ingestion Terminal
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit transactions via Edge Gateway with JWT auth & Idempotency Key
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">Route via Gateway</span>
            <button
              type="button"
              onClick={() => setUseGateway(!useGateway)}
              className={`w-9 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                useGateway ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-white shadow-xs" />
            </button>
          </div>
        </div>

        {/* Quick Test Presets */}
        <div className="mb-4">
          <label className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block mb-1.5">
            Quick Test Presets
          </label>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => setPreset('25.00', 'USD')}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200"
            >
              $25.00 Standard
            </button>
            <button
              type="button"
              onClick={() => setPreset('500.00', 'USD')}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium border border-slate-200"
            >
              $500.00 Mid-Tier
            </button>
            <button
              type="button"
              onClick={() => setPreset('15000.00', 'USD')}
              className="px-2.5 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium border border-rose-200 flex items-center gap-1"
            >
              <ShieldAlert className="w-3 h-3 text-rose-600" />
              $15k Limit Breach
            </button>
            <button
              type="button"
              onClick={() => setPreset('50.00', 'XYZ')}
              className="px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium border border-amber-200"
            >
              XYZ Currency Breach
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-600 block mb-1 font-sans">Payer (User ID)</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="text-slate-600 block mb-1 font-sans">Merchant ID</label>
              <input
                type="text"
                value={merchantId}
                onChange={(e) => setMerchantId(e.target.value)}
                required
                className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-600 block mb-1 font-sans">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="text-slate-600 block mb-1 font-sans">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors cursor-pointer"
              >
                <option value="USD">USD - US Dollar</option>
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
              <label className="text-slate-600 font-sans">Idempotency-Key Header</label>
              <button
                type="button"
                onClick={handleGenerateKey}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-sans font-medium"
              >
                <RefreshCw className="w-3 h-3" /> New UUID
              </button>
            </div>
            <input
              type="text"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              required
              className="w-full bg-slate-50/50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 text-[11px] focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors font-mono"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all font-sans ${
              loading
                ? 'bg-slate-300 text-slate-600 cursor-wait'
                : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing Transaction & ML Fraud Screening...
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
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs h-full flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-1 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              Live Transaction Monitor
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Observe instant HTTP 201 response and asynchronous double-entry settlement
            </p>

            {currentPayment ? (
              <div className="space-y-4 text-xs font-mono">
                {/* Status Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Payment ID:</span>
                    <span className="text-slate-900 font-semibold select-all">{currentPayment.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Amount & Currency:</span>
                    <span className="font-bold text-slate-900">{currentPayment.amount} {currentPayment.currency}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Payer &rarr; Merchant:</span>
                    <span className="text-slate-700">{currentPayment.userId} &rarr; {currentPayment.merchantId}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <span className="text-slate-500">Status:</span>
                    <div>
                      {currentPayment.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                          <Clock className="w-3.5 h-3.5 animate-spin" /> PENDING (Evaluating ML)
                        </span>
                      )}
                      {currentPayment.status === 'SUCCESS' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> SUCCESS (Settled)
                        </span>
                      )}
                      {currentPayment.status === 'FRAUD_REJECTED' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                          <XCircle className="w-3.5 h-3.5" /> FRAUD_REJECTED
                        </span>
                      )}
                    </div>
                  </div>
                  {currentPayment.idempotentReplay && (
                    <div className="mt-2 text-xs text-amber-700 font-semibold flex items-center gap-1 bg-amber-50 p-1.5 rounded border border-amber-200">
                      <RefreshCw className="w-3.5 h-3.5" /> Cached Idempotent Replay (Zero DB write)
                    </div>
                  )}
                </div>

                {/* Double Entry Ledger Entries */}
                {paymentLedger.length > 0 && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="text-xs font-semibold text-slate-700 flex items-center justify-between font-sans">
                      <span>Double-Entry Ledger Invariant:</span>
                      <span className="text-emerald-700 font-mono text-[11px]">&Sigma; DEBIT = &Sigma; CREDIT</span>
                    </div>
                    <div className="space-y-1.5">
                      {paymentLedger.map((e) => (
                        <div key={e.id} className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                          <span className={e.entryType === 'DEBIT' ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                            {e.entryType}
                          </span>
                          <span className="text-slate-800 font-mono font-medium">{e.amount} {e.currency}</span>
                          <span className="text-slate-400 truncate max-w-[150px]">{e.accountId}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-48 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 text-xs font-sans">
                <Send className="w-8 h-8 mb-2 opacity-30 text-indigo-600" />
                Submit a payment above to monitor its async ML lifecycle
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 font-sans mt-4 pt-3 border-t border-slate-100">
            Phase 2 Outbox guarantees at-least-once Kafka publishing; Phase 3 processed_events table ensures exactly-once execution.
          </p>
        </div>
      </div>
    </div>
  );
}
