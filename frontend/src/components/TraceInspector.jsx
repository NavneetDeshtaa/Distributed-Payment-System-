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
      action: 'Injects x-trace-id, extracts sub claim, enriches correlation context',
      log: `[gateway] INFO RequestEnrichmentFilter: Injected x-trace-id=${traceId}, X-Correlation-ID=corr-902`
    },
    {
      step: 2,
      service: 'Core Payment Ingestion',
      port: ':8080',
      action: 'Persists Payment (PENDING) & OutboxEvent with trace metadata in PostgreSQL',
      log: `[payment-service] INFO PaymentService: MDC trace_id=${traceId} Persisted Payment id=${traceResult?.paymentId || 'UUID'}`
    },
    {
      step: 3,
      service: 'Apache Kafka Spine',
      port: ':9092',
      action: 'Propagates x-trace-id, x-correlation-id, and x-event-id in binary Kafka headers',
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
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              Distributed Tracing Contract & Log Correlation
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              End-to-end request tracing across Java Spring Boot, Apache Kafka headers, and Python FastAPI microservice
            </p>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
            Failure Test 2 Verification
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trace Controller */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-400" />
            Inject Distributed Trace
          </h3>
          <p className="text-xs text-slate-400">
            Send a transaction with an explicit <code className="text-indigo-300">x-trace-id</code> and watch it link every microservice log entry.
          </p>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">Trace ID (x-trace-id)</label>
              <input
                type="text"
                value={traceId}
                onChange={(e) => setTraceId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              />
            </div>

            <button
              onClick={handleRunTraceTest}
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
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400 font-bold">PROPAGATED</span>
              </div>
              <div>
                <span className="text-slate-400">Payment ID:</span>
                <span className="text-slate-200 block truncate">{traceResult.paymentId}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Trace injected successfully into MDC log context and Kafka headers.
              </p>
            </div>
          )}
        </div>

        {/* Distributed Hop Timeline */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            Distributed Hop Timeline
          </h3>

          <div className="space-y-4">
            {hops.map((hop) => (
              <div key={hop.step} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-300">
                    Hop #{hop.step}: {hop.service} ({hop.port})
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-slate-400 text-[11px]">{hop.action}</p>
                <div className="bg-slate-900 p-2 rounded text-[10px] text-slate-300 border border-slate-800 overflow-x-auto whitespace-pre">
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
