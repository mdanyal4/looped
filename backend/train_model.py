import pandas as pd
import joblib

from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

# Load data
df = pd.read_csv("training_data.csv")
df = df[df["skip_label"] == 0]  # ADD THIS LINE

# Combine text fields
df["text"] = (
    df["subject"].fillna("") + " " +
    df["from"].fillna("") + " " +
    df["snippet"].fillna("") + " " +
    df["body"].fillna("")
)

X = df["text"]
y = df["status_label"]

# Split data
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Build pipeline
model = Pipeline([
    ("tfidf", TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        ngram_range=(1,2),
        max_features=10000
    )),
    ("clf", LogisticRegression(max_iter=3000, class_weight='balanced'))
])

# Train
model.fit(X_train, y_train)

# Evaluate
preds = model.predict(X_test)

print("\nMODEL RESULTS:\n")
print(classification_report(y_test, preds))

# Save model
joblib.dump(model, "looped_status_model.pkl")

print("\nSaved: looped_status_model.pkl")