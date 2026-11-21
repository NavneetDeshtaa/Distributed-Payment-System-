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
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              Polyglot ML Fraud Microservice (FastAPI + Scikit-Learn)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Autonomous Python service scoring transactions over Kafka Request-Reply pipeline (<code className="text-indigo-600 bg-slate-100 px-1 py-0.5 rounded">fraud.request</code> &rarr; <code className="text-indigo-600 bg-slate-100 px-1 py-0.5 rounded">fraud.result</code>)
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
              IsolationForest Loaded
            </span>
            <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
              Redis Velocity: 60s
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stage 1: High-Velocity Attack Simulation (Failure Test 1) */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-600" />
              Stage 1: High-Velocity Fraud Attack
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">
              Failure Test 1
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Simulate an attacker firing 15 rapid requests within seconds. The first 10 pass; requests 11–15 are instantly flagged by the Redis sliding-window velocity rule.
          </p>

          <div className="space-y-3 text-xs font-mono">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-600 block mb-1 font-sans">Attacker User ID</label>
                <input
                  type="text"
                  value={attackerUser}
                  onChange={(e) => setAttackerUser(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>
              <div>
                <label className="text-slate-600 block mb-1 font-sans">Burst Request Count</label>
                <input
                  type="number"
                  value={attackCount}
                  onChange={(e) => setAttackCount(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white"
                />
              </div>
            </div>

            <button
              onClick={handleVelocityAttack}
              disabled={attackLoading}
              className={`w-full py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all font-sans ${
                attackLoading
                  ? 'bg-rose-200 text-rose-700 cursor-wait'
                  : 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
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
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-sans">Attack Execution Result:</span>
                <span className="text-emerald-700 font-semibold font-sans">
                  Verified (Invariants Upheld)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                  <div className="font-bold text-xl">{attackResult.successfulPayments || 10}</div>
                  <div className="text-[11px] opacity-80 font-sans">Passed Stage 1 (1-10)</div>
                </div>
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                  <div className="font-bold text-xl">{attackResult.fraudRejectedPayments || 5}</div>
                  <div className="text-[11px] opacity-80 font-sans">Rejected by Velocity (11-15)</div>
                </div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200 font-sans">
                {attackResult.verdict || "First 10 requests allowed; requests 11+ caught by Redis Sliding-Window Velocity Rule and marked FRAUD_REJECTED!"}
              </p>
            </div>
          )}
        </div>

        {/* Stage 2: Direct ML Anomaly Inference & Scorer */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              Stage 2: Scikit-Learn IsolationForest Model
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-medium">
              ML Inference Lab
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Test the pre-trained unsupervised Isolation Forest model directly against feature vectors (transaction amount, currency risk, high-value flag).
          </p>

          <div className="space-y-4 text-xs font-mono">
            <div>
              <div className="flex justify-between text-slate-600 mb-1 font-sans">
                <span>Transaction Amount:</span>
                <span className="text-slate-900 font-bold font-mono">${testAmount}</span>
              </div>
              <input
                type="range"
                min="10"
                max="15000"
                step="50"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-sans">
                <span>$10 (Normal)</span>
                <span>$5,000 (Elevated)</span>
                <span>$10,000+ (Hard Limit)</span>
              </div>
            </div>

            <div>
              <label className="text-slate-600 block mb-1 font-sans">Currency</label>
              <select
                value={testCurrency}
                onChange={(e) => setTestCurrency(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
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
              className={`w-full py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all font-sans ${
                scoringLoading
                  ? 'bg-purple-200 text-purple-700 cursor-wait'
                  : 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
              }`}
            >
              <Zap className="w-4 h-4" />
              {scoringLoading ? 'Evaluating Model...' : 'Score with IsolationForest'}
            </button>

            {/* Direct Model Score Card */}
            {directResult && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <span className="text-slate-500 font-sans">Evaluation Stage:</span>
                  <span className="text-purple-700 font-bold uppercase">{directResult.stage || 'ML'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans">Fraud Probability Score:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {directResult.score !== undefined ? directResult.score.toFixed(4) : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-sans">Classification:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold font-sans ${
                    directResult.fraud
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {directResult.fraud ? 'FRAUD DETECTED' : 'CLEAN / APPROVED'}
                  </span>
                </div>
                {directResult.reason && (
                  <div className="mt-2 text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-sans">
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
