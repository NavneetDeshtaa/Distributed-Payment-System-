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
      return { label: 'CRITICAL THROTTLE (90%)', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    }
    if (status === 'WARNING_THROTTLE_50_PERCENT') {
      return { label: 'WARNING THROTTLE (50%)', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    if (status === 'ELEVATED_LAG_WARNING') {
      return { label: 'ELEVATED LAG WARNING', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' };
    }
    return { label: 'NORMAL OPERATION (100%)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  };

  const badge = getStatusBadge(metrics?.status);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-600" />
              Adaptive Backpressure & Rate Limiter Defense
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Dynamically throttles ingestion rate based on live Kafka consumer lag queries via AdminClient
            </p>
          </div>
          <span className={`self-start sm:self-auto text-xs font-mono font-medium px-3 py-1 rounded-full border ${badge.color}`}>
            {badge.label}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Real-Time Lag & Throttle Meter */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-indigo-600" />
              Live Consumer Lag & Throttle Factor
            </h3>
            <button
              onClick={loadMetrics}
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-sans"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block mb-1 font-sans">Kafka Consumer Lag:</span>
              <div className="text-2xl font-bold text-slate-900">{metrics?.currentLag?.toLocaleString() || 0}</div>
              <span className="text-[11px] text-slate-400 font-sans">Unprocessed messages</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block mb-1 font-sans">Throttle Multiplier:</span>
              <div className="text-2xl font-bold text-indigo-600">
                {metrics ? `${(metrics.throttleFactor * 100).toFixed(0)}%` : '100%'}
              </div>
              <span className="text-[11px] text-slate-400 font-sans">Rate limiter window capacity</span>
            </div>
          </div>

          {/* Interactive Simulation Controls */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-2 font-sans">
              Simulate Ingestion Backpressure Scenarios:
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs font-sans">
              <button
                onClick={() => handleSimulate(0)}
                disabled={loading}
                className="p-3 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-200 text-center transition-all cursor-pointer"
              >
                <div className="font-semibold">Normal</div>
                <div className="text-[11px] text-emerald-600 font-mono">Lag = 0</div>
              </button>

              <button
                onClick={() => handleSimulate(6000)}
                disabled={loading}
                className="p-3 rounded-lg bg-amber-50 hover:bg-amber-100/80 text-amber-800 border border-amber-200 text-center transition-all cursor-pointer"
              >
                <div className="font-semibold">50% Throttle</div>
                <div className="text-[11px] text-amber-600 font-mono">Lag = 6,000</div>
              </button>

              <button
                onClick={() => handleSimulate(12000)}
                disabled={loading}
                className="p-3 rounded-lg bg-rose-50 hover:bg-rose-100/80 text-rose-800 border border-rose-200 text-center transition-all cursor-pointer"
              >
                <div className="font-semibold">90% Throttle</div>
                <div className="text-[11px] text-rose-600 font-mono">Lag = 12,000</div>
              </button>
            </div>
          </div>
        </div>

        {/* Backpressure Rules & Resiliency Architecture */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-600" />
            Throttle Curve & Resilience Architecture
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex justify-between font-semibold text-slate-800">
                <span>Lag &lt; 1,000</span>
                <span className="text-emerald-700 font-mono font-bold">100% Ingestion Capacity</span>
              </div>
              <p className="text-slate-500 text-[11px]">Normal operations, standard rate limiter token bucket.</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex justify-between font-semibold text-slate-800">
                <span>Lag &ge; 5,000</span>
                <span className="text-amber-700 font-mono font-bold">50% Throttle Multiplier</span>
              </div>
              <p className="text-slate-500 text-[11px]">Reduces token bucket rate by 50% to prevent message queue explosion.</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex justify-between font-semibold text-slate-800">
                <span>Lag &ge; 10,000</span>
                <span className="text-rose-700 font-mono font-bold">90% Throttle / HTTP 429</span>
              </div>
              <p className="text-slate-500 text-[11px]">Aggressively sheds load, protecting downstream microservices from crashing.</p>
            </div>

            <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-900 text-xs leading-relaxed">
              <span className="font-semibold block mb-0.5">Graceful Degradation Guarantee:</span>
              If Redis rate limiting becomes unreachable, the system automatically falls back to an in-memory Caffeine cache (50,000 entries, 2-minute TTL) without dropping a single payment.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
