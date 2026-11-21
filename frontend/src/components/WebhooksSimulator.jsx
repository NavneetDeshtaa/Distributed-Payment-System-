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
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-600" />
              Reliable Webhook Delivery System & HMAC Signatures
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Signed with HMAC-SHA256 (<code className="text-indigo-600 bg-slate-100 px-1 py-0.5 rounded font-mono">X-Signature</code>), with exponential retry backoff (5s, 30s, 2m, 10m, 30m) & DLQ routing
            </p>
          </div>
          <button
            onClick={handleTestMock}
            disabled={loading}
            className={`self-start sm:self-auto px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 transition-all font-sans cursor-pointer ${
              loading
                ? 'bg-slate-300 text-slate-600 cursor-wait'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            Test Mock Merchant Webhook
          </button>
        </div>
      </div>

      {mockTestStatus && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-mono space-y-1.5 text-emerald-900">
          <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200">
            <span className="font-sans font-semibold">Mock Merchant Webhook Receiver:</span>
            <span className="font-bold">HTTP 200 OK</span>
          </div>
          <div className="text-emerald-800 text-[11px]">
            Status: {mockTestStatus.status} • Event: {mockTestStatus.event} • HMAC Signature Verified: {String(mockTestStatus.verifiedHmac)}
          </div>
        </div>
      )}

      {/* Webhook Deliveries Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Live Webhook Deliveries & HMAC Verification
          </h3>
          <button
            onClick={loadDeliveries}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-sans"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {deliveries.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200 font-sans">
                <tr>
                  <th className="py-3 px-4">Payment ID</th>
                  <th className="py-3 px-4">Delivery Status</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4">HMAC-SHA256 Signature</th>
                  <th className="py-3 px-4">Target URL</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                {deliveries.map((del) => (
                  <tr key={del.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900 truncate max-w-[140px]">
                      {del.paymentId}
                    </td>
                    <td className="py-3 px-4">
                      {del.status === 'DELIVERED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> DELIVERED
                        </span>
                      )}
                      {del.status === 'RETRYING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3 animate-spin" /> RETRYING
                        </span>
                      )}
                      {del.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3" /> DLQ
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{del.attemptCount || 1} / 5</td>
                    <td className="py-3 px-4 text-indigo-600 truncate max-w-[180px]">
                      {del.signature ? del.signature.substring(0, 24) + '...' : 'pending'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 truncate max-w-[180px]">{del.targetUrl}</td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {new Date(del.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs font-sans">
            No webhook deliveries recorded yet. Authorize a transaction to observe live HMAC webhook delivery.
          </div>
        )}
      </div>
    </div>
  );
}
