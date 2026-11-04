from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pathlib import Path
import csv
import joblib
import re
import os

app = FastAPI()

# Keep browser access restricted to known frontend origins. Add deployment origins
# through ALLOWED_ORIGINS rather than widening this to a wildcard.
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,https://looped-frontend.onrender.com",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

BASE_DIR = Path(__file__).resolve().parent

model = joblib.load(BASE_DIR / "looped_status_model.pkl")
job_model = joblib.load(BASE_DIR / "job_related_model.pkl")


STATE_NAMES = {}
CITIES_BY_STATE = {}

locations_path = BASE_DIR / "data" / "locations.csv"

with locations_path.open(
    newline="",
    encoding="utf-8-sig"
) as file:
    reader = csv.DictReader(file)

    for row in reader:
        state_name = row["state_name"].strip()
        state_code = row["state_code"].strip().upper()
        city = row["city"].strip()

        STATE_NAMES[state_code] = state_name

        if state_code not in CITIES_BY_STATE:
            CITIES_BY_STATE[state_code] = []

        CITIES_BY_STATE[state_code].append(city)


# Longer city names must be checked first.
# This prevents "View, CA" from winning over "Mountain View, CA".
for state_code in CITIES_BY_STATE:
    CITIES_BY_STATE[state_code].sort(
        key=len,
        reverse=True
    )

CITY_STATE_LOOKUP = {}
STATE_NAME_TO_CODE = {}

for state_code, state_name in STATE_NAMES.items():
    STATE_NAME_TO_CODE[state_name.lower()] = state_code

    for city in CITIES_BY_STATE.get(state_code, []):
        CITY_STATE_LOOKUP[
            (city.lower(), state_code)
        ] = city

STATE_CODE_PATTERN = "|".join(
    sorted(
        (re.escape(code) for code in STATE_NAMES),
        key=len,
        reverse=True
    )
)

STATE_NAME_PATTERN = "|".join(
    sorted(
        (re.escape(name) for name in STATE_NAMES.values()),
        key=len,
        reverse=True
    )
)

@app.get("/health")
def health():
    return {
        "status": "ok",
        "status_model_loaded": True,
        "job_model_loaded": True
    }

class EmailInput(BaseModel):
    # Bound input sizes so a public endpoint cannot be used to submit arbitrary
    # large email payloads. The client only needs message text for classification.
    subject: str = Field(default="", max_length=500)
    from_email: str = Field(default="", max_length=500)
    snippet: str = Field(default="", max_length=5_000)
    body: str = Field(default="", max_length=30_000)

@app.post("/predict-status")
def predict_status(email: EmailInput):
    text = f"{email.subject} {email.from_email} {email.snippet} {email.body}"

    prediction = model.predict([text])[0]

    confidence = None
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba([text])[0]
        confidence = float(max(probs))

    return {
        "status": prediction,
        "confidence": confidence
    }

@app.post("/parse-email")
def parse_email(email: EmailInput):
    subject = clean_text(email.subject)
    from_email = clean_text(email.from_email)
    snippet = clean_text(email.snippet)
    body = clean_text(email.body)

    full_text = f"{subject} {from_email} {snippet} {body}"

    job_probability = get_job_probability(full_text)
    skip = should_skip_email(full_text, job_probability)

    prediction = model.predict([full_text])[0]

    confidence = None
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba([full_text])[0]
        confidence = float(max(probs))

    return {
        "skip": skip,
        "status": prediction,
        "confidence": confidence,
        "job_confidence": job_probability,

        "application_ref": extract_application_ref(
            subject,
            snippet,
            body
        ),

        "company": extract_company(
            subject,
            from_email,
            body
        ),

        "position": extract_position(
            subject,
            body
        ),

        "location": extract_location(
            subject,
            body
        )
    }

BAD_COMPANY_WORDS = [
    "noreply", "no reply", "notifications", "workday", "greenhouse",
    "lever", "smartrecruiters", "icims", "jobvite", "ashby", "careers",
    "recruiting", "talent", "hiring team", "candidate account", "workable",
    "clearcompany", "sovaassessment", "joining our team", "ensure data",
    "kanz", "jobsforhumanity", "jobgether", "handshake", "indeed", "linkedin",
    "kind regards", "best regards", "early careers", "a position with",
    "the codepath", "microstrategy jobs",
]

SKIP_PHRASES = [
    "verify your candidate account",
    "confirm your email address",
    "complete setup for your candidate account",
    "talent community",
    "job alert",
    "newsletter",
    "prep session",
    "resume tips",
    "autofill your applications",
    "weekly digest",
    "restore your service",
    "order id",
    "courses are open",
    "cyber info session",
    "codepath summer starts",
    "prework",
    "product updates",
    "replit",
    "leetcode",
    "missed opportunity",
    "let's see if this career fits",
    "career fit quiz",
    "come back and complete it today",
]

