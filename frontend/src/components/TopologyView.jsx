import React from 'react';
import { Network, CheckCircle2, ArrowRight, Zap, Shield, Database, Server, Cpu, Box } from 'lucide-react';

export default function TopologyView({ health }) {
  const nodes = [
    {
      id: 'gateway',
      title: 'Spring Cloud Gateway',
      subtitle: 'Edge API Gateway • Port 8090',
      role: 'Reverse Proxy & JWT Auth',
      color: 'border-blue-200 bg-blue-50/50 text-blue-800',
      status: health?.gateway?.status || 'UP',
      details: 'HS256 Token Verify • Request Enrichment (X-User-Id, X-Correlation-ID) • Circuit Breaker'
    },
    {
      id: 'payment',
      title: 'Payment Core Service',
      subtitle: 'Spring Boot 3.4 • Port 8080',
      role: 'Financial Transaction Engine',
      color: 'border-indigo-200 bg-indigo-50/50 text-indigo-800',
      status: health?.payment?.status || 'UP',
      details: 'Transactional Outbox • Double-Entry Ledger • Idempotent Consumer (processed_events)'
    },
    {
      id: 'fraud',
      title: 'Polyglot Fraud AI',
      subtitle: 'Python FastAPI • Port 8000',
      role: 'Deterministic Rules & ML',
      color: 'border-purple-200 bg-purple-50/50 text-purple-800',
      status: health?.fraud?.status || 'UP',
      details: 'Stage 1 Rules (Redis Velocity, $10k Limit) • Stage 2 IsolationForest ML Anomaly Scoring'
    },
    {
      id: 'kafka',
      title: 'Apache Kafka 7.5 Spine',
      subtitle: 'Event Broker • Port 9092',
      role: 'Asynchronous Event Bus',
      color: 'border-amber-200 bg-amber-50/50 text-amber-800',
      status: 'UP',
      details: 'Topics: payment.created • fraud.request • fraud.result • fraud.alerts • webhook.DLQ'
    },
    {
      id: 'redis',
      title: 'Redis 7 Multi-Layer Cache',
      subtitle: 'In-Memory Store • Port 6380',
      role: 'Sub-ms Idempotency & Rate Limit',
      color: 'border-rose-200 bg-rose-50/50 text-rose-800',
      status: 'UP',
      details: 'Layer 1 Idempotency (24h TTL) • Atomic Lua Token Bucket • Sliding-Window Velocity'
    },
    {
      id: 'postgres',
      title: 'PostgreSQL 15 Ledger DB',
      subtitle: 'Relational DB • Port 5432',
      role: 'System of Financial Record',
      color: 'border-emerald-200 bg-emerald-50/50 text-emerald-800',
      status: 'UP',
      details: 'Double-entry Invariant: SUM(DEBIT) = SUM(CREDIT) • @Version Optimistic Locks • NUMERIC(19,4)'
    }
  ];

  const steps = [
    {
      num: 1,
      title: 'Edge Authentication & Request Enrichment',
      desc: 'Client sends HTTP POST with JWT token. Spring Cloud Gateway validates HMAC-SHA256, extracts sub claim into X-User-Id, injects X-Correlation-ID and x-trace-id, strips the raw auth token, and routes to Payment Core Service.'
    },
    {
      num: 2,
      title: 'Atomic Ingestion & Transactional Outbox Pattern',
      desc: 'Payment Service creates the transaction with status PENDING and simultaneously writes an OutboxEvent (NEW) inside the same atomic PostgreSQL transaction. Client instantly receives HTTP 201. Background poller publishes to payment.created.'
    },
    {
      num: 3,
      title: 'Polyglot Request-Reply Fraud Evaluation',
      desc: 'PaymentEventConsumer routes the message to Kafka topic fraud.request with distributed trace headers. Python FastAPI worker evaluates Stage 1 Deterministic Rules (amount, currency, Redis velocity) and Stage 2 IsolationForest ML anomaly score, publishing to fraud.result.'
    },
    {
      num: 4,
      title: 'Double-Entry Settlement & Reliable HMAC Webhook',
      desc: 'FraudResultConsumer reads the result. If clean: atomically debits payer, credits merchant, records balanced double-entry ledger rows, marks status SUCCESS, and fires HMAC-SHA256 signed webhook with exponential backoff. If fraud: marks status FRAUD_REJECTED.'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Topology Header Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Network className="w-5 h-5 text-indigo-600" />
              Microservices Topology & Health
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-language distributed system architecture with asynchronous event-driven messaging
            </p>
          </div>
          <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> All Microservices Connected & Healthy
          </span>
        </div>

        {/* Nodes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <div key={node.id} className="border border-slate-200 rounded-xl p-4 bg-white hover:border-slate-300 transition-all shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-slate-400">
                    {node.role}
                  </span>
                  <h3 className="font-semibold text-slate-900 text-sm mt-0.5">{node.title}</h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{node.subtitle}</p>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  UP
                </span>
              </div>
              <p className="text-xs text-slate-600 font-mono mt-3 pt-3 border-t border-slate-100 leading-relaxed">
                {node.details}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* End-to-End Request Lifecycle */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-600" />
          End-to-End Request Lifecycle & Distributed Tracing
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {steps.map((s) => (
            <div key={s.num} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {s.num}
                </span>
                <h4 className="font-semibold text-slate-900 text-xs">{s.title}</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed pl-8">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
