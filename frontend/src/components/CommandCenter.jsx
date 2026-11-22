import React, { useState, useEffect } from 'react';
import {
  Send,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  CreditCard,
  PlusCircle,
  Wallet,
  Building2,
  Check,
  Copy,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Zap,
  Lock,
  ExternalLink
} from 'lucide-react';
import {
  submitPayment,
  getPayment,
  getAllPayments,
  getAccounts,
  createAccount,
  getLedgerForPayment,
  verifyLedger,
  getOrMintToken
} from '../services/api';

export default function CommandCenter({ activeUser, onSwitchUser, token }) {
  // Accounts & Metrics State
  const [accounts, setAccounts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [ledgerAudit, setLedgerAudit] = useState(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  // New Account Modal State
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [newInitialBalance, setNewInitialBalance] = useState('1000.00');
  const [newCurrency, setNewCurrency] = useState('USD');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [accountError, setAccountError] = useState(null);

  // Payment Terminal Form State
  const [payerId, setPayerId] = useState(activeUser || 'alice');
  const [merchantId, setMerchantId] = useState('m1');
  const [amount, setAmount] = useState('50.00');
  const [currency, setCurrency] = useState('USD');
  const [idempotencyKey, setIdempotencyKey] = useState(crypto.randomUUID());
  const [useGateway, setUseGateway] = useState(true);

  // Transaction In-Flight & Visual Pipeline State
  const [submitting, setSubmitting] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0); // 0: idle, 1: gateway, 2: outbox, 3: kafka, 4: ml, 5: settlement, 6: done
  const [activePayment, setActivePayment] = useState(null);
  const [settledLedger, setSettledLedger] = useState([]);
  const [paymentError, setPaymentError] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Auto-sync payer when activeUser changes in header
  useEffect(() => {
    if (activeUser) {
      setPayerId(activeUser);
    }
  }, [activeUser]);

  // Load all initial data
  const loadData = async () => {
    setLoadingAccounts(true);
    try {
      const [accs, pays, audit] = await Promise.all([
        getAccounts(),
        getAllPayments(),
        verifyLedger().catch(() => null)
      ]);
      setAccounts(accs);
      // Ensure sorted newest first
      setPayments((pays || []).slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)));
      if (audit) setLedgerAudit(audit);
    } catch (e) {
      console.error('Failed to load command center data:', e);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Preset Buttons
  const applyPreset = (amt, curr = 'USD', merchant = 'm1') => {
    setAmount(amt);
    setCurrency(curr);
    setMerchantId(merchant);
    setIdempotencyKey(crypto.randomUUID());
    setPaymentError(null);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(idempotencyKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // Create New Account Handler
  const handleCreateAccountSubmit = async (e) => {
    e.preventDefault();
    if (!newOwnerId.trim()) return;
    setCreatingAccount(true);
    setAccountError(null);
    try {
      const created = await createAccount({
        ownerId: newOwnerId.trim().toLowerCase(),
        initialBalance: newInitialBalance,
        currency: newCurrency
      });
      setShowCreateAccount(false);
      setNewOwnerId('');
      setNewInitialBalance('1000.00');
      await loadData();
      // Auto-select as payer
      setPayerId(created.ownerId);
      if (onSwitchUser) onSwitchUser(created.ownerId);
    } catch (err) {
      setAccountError(err.message);
    } finally {
      setCreatingAccount(false);
    }
  };

  // Submit Payment Flow with Live Pipeline Stepper
  const handleAuthorizePayment = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setPaymentError(null);
    setActivePayment(null);
    setSettledLedger([]);
    setPipelineStep(1); // Step 1: Gateway Ingestion

    try {
      const payload = {
        userId: payerId.trim(),
        merchantId: merchantId.trim(),
        amount: parseFloat(amount),
        currency: currency.trim().toUpperCase()
      };

      // Ensure token exists for gateway
      let currentToken = token;
      if (useGateway && !currentToken) {
        currentToken = await getOrMintToken(payload.userId);
      }

      setPipelineStep(2); // Step 2: Ingested & Stored in Outbox
      const res = await submitPayment(payload, idempotencyKey, currentToken, useGateway);

      if (res.status >= 400) {
        throw new Error(res.data?.message || `HTTP ${res.status}: ${JSON.stringify(res.data)}`);
      }

      const initialData = res.data;
      setActivePayment(initialData);

      // Step 3: Kafka Stream -> Step 4: ML Scoring
      setPipelineStep(3);
      setTimeout(() => setPipelineStep(4), 600);

      // Poll for asynchronous settlement completion
      const paymentId = initialData.id;
      let attempts = 0;
      const pollTimer = setInterval(async () => {
        attempts++;
        try {
          const updated = await getPayment(paymentId);
          setActivePayment(updated);

          if (updated.status === 'SUCCESS' || updated.status === 'FRAUD_REJECTED' || updated.status === 'FAILED' || attempts >= 15) {
            clearInterval(pollTimer);
            setSubmitting(false);

            if (updated.status === 'SUCCESS') {
              setPipelineStep(7); // All 6 distributed steps 100% completed!
              const entries = await getLedgerForPayment(paymentId);
              setSettledLedger(entries);
            } else if (updated.status === 'FRAUD_REJECTED') {
              setPipelineStep(4); // Intercepted at ML Fraud stage
            } else {
              setPipelineStep(5);
            }

            await loadData(); // refresh balances and payments feed
          }
        } catch (err) {
          clearInterval(pollTimer);
          setSubmitting(false);
        }
      }, 900);

    } catch (err) {
      setPaymentError(err.message);
      setSubmitting(false);
      setPipelineStep(0);
    }
  };

  // Calculate Metrics
  const totalVolume = payments
    .filter(p => p.status === 'SUCCESS')
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const successCount = payments.filter(p => p.status === 'SUCCESS').length;
  const fraudCount = payments.filter(p => p.status === 'FRAUD_REJECTED').length;
  const isBalanced = ledgerAudit?.balanced ?? true;

  return (
    <div className="space-y-8 animate-fade-in">

      {/* 1. Stripe-Style Hero KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Metric 1: Total Volume */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Settled Volume</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tracking-tight">
            ${totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{successCount} Successful Settlements</span>
          </div>
        </div>

        {/* Metric 2: Live Ingestion Stream */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Transaction Throughput</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Zap className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tracking-tight">
            {payments.length} <span className="text-sm font-sans font-normal text-slate-500">total</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Transactional Outbox Active</span>
          </div>
        </div>

        {/* Metric 3: ML Fraud Defended */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Fraud Interceptions</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tracking-tight">
            {fraudCount} <span className="text-sm font-sans font-normal text-slate-500">blocked</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-rose-600 font-medium">
            <Lock className="w-3.5 h-3.5" />
            <span>IsolationForest AI Active</span>
          </div>
        </div>

        {/* Metric 4: Ledger Invariant */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Accounting Invariant</span>
            <span className={`p-1.5 rounded-lg ${isBalanced ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900 tracking-tight">
            {isBalanced ? '0 Discrepancy' : 'Imbalance'}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-indigo-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Σ Debit = Σ Credit Invariant</span>
          </div>
        </div>

      </div>

      {/* 2. Interactive Accounts & Wallets Hub */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Wallet className="w-5 h-5 text-indigo-600" />
              <span>Accounts & Liquid Balances</span>
              <span className="text-xs font-normal text-slate-400">({accounts.length} provisioned)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any account card to instantly set it as the active Payer or Payee in the payment terminal.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateAccount(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-all cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Account</span>
            </button>
            <button
              onClick={loadData}
              disabled={loadingAccounts}
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
              title="Refresh balances"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAccounts ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Account Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-4">
          {accounts.map((acc) => {
            const isPayer = acc.ownerId === payerId;
            const isMerchant = acc.ownerId === merchantId;
            const isMerchantType = acc.ownerId.startsWith('m') || acc.ownerId.includes('merchant');

            return (
              <div
                key={acc.id}
                onClick={() => {
                  if (isMerchantType) {
                    setMerchantId(acc.ownerId);
                  } else {
                    setPayerId(acc.ownerId);
                    if (onSwitchUser) onSwitchUser(acc.ownerId);
                  }
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative group ${isPayer
                    ? 'border-indigo-500 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-500'
                    : isMerchant
                      ? 'border-emerald-500 bg-emerald-50/40 shadow-xs ring-1 ring-emerald-500'
                      : 'border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-slate-300'
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isMerchantType ? (
                      <Building2 className={`w-3.5 h-3.5 ${isMerchant ? 'text-emerald-600' : 'text-slate-400'}`} />
                    ) : (
                      <CreditCard className={`w-3.5 h-3.5 ${isPayer ? 'text-indigo-600' : 'text-slate-400'}`} />
                    )}
                    <span className="font-semibold text-xs text-slate-900 truncate max-w-[80px]">
                      {acc.ownerId}
                    </span>
                  </div>
                  {isPayer && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-indigo-600 text-white">
                      Payer
                    </span>
                  )}
                  {isMerchant && !isPayer && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-600 text-white">
                      Payee
                    </span>
                  )}
                </div>

                <div className="mt-2.5">
                  <div className="text-sm font-bold font-mono text-slate-900 tracking-tight">
                    ${parseFloat(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                    {acc.currency} • v{acc.version}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. New Account Modal */}
      {showCreateAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Create New Account</h3>
              </div>
              <button
                onClick={() => setShowCreateAccount(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {accountError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{accountError}</span>
              </div>
            )}

            <form onSubmit={handleCreateAccountSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Account Owner ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. eve, merchant-store, corp-1"
                  value={newOwnerId}
                  onChange={(e) => setNewOwnerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Initial Deposit
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newInitialBalance}
                    onChange={(e) => setNewInitialBalance(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Currency
                  </label>
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white cursor-pointer"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateAccount(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAccount}
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {creatingAccount ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{creatingAccount ? 'Provisioning...' : 'Provision Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Stripe-Style Payment Ingestion & Live Pipeline Stepper */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left Column: Payment Ingestion Form (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Payment Terminal</h3>
                <p className="text-[11px] text-slate-500">Submit authenticated financial transaction</p>
              </div>
            </div>

            {/* Gateway Route Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-500">Route via Gateway</span>
              <button
                type="button"
                onClick={() => setUseGateway(!useGateway)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${useGateway ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${useGateway ? 'translate-x-4' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Quick Test Presets
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => applyPreset('25.00')}
                className="px-2.5 py-1 text-xs rounded-md font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all cursor-pointer"
              >
                $25 Standard
              </button>
              <button
                type="button"
                onClick={() => applyPreset('150.00')}
                className="px-2.5 py-1 text-xs rounded-md font-medium border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all cursor-pointer"
              >
                $150 Order
              </button>
              <button
                type="button"
                onClick={() => applyPreset('15000.00')}
                className="px-2.5 py-1 text-xs rounded-md font-medium border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100/70 transition-all cursor-pointer"
              >
                ⚠ $15k ML Anomaly
              </button>
              <button
                type="button"
                onClick={() => applyPreset('50.00', 'XYZ')}
                className="px-2.5 py-1 text-xs rounded-md font-medium border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100/70 transition-all cursor-pointer"
              >
                XYZ Currency Breach
              </button>
            </div>
          </div>

          {/* Payment Form */}
          <form onSubmit={handleAuthorizePayment} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payer (User ID)
                </label>
                <input
                  type="text"
                  required
                  value={payerId}
                  onChange={(e) => {
                    setPayerId(e.target.value);
                    if (onSwitchUser) onSwitchUser(e.target.value);
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Merchant ID
                </label>
                <input
                  type="text"
                  required
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white cursor-pointer"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="XYZ">XYZ (Invalid/Breach)</option>
                </select>
              </div>
            </div>

            {/* Idempotency Key */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Idempotency-Key Header
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIdempotencyKey(crypto.randomUUID())}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                  >
                    New UUID
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    title="Copy Key"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <input
                type="text"
                required
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                className="w-full px-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
              />
            </div>

            {paymentError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/90 text-rose-700 text-xs flex items-center gap-2.5">
                <XCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span className="font-mono break-all">{paymentError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Processing Distributed Pipeline...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-indigo-400" />
                  <span>Authorize Payment ({amount} {currency})</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Live Pipeline Visualizer & Settlement Inspector (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">Distributed Execution Pipeline</h3>
            </div>
            {activePayment && (
              <div className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono border flex items-center gap-1.5 ${activePayment.status === 'SUCCESS'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : activePayment.status === 'FRAUD_REJECTED'
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : 'bg-amber-50 text-amber-700 border-amber-300'
                }`}>
                {activePayment.status === 'SUCCESS' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                {activePayment.status === 'FRAUD_REJECTED' && <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />}
                {activePayment.status === 'PENDING' && <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />}
                <span>{activePayment.status}</span>
              </div>
            )}
          </div>

          {/* Stepper Pipeline Flow */}
          <div className="space-y-3">
            {[
              { step: 1, title: 'Edge Gateway Ingestion', desc: 'JWT verified, X-Correlation-ID stamped, Idempotency checked' },
              { step: 2, title: 'Transactional Outbox', desc: 'Atomic INSERT into payments & outbox_events tables' },
              { step: 3, title: 'Kafka Event Streaming', desc: 'Published to payment.created topic with partition key' },
              { step: 4, title: 'Python ML Fraud Scorer', desc: 'IsolationForest evaluated anomaly score & Redis velocity' },
              { step: 5, title: 'Double-Entry Settlement', desc: 'Σ Debit = Σ Credit applied to PostgreSQL ledger' },
              { step: 6, title: 'Merchant Webhook Delivery', desc: 'Dispatched with HMAC SHA-256 signature' }
            ].map((s) => {
              const isFraudRejected = activePayment?.status === 'FRAUD_REJECTED' && s.step === 4;
              const isPast = pipelineStep > s.step && !(activePayment?.status === 'FRAUD_REJECTED' && s.step >= 4);
              const isCurrent = pipelineStep === s.step && !isFraudRejected && activePayment?.status !== 'FRAUD_REJECTED';
              const isIdle = pipelineStep === 0;

              return (
                <div
                  key={s.step}
                  className={`p-3 rounded-xl border transition-all flex items-center gap-3.5 ${isFraudRejected
                      ? 'border-rose-400 bg-rose-50/50 shadow-xs'
                      : isCurrent
                        ? 'border-indigo-400 bg-indigo-50/50 shadow-xs'
                        : isPast
                          ? 'border-emerald-200 bg-emerald-50/20 text-slate-800'
                          : 'border-slate-100 bg-slate-50/40 opacity-50'
                    }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isFraudRejected
                      ? 'bg-rose-600 text-white'
                      : isCurrent
                        ? 'bg-indigo-600 text-white animate-pulse'
                        : isPast
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-500'
                    }`}>
                    {isPast ? <Check className="w-4 h-4" /> : isFraudRejected ? '✕' : s.step}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-900">{s.title}</span>
                      {isFraudRejected && (
                        <span className="text-[10px] font-mono text-rose-600 font-semibold uppercase tracking-wider">
                          Fraud Intercepted
                        </span>
                      )}
                      {isCurrent && (
                        <span className="text-[10px] font-mono text-indigo-600 font-semibold uppercase tracking-wider animate-pulse">
                          Processing...
                        </span>
                      )}
                      {isPast && (
                        <span className="text-[10px] font-mono text-emerald-600 font-semibold uppercase tracking-wider">
                          Completed
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Settled Double-Entry Ledger Lines */}
          {settledLedger && settledLedger.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Double-Entry Ledger Verified</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">Payment ID: {activePayment?.id?.slice(0, 8)}...</span>
              </div>
              <div className="space-y-1.5 font-mono text-xs">
                {settledLedger.map((entry, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${entry.entryType === 'DEBIT' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                      {entry.entryType}
                    </span>
                    <span className="text-slate-300 truncate max-w-[140px]">{entry.accountId}</span>
                    <span className="font-bold text-white">${parseFloat(entry.amount).toFixed(2)} {entry.currency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePayment?.status === 'FRAUD_REJECTED' && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-rose-900">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <span>Transaction Intercepted by ML Fraud Engine</span>
              </div>
              <p className="text-rose-700">
                IsolationForest anomaly score or velocity threshold exceeded limit. No ledger entries committed. Zero financial loss.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 5. Real-Time Payment Feed Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-sm">Recent Transaction Stream</h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px]">
                {payments.length} total • showing newest {Math.min(payments.length, 25)}
              </span>
            </div>
            <p className="text-xs text-slate-500">Live ledger events across all accounts in descending chronological order</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-slate-500">Live Polling (5s)</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Payment ID</th>
                <th className="py-3 px-4">Payer</th>
                <th className="py-3 px-4">Merchant</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Idempotency Key</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No transactions recorded yet. Use the terminal above to authorize the first payment.
                  </td>
                </tr>
              ) : (
                payments.slice(0, 25).map((p) => {
                  const isJustCreated = p.id === activePayment?.id;
                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${isJustCreated
                          ? 'bg-indigo-50/70 ring-1 ring-inset ring-indigo-200'
                          : 'hover:bg-slate-50/80'
                        }`}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-900">
                        <div className="flex items-center gap-1.5">
                          {isJustCreated && <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />}
                          <span>{p.id ? p.id.slice(0, 8) + '...' : '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {p.userId || p.payerId || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-xs">
                        {p.merchantId || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        ${parseFloat(p.amount || 0).toFixed(2)} <span className="text-[10px] font-normal text-slate-400">{p.currency || 'USD'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'SUCCESS'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : p.status === 'FRAUD_REJECTED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : p.status === 'FAILED'
                                ? 'bg-slate-100 text-slate-600 border border-slate-300'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'SUCCESS' ? 'bg-emerald-500' : p.status === 'FRAUD_REJECTED' ? 'bg-rose-500' : p.status === 'FAILED' ? 'bg-slate-400' : 'bg-amber-500'
                            }`} />
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400 truncate max-w-[120px]">
                        {p.idempotencyKey}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