STRONG_RECRUITING_SIGNALS = [
    "thank you for applying",
    "thanks for applying",
    "application received",
    "received your application",
    "we received your application",
    "application submitted successfully",
    "your application was submitted successfully",
    "status of your application",
    "application update",
    "regret to inform",
    "not been selected",
    "move forward with other candidates",
    "complete your assessment",
    "complete an assessment",
    "online assessment",
    "assessment invitation",
    "coding assessment",
    "schedule your interview",
    "interview invitation",
    "invited to interview",
    "select an interview time",
    "we are pleased to offer",
    "offer letter",
]

def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()

def get_job_probability(text: str) -> float:
    probabilities = job_model.predict_proba([text])[0]
    classes = list(job_model.classes_)

    if 1 not in classes:
        return 0.0

    job_index = classes.index(1)
    return float(probabilities[job_index])


def should_skip_email(text: str, job_probability: float) -> bool:
    low = text.lower()

    # Always skip known noise
    if any(phrase in low for phrase in SKIP_PHRASES):
        return True

    # Confidently job-related
    if job_probability >= 0.55:
        return False

    # Borderline: keep only when specific recruiting language exists
    if job_probability >= 0.30:
        has_strong_signal = any(
            phrase in low for phrase in STRONG_RECRUITING_SIGNALS
        )
        return not has_strong_signal

    # Very low confidence
    return True

def clean_company(name: str) -> str:
    if not name:
        return ""

    name = re.sub(r"[\"'<>]", "", name)
    name = re.sub(r"\(.+?\)", "", name)
    name = re.sub(r"\b(inc|llc|ltd|corp|corporation|company|co)\b\.?", "", name, flags=re.I)
    name = re.sub(r"[-_.]", " ", name)
    name = re.sub(r"\s+", " ", name).strip()

    # Strip trailing comma or punctuation
    name = name.rstrip(",.!")

    # Remove personal name suffixes like ", Mohammad" or ", Thank You"
    name = re.sub(r",\s+[A-Z][a-z]+$", "", name).strip()

    # Remove leading filler words
    name = re.sub(r"^(the|a|an)\s+", "", name, flags=re.I).strip()

    low = name.lower()

    if len(name) < 2 or len(name) > 45:
        return ""

    if any(bad in low for bad in BAD_COMPANY_WORDS):
        return ""

    if any(p in low for p in ["thank you", "your application", "we received", "best regards", "kind regards"]):
        return ""

    return name.title()

def extract_company(subject: str, from_email: str, body: str) -> str:
    text = f"{subject}\n{body}"

    patterns = [
        # specific subject-line patterns first
        r"sign-in link for your application at\s+([A-Za-z0-9&.,'’\- ]{2,60})",
        r"interview opportunity with\s+([A-Za-z0-9&.,'’\- ]{2,60})",
        r"thanks for applying to\s+([A-Za-z0-9&.,'’\- ]{2,60})",
        r"thank you for applying to\s+([A-Za-z0-9&.,'’\- ]{2,60})",
        r"your application (?:with|to)\s+([A-Za-z0-9&.,'’\- ]{2,60})",
        r"recent application with\s+([A-Za-z0-9&.,'’\- ]{2,60})",
        r"thank you for your interest in\s+([A-Za-z0-9&.,'’\- ]{2,60})",
        r"interest in\s+([A-Za-z0-9&.,'’\- ]{2,60})",
        r"application to\s+([A-Za-z0-9&.,'’\- ]{2,60})",
        r"applying to\s+([A-Za-z0-9&.,'’\- ]{2,60})",
        r"applying for.*?at\s+([A-Za-z0-9&.,'’\- ]{2,60})",
        r"sent by the HR team at\s+([A-Za-z0-9&.,'’\- ]{2,80})\s+using",
    ]

    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            company = clean_company(m.group(1))
            if company:
                return company

    # Indeed-style
    m = re.search(r"company logo\s+([A-Za-z0-9&.'\- ]+?)\s+-\s+([A-Za-z ]+,\s*[A-Z]{2}|[A-Za-z ]+)", body, re.I)
    if m:
        company = clean_company(m.group(1))
        if company:
            return company

    # sender display name — only if it doesn't look like a person's name
    m = re.match(r'^"?([^"<@]+)"?\s*<', from_email)
    if m:
        display = m.group(1).strip()
        # Skip if it looks like a person name (two capitalized words, no numbers/symbols)
        is_person_name = bool(re.match(r'^[A-Z][a-z]+ [A-Z][a-z]+$', display))
        if not is_person_name:
            company = clean_company(display)
            if company:
                return company

    # domain fallback
    m = re.search(r"@([A-Za-z0-9.-]+\.[A-Za-z]{2,})", from_email)
    if m:
        domain = m.group(1).lower()
        parts = domain.split(".")
        root = parts[-2] if len(parts) >= 2 else parts[0]

        bad_domains = [
            "gmail", "google", "mail", "workday", "myworkday", "greenhouse",
            "lever", "icims", "workable", "clearcompany", "sovaassessment",
            "jobvite", "brassring", "jobsforhumanity", "jobgether", "handshake",
            "indeed", "linkedin", "microstrategy",
        ]
        if root not in bad_domains:
            company = clean_company(root)
            if company:
                return company

    return "Unknown Company"

