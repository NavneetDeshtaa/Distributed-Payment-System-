import React, { useState, useEffect } from 'react';
import { Server, Gauge, ShieldAlert, AlertTriangle, CheckCircle2, RefreshCw, Zap } from 'lucide-react';
import { getBackpressureMetrics, simulateKafkaLag } from '../services/api';

export default function BackpressureController() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadMetrics = async () => {
    try {
      const data = await getBackpressureMetrics();
      setMetrics(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSimulate = async (lag) => {
    setLoading(true);
    try {
      const updated = await simulateKafkaLag(lag);
      setMetrics(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'CRITICAL_THROTTLE_90_PERCENT') {
      return { label: 'CRITICAL THROTTLE (90%)', color: 'bg-rose-500/20 text-rose-400 border-rose-500/40' };
    }
    if (status === 'WARNING_THROTTLE_50_PERCENT') {
      return { label: 'WARNING THROTTLE (50%)', color: 'bg-amber-500/20 text-amber-400 border-amber-500/40' };
    }
    if (status === 'ELEVATED_LAG_WARNING') {
      return { label: 'ELEVATED LAG WARNING', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' };
    }
    return { label: 'NORMAL OPERATION (100%)', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' };
  };

  const badge = getStatusBadge(metrics?.status);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-400" />
              Adaptive Backpressure & Rate Limiter Defense
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Dynamically throttles ingestion rate based on live Kafka consumer lag queries via AdminClient
            </p>
          </div>
          <span className={`text-xs font-mono font-bold px-3 py-1 rounded border ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Real-Time Lag & Throttle Meter */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" />
              Live Consumer Lag & Throttle Factor
            </h3>
            <button
              onClick={loadMetrics}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block mb-1">Kafka Consumer Lag:</span>
              <div className="text-2xl font-bold text-white">{metrics?.currentLag?.toLocaleString() || 0}</div>
              <span className="text-[10px] text-slate-500">Unprocessed messages</span>
            </div>

            <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block mb-1">Throttle Multiplier:</span>
              <div className="text-2xl font-bold text-indigo-400">
                {metrics ? `${(metrics.throttleFactor * 100).toFixed(0)}%` : '100%'}
              </div>
              <span className="text-[10px] text-slate-500">Rate limiter window capacity</span>
            </div>
          </div>

          {/* Interactive Simulation Controls */}
          <div>
            <label className="text-xs font-mono text-slate-400 block mb-2">Simulate Ingestion Backpressure Scenarios:</label>
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <button
                onClick={() => handleSimulate(0)}
                disabled={loading}
                className="p-2.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-center"
              >
                <div className="font-bold">Normal</div>
                <div className="text-[10px] opacity-75">Lag = 0</div>
              </button>

              <button
                onClick={() => handleSimulate(6000)}
                disabled={loading}
                className="p-2.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-center"
              >
                <div className="font-bold">50% Throttle</div>
                <div className="text-[10px] opacity-75">Lag = 6,000</div>
              </button>

              <button
                onClick={() => handleSimulate(12000)}
                disabled={loading}
                className="p-2.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-center"
              >
                <div className="font-bold">90% Throttle</div>
                <div className="text-[10px] opacity-75">Lag = 12,000</div>
              </button>
            </div>
          </div>
        </div>

        {/* Backpressure Rules & Resiliency Architecture */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Throttle Curve & Resilience Architecture
          </h3>

          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
              <div className="flex justify-between font-bold text-slate-200">
                <span>Lag &lt; 1,000</span>
                <span className="text-emerald-400">100% Ingestion Capacity</span>
              </div>
              <p className="text-[11px] text-slate-400">Normal operations, standard rate limiter token bucket.</p>
            </div>

            <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
              <div className="flex justify-between font-bold text-slate-200">
                <span>Lag &ge; 5,000</span>
                <span className="text-amber-400">50% Throttle Multiplier</span>
              </div>
              <p className="text-[11px] text-slate-400">Reduces token bucket rate by 50% to prevent message queue explosion.</p>
            </div>

            <div className="p-3 rounded bg-slate-950 border border-slate-800 space-y-1">
              <div className="flex justify-between font-bold text-slate-200">
                <span>Lag &ge; 10,000</span>
                <span className="text-rose-400">90% Throttle / HTTP 429</span>
              </div>
              <p className="text-[11px] text-slate-400">Aggressively sheds load, protecting downstream microservices from crashing.</p>
            </div>

            <div className="p-3 rounded bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-[11px] leading-relaxed">
              <span className="font-bold block mb-0.5">Graceful Degradation Guarantee:</span>
              If Redis rate limiting becomes unreachable, the system automatically falls back to an in-memory Caffeine cache (50k entries, 2-min TTL) without dropping a single payment.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
