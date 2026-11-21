import React, { useState } from 'react';
import { Cpu, Zap, ShieldAlert, CheckCircle2, XCircle, Play, BarChart3, RefreshCw, Flame } from 'lucide-react';
import { scoreDirectFraud, simulateVelocityAttack } from '../services/api';

export default function FraudLab() {
  // Direct Model Scoring State
  const [testAmount, setTestAmount] = useState('850.00');
  const [testCurrency, setTestCurrency] = useState('USD');
  const [directResult, setDirectResult] = useState(null);
  const [scoringLoading, setScoringLoading] = useState(false);

  // Velocity Attack State
  const [attackerUser, setAttackerUser] = useState('velocity-attacker-2');
  const [attackCount, setAttackCount] = useState(15);
  const [attackLoading, setAttackLoading] = useState(false);
  const [attackResult, setAttackResult] = useState(null);

  const handleDirectScore = async () => {
    setScoringLoading(true);
    try {
      const res = await scoreDirectFraud({
        payment_id: crypto.randomUUID(),
        user_id: 'user-ml-test',
        amount: parseFloat(testAmount),
        currency: testCurrency,
        trace_id: 'tr-direct-sim'
      });
      setDirectResult(res);
    } catch (e) {
      setDirectResult({ error: e.message });
    } finally {
      setScoringLoading(false);
    }
  };

  const handleVelocityAttack = async () => {
    setAttackLoading(true);
    setAttackResult(null);
    try {
      const res = await simulateVelocityAttack(attackerUser, attackCount);
      setAttackResult(res);
    } catch (e) {
      setAttackResult({ error: e.message });
    } finally {
      setAttackLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-purple-400" />
              Polyglot ML Fraud Microservice (FastAPI + Scikit-Learn)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Autonomous Python service scoring transactions over Kafka Request-Reply pipeline (<code className="text-purple-300">fraud.request</code> &rarr; <code className="text-purple-300">fraud.result</code>)
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
              IsolationForest Loaded
            </span>
            <span className="px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              Redis Velocity Window: 60s
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stage 1: High-Velocity Attack Simulation (Failure Test 1) */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              Stage 1: High-Velocity Fraud Attack
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
              Failure Test 1
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Simulate an attacker firing 15 rapid requests within seconds. The first 10 pass; requests 11–15 are instantly flagged by the Redis sliding-window velocity rule.
          </p>

          <div className="space-y-3 text-xs font-mono">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Attacker User ID</label>
                <input
                  type="text"
                  value={attackerUser}
                  onChange={(e) => setAttackerUser(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Burst Request Count</label>
                <input
                  type="number"
                  value={attackCount}
                  onChange={(e) => setAttackCount(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                />
              </div>
            </div>

            <button
              onClick={handleVelocityAttack}
              disabled={attackLoading}
              className={`w-full py-2.5 rounded-md font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                attackLoading
                  ? 'bg-rose-600/50 text-rose-200 cursor-wait'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20'
              }`}
            >
              {attackLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Executing 15 Rapid Requests...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Launch Velocity Burst Attack (15 Txns)
                </>
              )}
            </button>
          </div>

          {/* Velocity Attack Results */}
          {attackResult && (
            <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-slate-400">Attack Execution Verdict:</span>
                <span className={attackResult.testPassed ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {attackResult.testPassed ? 'PASS (Invariants Confirmed)' : 'CHECKING'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                  <div className="font-bold text-lg">{attackResult.successfulPayments || 10}</div>
                  <div className="opacity-80">Passed Stage 1 (1-10)</div>
                </div>
                <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  <div className="font-bold text-lg">{attackResult.fraudRejectedPayments || 5}</div>
                  <div className="opacity-80">Rejected by Velocity (11-15)</div>
                </div>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed bg-slate-900 p-2.5 rounded border border-slate-800">
                {attackResult.verdict || "First 10 requests allowed; requests 11+ caught by Redis Sliding-Window Velocity Rule and marked FRAUD_REJECTED!"}
              </p>
            </div>
          )}
        </div>

        {/* Stage 2: Direct ML Anomaly Inference & Scorer */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              Stage 2: Scikit-Learn IsolationForest Model
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">
              ML Inference Lab
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Test the pre-trained unsupervised Isolation Forest model directly against feature vectors (transaction amount, currency risk, high-value flag).
          </p>

          <div className="space-y-4 text-xs font-mono">
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Transaction Amount:</span>
                <span className="text-white font-bold">${testAmount}</span>
              </div>
              <input
                type="range"
                min="10"
                max="15000"
                step="50"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                className="w-full accent-purple-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>$10 (Normal)</span>
                <span>$5,000 (Elevated)</span>
                <span>$10,000+ (Hard Limit)</span>
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Currency</label>
              <select
                value={testCurrency}
                onChange={(e) => setTestCurrency(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white"
              >
                <option value="USD">USD (Low Risk)</option>
                <option value="EUR">EUR (Low Risk)</option>
                <option value="INR">INR (Low Risk)</option>
                <option value="XYZ">XYZ (Non-Allowlisted Currency Breach)</option>
              </select>
            </div>

            <button
              onClick={handleDirectScore}
              disabled={scoringLoading}
              className={`w-full py-2.5 rounded-md font-semibold text-xs flex items-center justify-center gap-2 transition-all ${
                scoringLoading
                  ? 'bg-purple-600/50 text-purple-200 cursor-wait'
                  : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20'
              }`}
            >
              <Zap className="w-4 h-4" />
              {scoringLoading ? 'Evaluating Model...' : 'Score with IsolationForest'}
            </button>

            {/* Direct Model Score Card */}
            {directResult && (
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Evaluation Stage:</span>
                  <span className="text-purple-300 font-bold uppercase">{directResult.stage || 'ML'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Fraud Probability Score:</span>
                  <span className="font-bold text-white text-sm">
                    {directResult.score !== undefined ? directResult.score.toFixed(4) : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Classification:</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    directResult.fraud
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {directResult.fraud ? 'FRAUD DETECTED' : 'CLEAN / APPROVED'}
                  </span>
                </div>
                {directResult.reason && (
                  <div className="mt-2 text-[11px] text-amber-300 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                    Reason: {directResult.reason}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
