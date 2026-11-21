import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import TopologyView from './components/TopologyView';
import PaymentTerminal from './components/PaymentTerminal';
import FraudLab from './components/FraudLab';
import TraceInspector from './components/TraceInspector';
import BackpressureController from './components/BackpressureController';
import ReconciliationDashboard from './components/ReconciliationDashboard';
import WebhooksSimulator from './components/WebhooksSimulator';
import LedgerViewer from './components/LedgerViewer';
import { fetchHealth, mintJwtToken } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('topology');
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState('alice');
  const [token, setToken] = useState(null);

  const checkHealth = async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch (e) {
      console.error(e);
    }
  };

  const handleMintToken = async () => {
    try {
      const res = await mintJwtToken(user);
      setToken(res.token);
    } catch (e) {
      console.error('Failed to mint JWT:', e);
    }
  };

  useEffect(() => {
    checkHealth();
    handleMintToken(); // auto mint initial token for alice
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        token={token}
        user={user}
        setUser={setUser}
        onMintToken={handleMintToken}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'topology' && <TopologyView health={health} />}
        {activeTab === 'terminal' && <PaymentTerminal token={token} defaultUser={user} />}
        {activeTab === 'fraud' && <FraudLab />}
        {activeTab === 'tracing' && <TraceInspector />}
        {activeTab === 'backpressure' && <BackpressureController />}
        {activeTab === 'reconciliation' && <ReconciliationDashboard />}
        {activeTab === 'webhooks' && <WebhooksSimulator />}
        {activeTab === 'ledger' && <LedgerViewer />}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500 font-mono">
        Distributed Payment Processing Infrastructure • Spring Cloud Gateway :8090 • Spring Boot :8080 • Python FastAPI ML :8000 • Kafka :9092
      </footer>
    </div>
  );
}
