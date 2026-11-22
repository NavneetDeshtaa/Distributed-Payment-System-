import time
import redis

ALLOWLISTED_CURRENCIES = {"USD", "EUR", "GBP", "INR", "CAD", "AUD"}
MAX_AMOUNT_THRESHOLD = 10000.00
VELOCITY_WINDOW_SECONDS = 60
VELOCITY_MAX_TXNS = 10

class RuleEngine:
    """
    Stage 1: Deterministic Rules Engine
    1. Currency Allowlist Check
    2. Amount Threshold Rejection (> $10,000)
    3. Sliding-Window Velocity Check via Redis Sorted Sets (>10 txns in 60s)
    """
    def __init__(self, redis_host: str = "127.0.0.1", redis_port: int = 6380):
        try:
            self.redis_client = redis.Redis(
                host=redis_host,
                port=redis_port,
                decode_responses=True,
                socket_timeout=2.0
            )
            self.redis_client.ping()
            self.redis_available = True
        except Exception:
            self.redis_available = False

    def evaluate(self, user_id: str, amount: float, currency: str) -> tuple[bool, str]:
        """
        Evaluates Stage 1 deterministic rules.
        Returns: (is_fraud, rejection_reason)
        """
        # Rule 1: Currency Allowlist
        if currency.upper() not in ALLOWLISTED_CURRENCIES:
            return True, f"Currency '{currency}' is not allowlisted"

        # Rule 2: Amount Threshold
        if amount > MAX_AMOUNT_THRESHOLD:
            return True, f"Transaction amount ${amount:.2f} exceeds threshold limit of ${MAX_AMOUNT_THRESHOLD:.2f}"

        # Rule 3: Sliding-Window Velocity Check via Redis
        if self._check_velocity_violation(user_id):
            return True, f"High-velocity fraud detected: user '{user_id}' exceeded {VELOCITY_MAX_TXNS} txns in {VELOCITY_WINDOW_SECONDS}s"

        return False, ""

    def _check_velocity_violation(self, user_id: str) -> bool:
        """
        Uses Redis Sorted Sets:
        - Key: velocity:<user_id>
        - Score: current epoch timestamp
        - Value: unique timestamp string
        """
        try:
            now = time.time()
            cutoff = now - VELOCITY_WINDOW_SECONDS
            key = f"velocity:{user_id}"

            pipe = self.redis_client.pipeline()
            # 1. Remove expired entries older than 60s
            pipe.zremrangebyscore(key, 0, cutoff)
            # 2. Count current transactions in window
            pipe.zcard(key)
            # 3. Add current transaction
            pipe.zadd(key, {f"{now}_{time.perf_counter_ns()}": now})
            # 4. Refresh TTL
            pipe.expire(key, VELOCITY_WINDOW_SECONDS + 5)
            results = pipe.execute()

            current_count = results[1]
            # If current count is already >= VELOCITY_MAX_TXNS (10), this request (11th+) violates velocity!
            return current_count >= VELOCITY_MAX_TXNS

        except Exception:
            # Graceful degradation if Redis is temporarily offline: allow request
            return False
