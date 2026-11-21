const GATEWAY_URL = 'http://localhost:8090';
const PAYMENT_URL = 'http://localhost:8080';
const FRAUD_URL = 'http://localhost:8000';

export async function fetchHealth() {
  const checkService = async (url) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (!res.ok) return { status: 'DEGRADED', code: res.status };
      const data = await res.json();
      return { status: data.status || 'UP', data };
    } catch (e) {
      return { status: 'DOWN', error: e.message };
    }
  };

  const [gateway, payment, fraud] = await Promise.all([
    checkService(`${GATEWAY_URL}/actuator/health`),
    checkService(`${PAYMENT_URL}/actuator/health`),
    checkService(`${FRAUD_URL}/health`)
  ]);

  return { gateway, payment, fraud };
}

export async function mintJwtToken(userId = 'alice') {
  const res = await fetch(`${GATEWAY_URL}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role: 'USER' })
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.statusText}`);
  return res.json();
}

export async function submitPayment(paymentData, idempotencyKey, token = null, useGateway = true) {
  const baseUrl = useGateway ? GATEWAY_URL : PAYMENT_URL;
  const headers = {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey || crypto.randomUUID()
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(paymentData)
  });
  const data = await res.json();
  return { status: res.status, data, headers: Object.fromEntries(res.headers.entries()) };
}

export async function getPayment(paymentId) {
  const res = await fetch(`${PAYMENT_URL}/payments/${paymentId}`);
  if (!res.ok) throw new Error('Payment not found');
  return res.json();
}

export async function getAllPayments() {
  const res = await fetch(`${PAYMENT_URL}/payments`);
  if (!res.ok) return [];
  return res.json();
}

export async function getAccounts() {
  const res = await fetch(`${PAYMENT_URL}/accounts`);
  if (!res.ok) return [];
  return res.json();
}

export async function getLedgerForPayment(paymentId) {
  const res = await fetch(`${PAYMENT_URL}/ledger/payments/${paymentId}`);
  if (!res.ok) return [];
  return res.json();
}

export async function verifyLedger() {
  const res = await fetch(`${PAYMENT_URL}/ledger/verify`);
  return res.json();
}

export async function scoreDirectFraud(req) {
  const res = await fetch(`${FRAUD_URL}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  });
  return res.json();
}

export async function simulateVelocityAttack(userId = 'fraud-attacker-1', requestCount = 15) {
  const res = await fetch(`${PAYMENT_URL}/simulation/velocity-attack?userId=${encodeURIComponent(userId)}&requestCount=${requestCount}`, {
    method: 'POST'
  });
  return res.json();
}

export async function simulateTraceTest(traceId) {
  const res = await fetch(`${PAYMENT_URL}/simulation/trace-test?traceId=${encodeURIComponent(traceId)}`, {
    method: 'POST'
  });
  return res.json();
}

export async function getBackpressureMetrics() {
  const res = await fetch(`${PAYMENT_URL}/simulation/backpressure`);
  return res.json();
}

export async function simulateKafkaLag(lag) {
  const res = await fetch(`${PAYMENT_URL}/simulation/backpressure/simulate-lag?lag=${lag}`, {
    method: 'POST'
  });
  return res.json();
}

export async function runReconciliation() {
  const res = await fetch(`${PAYMENT_URL}/simulation/reconciliation/run`, {
    method: 'POST'
  });
  return res.json();
}

export async function getReconciliationAlerts() {
  const res = await fetch(`${PAYMENT_URL}/simulation/reconciliation/alerts`);
  return res.json();
}

export async function getWebhookDeliveries() {
  const res = await fetch(`${PAYMENT_URL}/simulation/webhooks/deliveries`);
  return res.json();
}

export async function testMockMerchant(payload, signature) {
  const res = await fetch(`${PAYMENT_URL}/simulation/webhooks/mock-merchant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature || 'sha256-mock-sig',
      'X-Event': 'payment.succeeded'
    },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload)
  });
  return res.json();
}
