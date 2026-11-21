import React from 'react';
import { Network, ArrowRight, Database, Server, Cpu, CheckCircle2, AlertTriangle, ShieldAlert, Zap } from 'lucide-react';

export default function TopologyView({ health }) {
  const nodes = [
    {
      id: 'client',
      title: 'Client / React App',
      subtitle: 'Vite Frontend (Port 3000)',
      role: 'Browser',
      color: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
      status: 'UP'
    },
    {
      id: 'gateway',
      title: 'Spring Cloud Gateway',
      subtitle: 'Edge Gateway (Port 8090)',
      role: 'Reverse Proxy & JWT Auth',
      color: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-400',
      status: health?.gateway?.status || 'UP',
      details: 'HS256 Token Verify • Sub Enrichment • Circuit Breaker'
    },
    {
      id: 'payment',
      title: 'Payment Service',
      subtitle: 'Spring Boot 3 (Port 8080)',
      role: 'Core Financial Engine',
      color: 'border-indigo-500/50 bg-indigo-500/10 text-indigo-400',
      status: health?.payment?.status || 'UP',
      details: 'Transactional Outbox • Idempotency • Ledger Invariant'
    },
    {
      id: 'kafka',
      title: 'Apache Kafka 7.5',
      subtitle: 'Message Broker (Port 9092)',
      role: 'Event Spine',
      color: 'border-amber-500/50 bg-amber-500/10 text-amber-400',
      status: 'UP',
      details: 'Topics: payment.created • fraud.request • fraud.result'
    },
    {
      id: 'fraud',
      title: 'Polyglot Fraud AI',
      subtitle: 'Python FastAPI (Port 8000)',
      role: 'Deterministic + ML Anomaly',
      color: 'border-purple-500/50 bg-purple-500/10 text-purple-400',
      status: health?.fraud?.status || 'UP',
      details: 'Stage 1 Rules (Redis Velocity) • Stage 2 IsolationForest'
    },
    {
      id: 'storage',
      title: 'PostgreSQL 15 & Redis 7',
      subtitle: 'DB & Multi-Layer Cache',
      role: 'Persistent Ledger & Cache',
      color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400',
      status: 'UP',
      details: 'Double-entry Invariant • processed_events EOS • Redis TTL'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-indigo-400" />
              Polyglot Microservices Topology
            </h2>
            <p className="text-xs text-slate-400">
              Interactive high-level architecture with end-to-end request lifecycle and message flows
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3.5 h-3.5" /> All Microservices Connected
            </span>
          </div>
        </div>

        {/* Topology Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <div key={node.id} className={`border rounded-lg p-4 bg-slate-950/60 transition-all ${node.color}`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono tracking-wider uppercase opacity-75">{node.role}</span>
                  <h3 className="font-bold text-white text-sm mt-0.5">{node.title}</h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{node.subtitle}</p>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              {node.details && (
                <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400">
                  {node.details}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lifecycle Flow Diagram */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          End-to-End Request-Reply Flow & Distributed Tracing
        </h3>

        <div className="relative border-l-2 border-indigo-500/30 pl-4 space-y-4 text-xs font-mono">
          <div className="relative">
            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500" />
            <div className="font-semibold text-slate-200">1. Edge Authentication & Request Enrichment</div>
            <p className="text-slate-400 mt-0.5">
              Client sends HTTP POST with <code className="text-indigo-300">Authorization: Bearer &lt;JWT&gt;</code>.
              Spring Cloud Gateway validates HMAC-SHA256, extracts <code className="text-indigo-300">sub</code> into <code className="text-indigo-300">X-User-Id</code>, generates <code className="text-indigo-300">X-Correlation-ID</code>, strips auth token, and routes to Payment Service.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500" />
            <div className="font-semibold text-slate-200">2. Ingestion & Transactional Outbox Pattern</div>
            <p className="text-slate-400 mt-0.5">
              Payment Service atomically persists Payment (<code className="text-amber-300">PENDING</code>) and <code className="text-indigo-300">outbox_events</code> in a single PostgreSQL transaction. Client instantly receives HTTP 201 Created. Outbox poller publishes to Kafka topic <code className="text-indigo-300">payment.created</code>.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-purple-500" />
            <div className="font-semibold text-slate-200">3. Polyglot Asynchronous Fraud Evaluation</div>
            <p className="text-slate-400 mt-0.5">
              Payment consumer forwards to <code className="text-indigo-300">fraud.request</code> with Kafka tracing headers (<code className="text-purple-300">x-trace-id</code>).
              Python FastAPI worker runs Stage 1 (Allowlisted currencies, $10,000 threshold, Redis sliding-window velocity) and Stage 2 (Scikit-Learn IsolationForest anomaly scoring). Result published to <code className="text-indigo-300">fraud.result</code>.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <div className="font-semibold text-slate-200">4. Double-Entry Settlement & Reliable Webhook Dispatch</div>
            <p className="text-slate-400 mt-0.5">
              FraudResultConsumer reads result. If clean: atomically updates balances, records balanced DEBIT/CREDIT ledger entries, marks status <code className="text-emerald-400">SUCCESS</code>, and fires HMAC-SHA256 signed webhook with exponential backoff retry.
              If fraud: marks status <code className="text-rose-400">FRAUD_REJECTED</code> and fires Kafka alert to <code className="text-rose-300">fraud.alerts</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
