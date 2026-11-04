import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report

df = pd.read_csv("job_relevance_training_data.csv")

df["text"] = (
    df["subject"].fillna("") + " " +
    df["from"].fillna("") + " " +
    df["snippet"].fillna("") + " " +
    df["body"].fillna("")
)

X = df["text"]
y = df["is_job_related"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = Pipeline([
    ("tfidf", TfidfVectorizer(stop_words="english")),
    ("clf", LogisticRegression(max_iter=2000, class_weight='balanced'))
])

model.fit(X_train, y_train)

preds = model.predict(X_test)

print("\nJOB RELEVANCE MODEL RESULTS:\n")
print(classification_report(y_test, preds))

joblib.dump(model, "job_related_model.pkl")

print("Saved: job_related_model.pkl")