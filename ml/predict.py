import pandas as pd
import numpy as np
from sklearn.base import BaseEstimator, ClassifierMixin
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import LabelEncoder

# ✅ Step 1: Load and train on real labeled data
train_df = pd.read_csv("AllClassification.csv")

# Binning percentage_score into categories
bins = [0, 25, 50, 75, 100]
labels = ['Poor', 'Average', 'Good', 'Best']
train_df['score_category'] = pd.cut(train_df['percentage_score'], bins=bins, labels=labels, include_lowest=True)

encoder = LabelEncoder()
train_df['score_category'] = encoder.fit_transform(train_df['score_category'])

drop_cols = ['percentage_score', 'url', 'category', 'Expect-CT', 'X-XSS-Protection']
for col in drop_cols:
    if col in train_df.columns:
        train_df = train_df.drop(columns=col)

X_train = train_df.drop(columns=["score_category"])
y_train = train_df["score_category"]

# ✅ Step 2: Prepare prediction input
test_df = pd.read_csv("../processed_results.csv")
urls = test_df["url"]

# Drop unnecessary columns if they exist
for col in ['Expect-CT', 'X-XSS-Protection']:
    if col in test_df.columns:
        test_df = test_df.drop(columns=col)

X_test = test_df.drop(columns=["url"])

# ✅ Step 3: Header importance (same as training)
header_importance = {
    'Content-Security-Policy': 15,
    'Strict-Transport-Security': 12,
    'X-Content-Type-Options': 10,
    'Referrer-Policy': 8,
    'Permissions-Policy': 8,
    'Cross-Origin-Opener-Policy': 6,
    'Cross-Origin-Resource-Policy': 6,
    'Cross-Origin-Embedder-Policy': 5,
    'X-Frame-Options': 3
}
model_headers = list(header_importance.keys())

# Add missing columns to both sets
for header in model_headers:
    if header not in X_train.columns:
        X_train[header] = 0
    if header not in X_test.columns:
        X_test[header] = 0

X_train = X_train[model_headers]
X_test = X_test[model_headers]

# ✅ Step 4: Custom model definition
class SuperEnhancedHeaderImportanceForest(BaseEstimator, ClassifierMixin):
    def __init__(self, n_estimators=150, max_depth=12, min_samples_split=8, max_features=0.75, random_state=None):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.max_features = max_features
        self.random_state = random_state
        self.trees = []

    def fit(self, X, y):
        np.random.seed(self.random_state)
        self.classes_ = np.unique(y)
        self.trees = []
        for _ in range(self.n_estimators):
            idx = np.random.choice(len(X), size=len(X), replace=True)
            X_sample, y_sample = X.iloc[idx], y.iloc[idx]
            features = np.random.choice(
                X.columns,
                size=int(self.max_features * len(X.columns)),
                replace=False,
                p=self._importance_weights(X.columns)
            )
            tree = DecisionTreeClassifier(
                max_depth=self.max_depth,
                min_samples_split=self.min_samples_split,
                random_state=np.random.randint(0, 10000)
            )
            tree.fit(X_sample[features], y_sample)
            self.trees.append((tree, features))
        return self

    def predict(self, X):
        preds = np.zeros((len(X), len(self.classes_)))
        for tree, features in self.trees:
            probs = tree.predict_proba(X[features])
            preds[:, :probs.shape[1]] += probs
        return np.argmax(preds, axis=1)

    def _importance_weights(self, features):
        weights = np.array([header_importance.get(f, 1) for f in features], dtype=np.float64)
        return weights / np.sum(weights)

# ✅ Step 5: Train model and predict
model = SuperEnhancedHeaderImportanceForest(random_state=42)
model.fit(X_train, y_train)
preds = model.predict(X_test)
categories = encoder.inverse_transform(preds)

# ✅ Step 6: Save predictions
output_df = pd.DataFrame({
    "url": urls,
    "prediction": categories
})
output_df.to_csv("../predictions_results.csv", index=False)
print("✅ Prediction complete.")
