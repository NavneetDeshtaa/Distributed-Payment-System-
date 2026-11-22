import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import CommandCenter from './components/CommandCenter';
import TopologyView from './components/TopologyView';
import LedgerViewer from './components/LedgerViewer';
import FraudLab from './components/FraudLab';
import SystemControls from './components/SystemControls';
import { fetchHealth, mintJwtToken, getOrMintToken } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('command');
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState('alice');
  const [token, setToken] = useState(null);
  const [isMintingToken, setIsMintingToken] = useState(false);

  const checkHealth = async () => {
    try {
      const h = await fetchHealth();
      setHealth(h);
    } catch (e) {
      console.error('Health check error:', e);
    }
  };

  const handleMintToken = async () => {
    setIsMintingToken(true);
    try {
      const res = await mintJwtToken(user);
      setToken(res.token);
    } catch (e) {
      console.error('Failed to mint JWT:', e);
    } finally {
      setIsMintingToken(false);
    }
  };

  // Switch active user and auto-acquire token
  const handleSwitchUser = async (newUser) => {
    setUser(newUser);
    try {
      const t = await getOrMintToken(newUser);
      setToken(t);
    } catch (e) {
      console.warn('Could not auto-mint token for', newUser);
    }
  };

  useEffect(() => {
    checkHealth();
    handleSwitchUser(user);
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        health={health}
        token={token}
        user={user}
        setUser={handleSwitchUser}
        onMintToken={handleMintToken}
        isMintingToken={isMintingToken}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'command' && (
          <CommandCenter 
            activeUser={user} 
            onSwitchUser={handleSwitchUser} 
            token={token} 
          />
        )}
        {activeTab === 'topology' && <TopologyView health={health} />}
        {activeTab === 'ledger' && <LedgerViewer />}
        {activeTab === 'fraud' && <FraudLab />}
        {activeTab === 'controls' && <SystemControls />}
      </main>

      <footer className="border-t border-slate-200/80 bg-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 font-mono gap-2">
          <span>FinScale Engine • Distributed Settlement Mesh</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Gateway :8090
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Payment :8080
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Fraud AI :8000
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Kafka :9092
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
