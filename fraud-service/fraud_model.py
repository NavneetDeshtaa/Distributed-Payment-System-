import numpy as np
from sklearn.ensemble import IsolationForest

class FraudMLScorer:
    """
    Stage 2: Machine Learning Scoring using Isolation Forest.
    Scores feature vector: [amount, is_high_value, currency_risk]
    Outputs a normalized anomaly probability score in [0.0, 1.0].
    Decision threshold: score >= 0.75 => Fraud.
    """
    def __init__(self):
        # Synthetic baseline training data representative of normal payment distributions
        # Features: [amount, is_high_value (0 or 1), currency_risk (0 to 1)]
        rng = np.random.RandomState(42)
        normal_amounts = rng.exponential(scale=80.0, size=1500)
        normal_amounts = np.clip(normal_amounts, 1.0, 2500.0)
        is_high_value = (normal_amounts > 1000.0).astype(float)
        currency_risk = rng.choice([0.0, 0.1, 0.2], size=1500, p=[0.7, 0.2, 0.1])
        
        X_train = np.column_stack([normal_amounts, is_high_value, currency_risk])

        self.model = IsolationForest(
            n_estimators=100,
            contamination=0.03,
            random_state=42
        )
        self.model.fit(X_train)

    def score(self, amount: float, currency: str) -> tuple[float, bool]:
        """
        Computes anomaly score.
        Returns: (normalized_score [0.0, 1.0], is_fraud boolean)
        """
        is_high_val = 1.0 if amount > 2000.0 else 0.0
        currency_risk = 0.4 if currency not in ["USD", "EUR", "GBP"] else 0.05
        features = np.array([[amount, is_high_val, currency_risk]])

        # IsolationForest decision_function: lower score = more anomalous
        raw_score = self.model.decision_function(features)[0]
        
        # Normalize decision function to [0.0, 1.0] where 1.0 is highest fraud probability
        # Typical raw_score is in [-0.5, 0.5]
        normalized_score = float(np.clip(0.5 - (raw_score * 1.5), 0.0, 1.0))
        is_fraud = normalized_score >= 0.75

        return round(normalized_score, 4), is_fraud
