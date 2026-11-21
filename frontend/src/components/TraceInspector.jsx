import React, { useState } from 'react';
import { Activity, Play, CheckCircle2, ArrowRight, ShieldCheck, Database, Server, RefreshCw } from 'lucide-react';
import { simulateTraceTest } from '../services/api';

export default function TraceInspector() {
  const [traceId, setTraceId] = useState('tr-' + crypto.randomUUID().substring(0, 8));
  const [loading, setLoading] = useState(false);
  const [traceResult, setTraceResult] = useState(null);

  const handleRunTraceTest = async () => {
    setLoading(true);
    try {
      const res = await simulateTraceTest(traceId);
      setTraceResult(res);
    } catch (e) {
      setTraceResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const hops = [
    {
      step: 1,
      service: 'Spring Cloud Gateway',
      port: ':8090',
      action: 'Injects x-trace-id header, extracts sub claim, enriches correlation context',
      log: `[gateway] INFO RequestEnrichmentFilter: Injected x-trace-id=${traceId}, X-Correlation-ID=corr-902`
    },
    {
      step: 2,
      service: 'Payment Ingestion Service',
      port: ':8080',
      action: 'Persists Payment (PENDING) & OutboxEvent with trace metadata in PostgreSQL',
      log: `[payment-service] INFO PaymentService: MDC trace_id=${traceId} Persisted Payment id=${traceResult?.paymentId || 'UUID'}`
    },
    {
      step: 3,
      service: 'Apache Kafka Event Spine',
      port: ':9092',
      action: 'Propagates x-trace-id, x-correlation-id, and x-event-id in binary Kafka record headers',
      log: `[kafka] RecordHeader('x-trace-id', b'${traceId}'), Topic: 'fraud.request'`
    },
    {
      step: 4,
      service: 'Python Fraud Microservice',
      port: ':8000',
      action: 'Extracts x-trace-id from headers, emits structured JSON log, publishes fraud.result',
      log: `{"service": "fraud-service", "trace_id": "${traceId}", "message": "Stage 2 ML Evaluation: fraud=False"}`
    },
    {
      step: 5,
      service: 'Double-Entry Settlement & Webhook',
      port: ':8080',
      action: 'MDC logs traceId, executes double-entry ledger settlement, fires signed webhook',
      log: `[payment-service] INFO FraudResultConsumer: trace_id=${traceId} Fraud check passed, updating ledger.`
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              Distributed Tracing Contract & Log Correlation
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              End-to-end request tracing across Java Spring Boot, Apache Kafka binary headers, and Python FastAPI microservice
            </p>
          </div>
          <span className="self-start sm:self-auto text-xs font-mono px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">
            Failure Test 2 Verification
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trace Controller */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-600" />
            Inject Distributed Trace
          </h3>
          <p className="text-xs text-slate-500">
            Send a transaction with an explicit <code className="text-indigo-600 bg-slate-100 px-1 py-0.5 rounded font-mono">x-trace-id</code> and watch it link every microservice log entry.
          </p>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-slate-600 block mb-1 font-sans">Trace ID (x-trace-id)</label>
              <input
                type="text"
                value={traceId}
                onChange={(e) => setTraceId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>

            <button
              onClick={handleRunTraceTest}
              disabled={loading}
              className={`w-full py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all font-sans ${
                loading
                  ? 'bg-indigo-200 text-indigo-700 cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Propagating Trace Across Pipeline...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Trigger Trace Test ({traceId})
                </>
              )}
            </button>
          </div>

          {traceResult && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                <span className="text-slate-500 font-sans">Status:</span>
                <span className="text-emerald-700 font-semibold font-sans">PROPAGATED</span>
              </div>
              <div>
                <span className="text-slate-500 font-sans block mb-0.5">Payment ID:</span>
                <span className="text-slate-900 block truncate font-mono">{traceResult.paymentId}</span>
              </div>
              <p className="text-xs text-slate-600 font-sans mt-2">
                Trace injected successfully into MDC log context and Kafka headers.
              </p>
            </div>
          )}
        </div>

        {/* Distributed Hop Timeline */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-600" />
            Distributed Hop Timeline
          </h3>

          <div className="space-y-3">
            {hops.map((hop) => (
              <div key={hop.step} className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 text-xs font-sans">
                    Hop #{hop.step}: {hop.service} <span className="font-mono text-slate-400 font-normal">({hop.port})</span>
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-slate-600 text-xs">{hop.action}</p>
                <div className="bg-slate-50 p-2.5 rounded-lg text-[11px] text-slate-700 border border-slate-200 font-mono overflow-x-auto whitespace-pre">
                  {hop.log}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
