# Looped

A browser-based job-application tracker that helps organize application emails by
status. It uses Google Gmail sign-in in the browser and a FastAPI service for
classification and structured extraction.

**Built with:** JavaScript, Google Identity Services, FastAPI, scikit-learn,
and joblib.

## What it demonstrates

- OAuth-aware frontend work with Gmail's read-only scope.
- A client-side application tracker with status and follow-up workflows.
- A Python API that classifies application updates and extracts company, role,
  location, and application references.
- Data-cleaning and model-training scripts for approved synthetic fixtures.

## Run locally

```sh
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r backend/requirements.txt
```

The backend uses the included `backend/looped_status_model.pkl` and
`backend/job_related_model.pkl`. The training CSVs and email fixtures included in
this repository are synthetic. Only load repository-controlled pickle/joblib
files; do not load model artifacts from untrusted sources.

To train models from approved data, place `training_data.csv` and `job_relevance_training_data.csv` in `backend/`. From that directory:

```sh
python3 train_model.py
python3 train_job_model.py
uvicorn app:app --reload --port 8000
```

Status CSV columns: `subject,from,snippet,body,status_label,skip_label`.
Relevance CSV columns: `subject,from,snippet,body,is_job_related`.

In a second terminal, serve the project root:

```sh
python3 -m http.server 3000
```

Open http://localhost:3000. Configure your Google OAuth web client in `app.js` with the authorized local origin. The client ID is a public identifier; never embed a client secret or API key in frontend code. The app requests Gmail read-only access. For hosting, review the backend URL in `app.js` and allowed origins in `backend/app.py`.

## Privacy and security

Email-derived application data is stored in browser local storage. To classify a
message, the frontend sends the message fields needed for parsing to the configured
backend. Run a backend you trust, avoid shared browser profiles, and do not use
this project with a shared inbox. The API restricts browser origins to its known
frontends and limits incoming field sizes, but production hosting should also add
rate limiting, HTTPS, monitoring, and an operator privacy notice.

The Google OAuth client ID in `app.js` is a public identifier, not a secret.
In Google Cloud, restrict its authorized JavaScript origins to the development
and deployment URLs you control. Never put an OAuth client secret, API key, or
real inbox export in the frontend or repository.

Environment files, caches, personal notes, and generated local artifacts are
ignored. Keep real inbox exports out of the repository.

`backend/test_emails.py` is a manual HTTP test script requiring `requests` and a running backend. Its fixtures are synthetic.

## Repository note

This source is shared for portfolio and review purposes. Please ask before
reusing it in another project.
