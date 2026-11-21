import React, { useState, useEffect } from 'react';
import { Key, ShieldCheck, RefreshCw, Send, CheckCircle2, Clock, XCircle, ArrowUpRight } from 'lucide-react';
import { getWebhookDeliveries, testMockMerchant } from '../services/api';

export default function WebhooksSimulator() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mockTestStatus, setMockTestStatus] = useState(null);

  const loadDeliveries = async () => {
    try {
      const data = await getWebhookDeliveries();
      setDeliveries(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadDeliveries();
    const interval = setInterval(loadDeliveries, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTestMock = async () => {
    setLoading(true);
    setMockTestStatus(null);
    try {
      const res = await testMockMerchant(
        { paymentId: crypto.randomUUID(), status: 'SUCCESS', amount: 100.0 },
        'sha256-demo-verified-signature-sample'
      );
      setMockTestStatus(res);
      await loadDeliveries();
    } catch (e) {
      setMockTestStatus({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              Reliable Webhook Delivery System & HMAC Signatures
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Signed with HMAC-SHA256 (<code className="text-indigo-300">X-Signature</code>), with exponential retry backoff (5s, 30s, 2m, 10m, 30m) & DLQ routing
            </p>
          </div>
          <button
            onClick={handleTestMock}
            disabled={loading}
            className={`px-3 py-1.5 rounded-md font-semibold text-xs flex items-center gap-2 transition-all ${
              loading
                ? 'bg-indigo-600/50 text-indigo-200 cursor-wait'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Test Mock Merchant Webhook
          </button>
        </div>
      </div>

      {mockTestStatus && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-slate-400">Mock Merchant Receiver Response:</span>
            <span className="text-emerald-400 font-bold">HTTP 200 OK</span>
          </div>
          <div className="text-slate-300">Status: {mockTestStatus.status} • Event: {mockTestStatus.event} • HMAC Verified: {String(mockTestStatus.verifiedHmac)}</div>
        </div>
      )}

      {/* Webhook Deliveries Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Live Webhook Deliveries & HMAC Verification
          </h3>
          <button
            onClick={loadDeliveries}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {deliveries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Payment ID</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Attempts</th>
                  <th className="py-2.5 px-3">HMAC-SHA256 Signature</th>
                  <th className="py-2.5 px-3">Target URL</th>
                  <th className="py-2.5 px-3">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {deliveries.map((del) => (
                  <tr key={del.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-slate-200 truncate max-w-[140px]">
                      {del.paymentId}
                    </td>
                    <td className="py-2.5 px-3">
                      {del.status === 'DELIVERED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> DELIVERED
                        </span>
                      )}
                      {del.status === 'RETRYING' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3 animate-spin" /> RETRYING
                        </span>
                      )}
                      {del.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3 h-3" /> DLQ
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{del.attemptCount || 1} / 5</td>
                    <td className="py-2.5 px-3 text-indigo-300 font-mono truncate max-w-[180px]">
                      {del.signature ? del.signature.substring(0, 24) + '...' : 'pending'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 truncate max-w-[180px]">{del.targetUrl}</td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {new Date(del.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs font-mono">
            No webhook deliveries recorded yet. Authorize a transaction to observe live HMAC webhook delivery.
          </div>
        )}
      </div>
    </div>
  );
}