def clean_position(position: str) -> str:
    if not position:
        return "Unknown Position"

    position = re.sub(r"\bposition\b", "", position, flags=re.I)
    position = re.sub(r"\bthank you.*$", "", position, flags=re.I)
    # Remove personal names at start (e.g. "Mohammad, thank you for applying")
    position = re.sub(r"^[A-Z][a-z]+,\s+", "", position)
    position = re.sub(r"\s+", " ", position).strip(" -|,.")

    if len(position) < 3:
        return "Unknown Position"

    return position

def extract_position(subject: str, body: str) -> str:
    text = f"{subject}\n{body}"

    patterns = [
        r"application submitted\s+([A-Za-z0-9&,\-()\/ ]{4,100})\s+company logo",
        r"interest in our\s+([A-Za-z0-9&,\-()\/ ]{4,100})\s+position",
        r"role of\s+([A-Za-z0-9&,\-()\/ ]{4,100})",
        r"position of\s+([A-Za-z0-9&,\-()\/ ]{4,100})",
        r"application for\s+([A-Za-z0-9&,\-()\/ ]{4,100})\s+with",
        r"received your application for the\s+([A-Za-z0-9&,\-()\/ ]{4,100})",
        r"for the\s+([A-Za-z0-9&,\-()\/ ]{4,100})\s+position",
        r"applying (?:for|to) the\s+([A-Za-z0-9&,\-()\/ ]{4,100})\s+(?:role|job|opportunity)",
    ]

    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            return clean_position(m.group(1))

    return "Unknown Position"

def extract_application_ref(
    subject: str,
    snippet: str,
    body: str
) -> str:
    text = clean_text(
        f"{subject}\n{snippet}\n{body}"
    )

    patterns = [
        # Ref: 87269
        # Reference: ABC-123
        r"\b(?:ref|reference)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,})\b",

        # Job ID: 3173670
        # Job Id 3173670
        r"\bjob\s*id\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,})\b",

        # Req ID / Requisition ID
        r"\b(?:req|req\.|req\s*id|requisition\s*id)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,})\b",

        # Job Number / Position ID
        r"\b(?:job\s*number|position\s*id)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,})\b",

        # Common standalone employer formats:
        # JR2026500538
        # R2612898
        # 18597BR
        r"\b(JR\d{6,})\b",
        r"\b(R\d{6,})\b",
        r"\b(\d{4,8}BR)\b",
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            text,
            re.I
        )

        if match:
            return match.group(1).upper()

    return ""

def extract_location(subject: str, body: str) -> str:
    text = clean_text(f"{subject}\n{body}")
    low = text.lower()

    if re.search(
        r"\b(fully remote|remote role|remote position|work from home)\b",
        low
    ):
        return "Remote"

    code_match = re.search(
        rf"\b([A-Za-z][A-Za-z.'’\- ]{{1,50}}?)"
        rf"\s*,?\s+({STATE_CODE_PATTERN})\b",
        text,
        re.I
    )

    if code_match:
        raw_city = clean_text(code_match.group(1))
        state_code = code_match.group(2).upper()

        for city in CITIES_BY_STATE.get(state_code, []):
            if re.search(
                rf"\b{re.escape(city)}$",
                raw_city,
                re.I
            ):
                return f"{city}, {state_code}"

    name_match = re.search(
        rf"\b([A-Za-z][A-Za-z.'’\- ]{{1,50}}?)"
        rf"\s*,?\s+({STATE_NAME_PATTERN})\b",
        text,
        re.I
    )

    if name_match:
        raw_city = clean_text(name_match.group(1))
        state_name = name_match.group(2).lower()
        state_code = STATE_NAME_TO_CODE.get(state_name)

        if state_code:
            for city in CITIES_BY_STATE.get(state_code, []):
                if re.search(
                    rf"\b{re.escape(city)}$",
                    raw_city,
                    re.I
                ):
                    return f"{city}, {state_code}"

    return ""
