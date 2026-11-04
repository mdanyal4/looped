const CLIENT_ID = "601838050189-652r5qgkcp8kta8v726qbi5higk3jpdi.apps.googleusercontent.com";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly"
].join(" ");

const BACKEND_URL =
    window.location.hostname === "localhost"
        ? "http://127.0.0.1:8000"
        : "https://looped-gjya.onrender.com";

let tokenClient;
let gisInited = false;
let accessToken = null;

let extractedData = JSON.parse(
  localStorage.getItem("extractedData") || "[]"
);

let manualEntries = JSON.parse(
  localStorage.getItem("manualEntries") || "[]"
);

let processedEmails = JSON.parse(
  localStorage.getItem("processedEmails") || "[]"
);

function saveAppState() {
  localStorage.setItem(
    "extractedData",
    JSON.stringify(extractedData)
  );

  localStorage.setItem(
    "manualEntries",
    JSON.stringify(manualEntries)
  );

  localStorage.setItem(
    "processedEmails",
    JSON.stringify(processedEmails)
  );
}

let scannedMessageIds = JSON.parse(
  localStorage.getItem("scannedMessageIds") || "[]"
);

const loginBtn       = document.getElementById("loginBtn");
const logoutBtn      = document.getElementById("logoutBtn");
const scanBtn        = document.getElementById("scanBtn");
const sendToSheetsBtn = document.getElementById("sendToSheetsBtn");

const landingView   = document.getElementById("landingView");
const appView       = document.getElementById("appView");
const topbarActions = document.getElementById("topbarActions");

const userChip             = document.getElementById("userChip");
const statusBox            = document.getElementById("statusBox");
const applicationsTableBody = document.getElementById("applicationsTableBody");
const tableSearch = document.getElementById("tableSearch");

const topbarStatus = document.getElementById("topbarStatus");
const topbarStatusText = document.getElementById("topbarStatusText");
let topbarTypingTimer = null;
let topbarClearTimer = null;

const menuBtn = document.getElementById("menuBtn");
const menuDropdown = document.getElementById("menuDropdown");
const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const settingsClose = document.getElementById("settingsClose");
const scanLimitSelect = document.getElementById("scanLimitSelect");
const resetScannedBtn = document.getElementById("resetScannedBtn");
let scanLimit = Number(localStorage.getItem("scanLimit") || 100);
const resetAllBtn = document.getElementById("resetAllBtn");
const contactBtn = document.getElementById("contactBtn");

const addRowBtn = document.getElementById("addRowBtn");
const deleteModeBtn = document.getElementById("deleteModeBtn");
const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");

let deleteMode = false;
let selectedRowsToDelete = new Set();

const taglines = [
  "Turn Gmail into your application sheet.",
  "Track job updates automatically.",
  "Review, edit, and send to Sheets."
];

const privacyBtn = document.getElementById("privacyBtn");
const termsBtn = document.getElementById("termsBtn");
const legalModal = document.getElementById("legalModal");
const legalModalClose = document.getElementById("legalModalClose");
const legalModalTitle = document.getElementById("legalModalTitle");
const legalModalContent = document.getElementById("legalModalContent");

const landingPreviewData = [
  {
    company: "Amazon",
    position: "SDE Intern",
    location: "Seattle, WA",
    status: "Assessment",
    date: "2026-04-18",
    source: "Assessment invitation"
  },
  {
    company: "Deloitte",
    position: "Technology Analyst",
    location: "New York, NY",
    status: "Offer",
    date: "2026-04-14",
    source: "Offer letter"
  },
  {
    company: "Goldman Sachs",
    position: "Summer Analyst",
    location: "New York, NY",
    status: "Rejected",
    date: "2026-04-11",
    source: "Application update"
  },
  {
    company: "Boeing",
    position: "HR Intern",
    location: "Chicago, IL",
    status: "Interview",
    date: "2026-04-08",
    source: "Interview scheduling"
  },
  {
    company: "Some Company",
    position: "Operations Intern",
    location: "Remote",
    status: "Rejected",
    date: "2026-04-06",
    source: "Application update"
  },
  {
    company: "Some Company",
    position: "Business Analyst Intern",
    location: "Boston, MA",
    status: "Assessment",
    date: "2026-04-04",
    source: "Assessment invitation"
  },
  {
    company: "Some Company",
    position: "Software Intern",
    location: "Austin, TX",
    status: "Assessment",
    date: "2026-04-02",
    source: "Next steps"
  },
  {
    company: "Lockheed Martin",
    position: "Technical Intern",
    location: "Remote",
    status: "Applied",
    date: "2026-03-30",
    source: "Application received"
  }
];

const COMPANY_HINTS = [
  "Amazon", "Deloitte", "Leidos", "Boeing", "Lockheed Martin",
  "Elekta", "Applied Materials", "RTX", "Disney", "TikTok",
  "MITRE", "Intuit", "Lucidya", "SEIDOR", "Cvent",
  "Elsevier", "ASCO", "eClinicalWorks", "Lumafield"
];

function findKnownCompany(text) {
  const lower = text.toLowerCase();
  return COMPANY_HINTS.find(c => lower.includes(c.toLowerCase())) || "";
}

function updateButtons() {
  loginBtn.disabled = !gisInited || !!accessToken;
  logoutBtn.disabled = !accessToken;
  scanBtn.disabled = !accessToken;
  sendToSheetsBtn.disabled = extractedData.length === 0;
}

function showLandingView() {
  landingView.classList.remove("hidden");
  appView.classList.add("hidden");
  topbarActions.classList.add("hidden");
  document.body.classList.remove("app-view-active");
}

function showAppView() {
  landingView.classList.add("hidden");
  appView.classList.remove("hidden");
  topbarActions.classList.remove("hidden");
  document.body.classList.add("app-view-active");
}

function initializeGisClient() {
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async (response) => {
        if (response.error) { console.error(response); return; }
        accessToken = response.access_token;
        await loadUserProfile();
        showAppView();
        typeTopbarStatus("Signed in. Click Scan Emails to load your sheet.");
        updateButtons();
      }
    });
    gisInited = true;
    updateButtons();
  } catch (e) { console.error(e); }
}

async function loadUserProfile() {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await res.json();

    if (data.email) {
      userChip.textContent = `Signed in as ${data.email}`;
    } else {
      userChip.textContent = "Signed in";
    }
  } catch (e) {
    console.error(e);
    userChip.textContent = "Signed in";
  }
}

function handleAuthClick()    { if (tokenClient) tokenClient.requestAccessToken({ prompt: "consent" }); }
function handleSignoutClick() {
  if (!accessToken) return;
  google.accounts.oauth2.revoke(accessToken, () => {
    accessToken = null;
    extractedData = [];
    manualEntries = [];
    userChip.textContent = "Not signed in";
    clearTable();
    hideSankey();
    hideResponseStats();
    showLandingView();
    updateButtons();
  });
}

function typeTopbarStatus(message, speed = 22) {
  if (!topbarStatus || !topbarStatusText) return;

  if (topbarTypingTimer) {
    clearInterval(topbarTypingTimer);
    topbarTypingTimer = null;
  }

  if (topbarClearTimer) {
    clearTimeout(topbarClearTimer);
    topbarClearTimer = null;
  }

  topbarStatusText.textContent = "";
  topbarStatus.classList.add("is-typing");

  let i = 0;

  topbarTypingTimer = setInterval(() => {
    topbarStatusText.textContent = message.slice(0, i + 1);
    i += 1;

    if (i >= message.length) {
      clearInterval(topbarTypingTimer);
      topbarTypingTimer = null;
      topbarStatus.classList.remove("is-typing");

      const shouldAutoClear =
        !message.toLowerCase().includes("scanning") &&
        !message.toLowerCase().includes("building sheet");

      if (shouldAutoClear) {
        topbarClearTimer = setTimeout(() => {
          topbarStatusText.textContent = "";
        }, 10000);
      }
    }
  }, speed);
}

async function parseEmailWithBackend(email) {
  try {
    const res = await fetch(`${BACKEND_URL}/parse-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subject: email.subject || "",
        from_email: email.from || "",
        snippet: email.snippet || "",
        body: email.bodyText || ""
      })
    });

    if (!res.ok) throw new Error("Backend failed");

    return await res.json();
  } catch (err) {
    console.error("Backend parser error:", err);
    return null;
  }
}

async function runScanPipeline() {
  try {
    typeTopbarStatus("Scanning emails…");

    const scannedEmails = await scanJobEmails();

    if (!scannedEmails.length) {
      renderTable(extractedData);

      if (extractedData.length) {
        renderSankey(extractedData);
        renderResponseStats(extractedData);
      } else {
        hideSankey();
        hideResponseStats();
      }

      typeTopbarStatus("No new job-related emails found.");
      updateButtons();
      return;
    }

    typeTopbarStatus(
      `Found ${scannedEmails.length} emails. Building sheet…`
    );

    // Parse every Gmail message and keep the email attached to its result.
    const parsedPairs = await Promise.all(
      scannedEmails.map(async email => {
        const parsed = await extractJobDataFromEmail(email);

        return {
          email,
          parsed
        };
      })
    );

    // Remove emails the backend marked as irrelevant.
    const relevantPairs = parsedPairs.filter(
      pair => pair.parsed !== null
    );

    // Convert relevant parsed emails into application-update objects.
    const scannedResults = relevantPairs.map(
      ({ parsed }) => ({
        ...parsed,
        isManual: false
      })
    );

    // Save each relevant email once in email history.
    for (const { email, parsed } of relevantPairs) {
      const alreadyStored = processedEmails.some(
        stored => stored.messageId === email.id
      );

      if (alreadyStored) {
        continue;
      }

      processedEmails.push({
        messageId: email.id,
        threadId: email.threadId || "",
        subject: email.subject || "",
        from: email.from || "",
        receivedDate: normalizeDate(email.date),
        company: parsed.company,
        position: parsed.position,
        detectedStatus: parsed.status,
        jobConfidence: parsed.jobConfidence,
        statusConfidence: parsed.statusConfidence
      });
    }

    // Mark every fetched Gmail message as scanned.
    const newIds = scannedEmails.map(
      email => email.id
    );

    scannedMessageIds = [
      ...new Set([
        ...scannedMessageIds,
        ...newIds
      ])
    ];

    localStorage.setItem(
      "scannedMessageIds",
      JSON.stringify(scannedMessageIds)
    );

    const beforeState =
      JSON.stringify(extractedData);

    // Merge new emails into existing applications.
    extractedData = mergeApplications(
      extractedData,
      scannedResults
    );

    saveAppState();

    const afterState =
      JSON.stringify(extractedData);

    renderTable(extractedData);

    if (extractedData.length) {
      renderSankey(extractedData);
      renderResponseStats(extractedData);
    } else {
      hideSankey();
      hideResponseStats();
    }

    if (beforeState === afterState) {
      typeTopbarStatus("No updates found.");
    } else {
      typeTopbarStatus(
        `Scan complete. ${extractedData.length} applications tracked.`
      );
    }

    updateButtons();
  } catch (error) {
    console.error("Scan pipeline failed:", error);
    typeTopbarStatus("Scan failed.");
  }
}

async function scanJobEmails() {
  if (!accessToken) {
    throw new Error("You must sign in before scanning Gmail.");
  }

  const gmailQuery = [
    '("thank you for applying" OR "application received" OR "your application" OR "application status" OR "interview" OR "offer" OR "regret to inform" OR "unfortunately" OR "move forward" OR "next steps" OR "candidate" OR "recruiter" OR "assessment")',
    "-category:promotions",
    "-category:social",
    "-from:glassdoor.com",
    "-from:doordash.com",
    "-from:linkedin.com",
    "-from:indeed.com"
  ].join(" ");

  const listUrl = new URL(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages"
  );

  listUrl.searchParams.set("q", gmailQuery);
  listUrl.searchParams.set("maxResults", String(scanLimit));

  const listResponse = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!listResponse.ok) {
    const errorText = await listResponse.text();

    throw new Error(
      `Gmail message list failed: ${listResponse.status} ${errorText}`
    );
  }

  const listData = await listResponse.json();
  const messages = listData.messages || [];
  const out = [];

  for (const messageSummary of messages) {
    if (scannedMessageIds.includes(messageSummary.id)) {
      continue;
    }

    const messageUrl =
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/` +
      `${encodeURIComponent(messageSummary.id)}?format=full`;

    const messageResponse = await fetch(messageUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!messageResponse.ok) {
      console.warn(
        "Could not load Gmail message:",
        messageSummary.id,
        messageResponse.status
      );

      continue;
    }

    const msg = await messageResponse.json();
    const headers = msg.payload?.headers || [];

    const subject = getHeader(headers, "Subject");
    const from = getHeader(headers, "From");
    const date = getHeader(headers, "Date");
    const snippet = msg.snippet || "";
    const bodyText = extractEmailBody(msg.payload);

    if (
      !isLikelyJobEmail({
        from,
        subject,
        snippet,
        bodyText
      })
    ) {
      continue;
    }

    out.push({
      id: msg.id,
      threadId: msg.threadId || "",
      from,
      subject,
      date,
      snippet,
      bodyText
    });
  }

  return out;
}

async function extractJobDataFromEmail(email) {
  const parsed = await parseEmailWithBackend(email);

  if (!parsed) {
    console.warn(
      "Backend parsing failed."
    );

    return null;
  }


  if (parsed.skip === true) {
    return null;
  }

  return {
    messageId: email.id,
    threadId: email.threadId || "",

    // <-- ADD THIS
    applicationRef:
      parsed.application_ref || "",

    company:
      parsed.company || "Unknown Company",

    position:
      parsed.position || "Unknown Position",

    location:
      parsed.location || "",

    status:
      parsed.status || "Unknown",

    date:
      normalizeDate(email.date),

    source:
      email.subject || "",

    jobConfidence:
      parsed.job_confidence ?? null,

    statusConfidence:
      parsed.confidence ?? null
  };
}

function shouldSkipEmail(email, text) {
  const subject = (email.subject||"").toLowerCase();
  const from    = (email.from||"").toLowerCase();
  const skip = [
    "looped",
    "best regards, recruiting team",
    "micro1 x ai labs",
    "crossing hurdles",
    "$55/hr",
    "remote |",
    "keep track of your application",

    // skip coaching/prep/job-board emails
    "projectbasta",
    "project basta",
    "prep session",
    "personalized prep sessions",
    "improve your outcomes",
    "blackstone launchpad team",
    "job and internship board",
    "employer exposure events",
    "verify your candidate account",
    "candidate account",
    "confirm your email address",
    "complete setup for your candidate account",
    "activate",
    "otp.workday.com"
  ];
  if (skip.some(s => text.includes(s))) return true;
  if (from.includes("ceipalmail.com")) return true;
  if (subject.includes("offer!") && text.includes("looped")) return true;
  return false;
}

function isBadCompanyCandidate(name) {
  if (!name) return true;

  const n = String(name).trim().toLowerCase();

  if (n.length < 2) return true;
  if (n.length > 38) return true;

  const badPhrases = [
    "your application",
    "we have received",
    "we received",
    "thank you",
    "best regards",
    "new opportunity",
    "other open positions",
    "please use the link",
    "following our",
    "to ensure that",
    "application is",
    "this role",
    "open position",
    "using this link",
    "good luck",
    "candidate account",
    "verify your"
  ];

  return badPhrases.some(p => n.includes(p));
}

function extractCompany(email) {
  const from = email.from || "";
  const subject = email.subject || "";
  const body = email.bodyText || "";
  const text = `${subject}\n${body}`;

  const known = findKnownCompany(`${email.from} ${email.subject} ${email.bodyText}`);
  if (known) return known;

  const indeedCompany = body.match(/company logo\s+([A-Za-z0-9&.'\- ]+?)\s+-\s+([A-Za-z ]+,\s*[A-Z]{2}|[A-Za-z ]+)/i);
  if (indeedCompany) {
    const cleaned = cleanCompanyName(indeedCompany[1]);
    if (cleaned) return cleaned;
  }

  const patterns = [
    /thank you for applying to\s+([A-Z][A-Za-z0-9&.,'’\- ]{2,70})/i,
    /your application to\s+([A-Z][A-Za-z0-9&.,'’\- ]{2,70})/i,
    /your application with\s+([A-Z][A-Za-z0-9&.,'’\- ]{2,70})/i,
    /application with\s+([A-Z][A-Za-z0-9&.,'’\- ]{2,70})/i,
    /interest in our ([A-Za-z0-9&,\-()\/ ]{4,100}) position/i,
    /interest in\s+([A-Z][A-Za-z0-9&.,'’\- ]{2,70})/i,
    /applying to\s+([A-Z][A-Za-z0-9&.,'’\- ]{2,70})/i,
    /from\s+([A-Z][A-Za-z0-9&.,'’\- ]{2,70})\s+(?:careers|recruiting|talent|hiring team)/i,
    /([A-Z][A-Za-z0-9&.,'’\- ]{2,70})\s+(?:careers|recruiting|talent acquisition|hiring team)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const cleaned = cleanCompanyName(match?.[1]);
    if (cleaned) return cleaned;
  }

  const displayName = from.match(/^"?([^"<@]+)"?\s*</)?.[1];
  const cleanedDisplay = cleanCompanyName(displayName);
  if (cleanedDisplay) return cleanedDisplay;

  const domain = from.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)?.[1]?.toLowerCase();
  if (domain) {
    const badDomains = [
      "gmail", "google", "mail", "myworkday", "workday", "greenhouse",
      "lever", "smartrecruiters", "brassring", "icims", "jobvite",
      "successfactors", "oraclecloud", "ashbyhq"
    ];

    const parts = domain.split(".");
    const root = parts.length >= 2 ? parts[parts.length - 2] : parts[0];

    if (!badDomains.includes(root)) {
      const cleaned = cleanCompanyName(root);
      if (cleaned) return cleaned;
    }
  }

  return "Unknown Company";
}

function cleanCompanyName(name) {
  if (!name) return "";

  let cleaned = String(name)
    .replace(/["'<>]/g, "")
    .replace(/@.*/g, "")
    .replace(/\(.+?\)/g, "")
    .replace(/\b(do[- ]?not[- ]?reply|donotreply|no[- ]?reply|notifications?|mail|automationmanager|workday admin)\b/gi, "")
    .replace(/\b(hr|workday|brassring|greenhouse|lever|smartrecruiters|icims|jobvite|ashby|careers?|jobs?|recruiting|recruitment|talent|hiring team|people team|global)\b/gi, "")
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b\.?/gi, "")
    .replace(/[-_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  cleaned = cleaned.replace(/\b\w/g, c => c.toUpperCase());

  if (isBadCompanyCandidate(cleaned)) return "";

  return cleaned;
}

function extractPosition(email) {
  const s = email.subject || "";
  const b = email.bodyText || "";

  const indeedPosition = b.match(/application submitted\s+([A-Za-z0-9&,\-()\/ ]{4,100})\s+company logo/i);
  if (indeedPosition) return cleanPosition(indeedPosition[1]);

  const patterns = [
    /role of ([A-Za-z0-9&,\-()\/ ]{4,100})/i,
    /position of ([A-Za-z0-9&,\-()\/ ]{4,100})/i,
    /application for ([A-Za-z0-9&,\-()\/ ]{4,100}) with/i,
    /received your application for the ([A-Za-z0-9&,\-()\/ ]{4,100})/i,
    /applying to the role of ([A-Za-z0-9&,\-()\/ ]{4,100})/i,
    /for the ([A-Za-z0-9&,\-()\/ ]{4,100}) position/i
  ];

  for (const p of patterns) {
    const m = s.match(p) || b.match(p);
    if (m) return cleanPosition(m[1]);
  }

  if (/assessment/i.test(s)) return "Assessment Stage";
  return cleanPosition(s);
}

function extractLocation(email) {
  const t = `${email.subject} ${email.bodyText}`;
  if (/saudi arabia/i.test(t)) return "Saudi Arabia";
  if (/remote/i.test(t)) return "Remote";
  const m = t.match(/\b([A-Z][a-z]+,\s?[A-Z]{2})\b/);
  return m ? m[1] : "";
}

function extractStatus(text, email) {
  const subj = (email.subject || "").toLowerCase();
  if (text.includes("not been selected") || text.includes("move forward in a different direction") || text.includes("move forward with other candidates") || text.includes("other candidates whose overall qualifications") || text.includes("unfortunately") || text.includes("regret to inform") || text.includes("no longer reviewing applicants") || text.includes("put on hold")) return "Rejected";
  if (text.includes("complete an assessment") || text.includes("complete your assessment") || text.includes("complete an online assessment") || text.includes("online assessment") || text.includes("assessment centre") || text.includes("assessment link") || text.includes("complete this step") || subj.includes("assessment")) return "Assessment";
  if ((text.includes("schedule your interview") || text.includes("interview invitation") || text.includes("invited to interview") || text.includes("select an interview time") || text.includes("choose a time") || text.includes("final round interview")) && !text.includes("will reach out") && !text.includes("if we") && !text.includes("should we") && !text.includes("in the event")) return "Interview";
  if (text.includes("we are pleased to offer") || text.includes("offer letter") || subj === "offer!") return "Offer";
  if (text.includes("application received") || text.includes("thank you for applying") || text.includes("thanks for applying") || text.includes("thank you for your interest") || text.includes("you have successfully submitted your") || text.includes("thank you for sharing your story") || text.includes("we are delighted by the interest") || text.includes("received your application") || text.includes("we received your application") || text.includes("your application was submitted successfully") || text.includes("application submitted successfully") || text.includes("thank you for your application") || text.includes("application is incomplete") || text.includes("your opportunity for employment") || text.includes("candidate pool") || text.includes("candidate home") || text.includes("status of your application") || text.includes("talent acquisition team will review") || text.includes("under review")) return "Applied";
  return "Unknown";
}

function normalizeCompany(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePosition(value, company = "") {
  let position = String(value || "").toLowerCase();
  const normalizedCompany = normalizeCompany(company);

  position = position
    .replace(/\b(internship|position|role|job|opportunity)\b/g, "")
    .replace(/\b(at|with)\b.*$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    normalizedCompany &&
    position.endsWith(normalizedCompany)
  ) {
    position = position
      .slice(0, -normalizedCompany.length)
      .trim();
  }

  return position;
}

function isUnknownCompany(value) {
  const company = normalizeCompany(value);

  return (
    !company ||
    company === "unknown" ||
    company === "unknown company"
  );
}

function isUnknownPosition(value) {
  const position = String(value || "")
    .toLowerCase()
    .trim();

  return (
    !position ||
    position === "unknown" ||
    position === "unknown position" ||
    position === "—"
  );
}

function getApplicationKey(row) {
  const company = normalizeCompany(row.company);

  const position = normalizePosition(
    row.position,
    row.company
  );

  /*
   * Best identifier:
   * company + known position
   */
  if (
    !isUnknownCompany(row.company) &&
    !isUnknownPosition(row.position) &&
    position
  ) {
    return `application:${company}|${position}`;
  }

  /*
   * If the role is unknown, Gmail thread ID
   * may still connect messages in one conversation.
   */
  if (row.threadId) {
    return `thread:${row.threadId}`;
  }

  /*
   * Do not merge unrelated unknown-position emails.
   */
  if (row.messageId) {
    return `message:${row.messageId}`;
  }

  /*
   * Manual rows without Gmail IDs.
   */
  return `manual:${company}|${position}|${row.date || ""}|${row.source || ""}`;
}

function findMatchingApplicationKey(
  applications,
  newRow
) {
  const directKey = getApplicationKey(newRow);

  /*
   * Exact company + role or exact thread match.
   */
  if (applications.has(directKey)) {
    return directKey;
  }

  /*
   * Never guess between multiple positions at
   * the same company.
   *
   * However, when a new email has an unknown
   * position and there is exactly one existing
   * application at that company, use that row.
   */
  if (
    !isUnknownCompany(newRow.company) &&
    isUnknownPosition(newRow.position)
  ) {
    const company = normalizeCompany(
      newRow.company
    );

    const companyMatches = [];

    for (const [key, existing] of applications) {
      if (
        normalizeCompany(existing.company) ===
        company
      ) {
        companyMatches.push(key);
      }
    }

    if (companyMatches.length === 1) {
      return companyMatches[0];
    }
  }

  return null;
}

function mergeApplications(
  existingRows,
  newRows
) {
  const applications = new Map();

  /*
   * Load existing application rows first.
   */
  for (const row of existingRows) {
    applications.set(
      getApplicationKey(row),
      row
    );
  }

  /*
   * Match every new email to an application.
   */
  for (const newRow of newRows) {
    const matchingKey =
      findMatchingApplicationKey(
        applications,
        newRow
      );

    /*
     * This is a completely new application.
     */
    if (!matchingKey) {
      applications.set(
        getApplicationKey(newRow),
        {
          ...newRow,
          latestEmailId:
            newRow.messageId || "",

          latestThreadId:
            newRow.threadId || "",

          latestUpdateDate:
            newRow.date || ""
        }
      );

      continue;
    }

    const existing =
      applications.get(matchingKey);

    /*
     * User-edited application fields should not
     * be overwritten automatically.
     */
    if (existing.userEdited) {
      applications.set(
        matchingKey,
        {
          ...existing,

          latestEmailId:
            newRow.messageId ||
            existing.latestEmailId ||
            "",

          latestThreadId:
            newRow.threadId ||
            existing.latestThreadId ||
            "",

          latestUpdateDate:
            newRow.date ||
            existing.latestUpdateDate ||
            ""
        }
      );

      continue;
    }

    const oldDate = new Date(
      existing.date || 0
    );

    const newDate = new Date(
      newRow.date || 0
    );

    const newEmailIsNewer =
      newDate >= oldDate;

    /*
     * A newer email controls current status,
     * source and date.
     *
     * Older emails can still fill missing fields.
     */
    const updated = {
      ...existing,

      company:
        !isUnknownCompany(newRow.company)
          ? newRow.company
          : existing.company,

      position:
        !isUnknownPosition(newRow.position)
          ? newRow.position
          : existing.position,

      location:
        newRow.location ||
        existing.location ||
        "",

      status:
        newEmailIsNewer
          ? newRow.status
          : existing.status,

      date:
        newEmailIsNewer
          ? newRow.date
          : existing.date,

      source:
        newEmailIsNewer
          ? newRow.source
          : existing.source,

      latestEmailId:
        newRow.messageId ||
        existing.latestEmailId ||
        "",

      latestThreadId:
        newRow.threadId ||
        existing.latestThreadId ||
        "",

      latestUpdateDate:
        newEmailIsNewer
          ? newRow.date
          : existing.latestUpdateDate,

      jobConfidence:
        newRow.jobConfidence ??
        existing.jobConfidence ??
        null,

      statusConfidence:
        newRow.statusConfidence ??
        existing.statusConfidence ??
        null
    };

    /*
     * The role may have changed from Unknown to a
     * known value. Generate its new permanent key.
     */
    const updatedKey =
      getApplicationKey(updated);

    if (updatedKey !== matchingKey) {
      applications.delete(matchingKey);
    }

    applications.set(
      updatedKey,
      updated
    );
  }

  return [...applications.values()];
}

function renderTable(data) {
  if (!data.length) {
    clearTable();
    return;
  }

  const sorted = [...data].sort((a, b) => new Date(b.date) - new Date(a.date));

  applicationsTableBody.innerHTML = sorted
  .map((item, index) => `
    <tr class="data-row ${deleteMode ? "delete-mode-row" : ""}" data-index="${index}">
      <td class="company-cell ${deleteMode ? "company-cell-delete-mode" : ""}">
        ${deleteMode ? `<input type="checkbox" class="delete-row-check" data-delete-index="${index}">` : ""}
        <span>${escapeHtml(item.company || "—")}</span>
      </td>
      <td>${escapeHtml(shortText(item.position || "—", 70))}</td>
      <td>${escapeHtml(item.location || "—")}</td>
      <td><span class="badge ${getStatusClass(item.status)}">${escapeHtml(item.status || "Unknown")}</span></td>
      <td>${escapeHtml(item.date || "—")}</td>
      <td>${escapeHtml(shortText(item.source || "—", 65))}</td>
    </tr>
  `)
  .join("");

  const rows = applicationsTableBody.querySelectorAll(".data-row");

  rows.forEach((row, index) => {
    row.addEventListener("click", (e) => {
      if (deleteMode) {
        const checkbox = row.querySelector(".delete-row-check");
        if (!checkbox) return;

        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }

        if (checkbox.checked) {
          selectedRowsToDelete.add(sorted[index]);
        } else {
          selectedRowsToDelete.delete(sorted[index]);
        }

        updateDeleteSelectedButton();
        return;
      }

      makeRowEditable(row, index, sorted[index]);
    });
  });
}

function makeRowEditable(row, sortedIndex, item) {
  if (!row || row.classList.contains("editing-row")) return;

  row.classList.add("editing-row");

  row.innerHTML = `
    <td><input type="text" class="table-input" value="${escapeAttribute(item.company || "")}" /></td>
    <td><input type="text" class="table-input" value="${escapeAttribute(item.position || "")}" /></td>
    <td><input type="text" class="table-input" value="${escapeAttribute(item.location || "")}" /></td>
    <td>
      <select class="table-select">
        <option value="Applied" ${item.status === "Applied" ? "selected" : ""}>Applied</option>
        <option value="Assessment" ${item.status === "Assessment" ? "selected" : ""}>Assessment</option>
        <option value="Interview" ${item.status === "Interview" ? "selected" : ""}>Interview</option>
        <option value="Offer" ${item.status === "Offer" ? "selected" : ""}>Offer</option>
        <option value="Rejected" ${item.status === "Rejected" ? "selected" : ""}>Rejected</option>
        <option value="Unknown" ${item.status === "Unknown" ? "selected" : ""}>Unknown</option>
      </select>
    </td>
    <td><input type="text" class="table-input" value="${escapeAttribute(item.date || "")}" /></td>
    <td><input type="text" class="table-input" value="${escapeAttribute(item.source || "")}" /></td>
  `;

  const firstInput = row.querySelector("input");
  if (firstInput) firstInput.focus();
  row.querySelector(".row-delete-btn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  deleteApplicationRow(item);
  });

  row.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEditedRow(row, item);
    }
  });

  row.addEventListener("focusout", () => {
    setTimeout(() => {
      if (!row.contains(document.activeElement)) {
        saveEditedRow(row, item);
      }
    }, 0);
  });
}

function saveEditedRow(row, originalItem) {
  if (!row || !row.isConnected) return;

  const inputs = row.querySelectorAll("input");
  const select = row.querySelector("select");

  const updatedItem = {
    ...originalItem,
    userEdited: true,
    company: inputs[0]?.value.trim() || "—",
    position: inputs[1]?.value.trim() || "—",
    location: inputs[2]?.value.trim() || "—",
    status: select?.value || "Unknown",
    date: inputs[3]?.value.trim() || "—",
    source: inputs[4]?.value.trim() || "—"
  };

  const targetIndex = extractedData.findIndex(item =>
    item === originalItem ||
    (
      item.company === originalItem.company &&
      item.position === originalItem.position &&
      item.location === originalItem.location &&
      item.status === originalItem.status &&
      item.date === originalItem.date &&
      item.source === originalItem.source
    )
  );

  if (targetIndex !== -1) {
    extractedData[targetIndex] = updatedItem;
  }

  if (updatedItem.isManual) {
    const manualIndex = manualEntries.findIndex(item =>
      item === originalItem ||
      (
        item.company === originalItem.company &&
        item.position === originalItem.position &&
        item.location === originalItem.location &&
        item.status === originalItem.status &&
        item.date === originalItem.date &&
        item.source === originalItem.source
      )
    );

    if (manualIndex !== -1) {
      manualEntries[manualIndex] = updatedItem;
    }
  }

  saveAppState();
  renderTable(extractedData);
  renderSankey(extractedData);
  renderResponseStats(extractedData);
  updateButtons();
}

function deleteApplicationRow(itemToDelete) {
  if (!itemToDelete) return;

  extractedData = extractedData.filter(item => item !== itemToDelete);
  manualEntries = manualEntries.filter(item => item !== itemToDelete);
  saveAppState();

  renderTable(extractedData);

  if (extractedData.length) {
    renderSankey(extractedData);
    renderResponseStats(extractedData);
  } else {
    hideSankey();
    hideResponseStats();
  }

  updateButtons();
  typeTopbarStatus("Application row deleted.");
}

function enterDeleteMode() {
  deleteMode = true;
  selectedRowsToDelete.clear();

  sendToSheetsBtn.classList.add("hidden");
  scanBtn.classList.add("hidden");
  deleteModeBtn.classList.add("hidden");
  addRowBtn.classList.add("hidden");

  deleteSelectedBtn.classList.remove("hidden");
  cancelDeleteBtn.classList.remove("hidden");

  renderTable(extractedData);
  updateDeleteSelectedButton();
  typeTopbarStatus("Select rows to delete.");
}

function exitDeleteMode() {
  deleteMode = false;
  selectedRowsToDelete.clear();

  sendToSheetsBtn.classList.remove("hidden");
  scanBtn.classList.remove("hidden");
  deleteModeBtn.classList.remove("hidden");
  addRowBtn.classList.remove("hidden");

  deleteSelectedBtn.classList.add("hidden");
  cancelDeleteBtn.classList.add("hidden");

  renderTable(extractedData);
  typeTopbarStatus("Delete cancelled. No rows deleted.");
}

function updateDeleteSelectedButton() {
  const count = selectedRowsToDelete.size;
  deleteSelectedBtn.textContent = count ? `Delete ${count}` : "Delete Selected";
  deleteSelectedBtn.disabled = count === 0;
}

function deleteSelectedRows() {
  if (!selectedRowsToDelete.size) return;

  extractedData = extractedData.filter(item => !selectedRowsToDelete.has(item));
  manualEntries = manualEntries.filter(item => !selectedRowsToDelete.has(item));
  saveAppState();

  deleteMode = false;
  selectedRowsToDelete.clear();

  sendToSheetsBtn.classList.remove("hidden");
  scanBtn.classList.remove("hidden");
  deleteModeBtn.classList.remove("hidden");
  addRowBtn.classList.remove("hidden");

  deleteSelectedBtn.classList.add("hidden");
  cancelDeleteBtn.classList.add("hidden");

  renderTable(extractedData);

  if (extractedData.length) {
    renderSankey(extractedData);
    renderResponseStats(extractedData);
  } else {
    hideSankey();
    hideResponseStats();
  }

  updateButtons();
  typeTopbarStatus("Selected rows deleted.");
}

function clearTable() {
  applicationsTableBody.innerHTML = `
    <tr class="placeholder-row">
      <td colspan="6">No data yet. Click "Scan Emails" to populate your sheet.</td>
    </tr>`;
}

function addEditableRow() {
  const placeholder = applicationsTableBody.querySelector(".placeholder-row");
  if (placeholder) {
    placeholder.remove();
  }

  const row = document.createElement("tr");
  row.className = "manual-entry-row";

  row.innerHTML = `
    <td><input type="text" class="table-input" placeholder="Company" /></td>
    <td><input type="text" class="table-input" placeholder="Position" /></td>
    <td><input type="text" class="table-input" placeholder="Location" /></td>
    <td>
      <select class="table-select">
        <option value="Applied">Applied</option>
        <option value="Assessment">Assessment</option>
        <option value="Interview">Interview</option>
        <option value="Offer">Offer</option>
        <option value="Rejected">Rejected</option>
        <option value="Unknown" selected>Unknown</option>
      </select>
    </td>
    <td><input type="text" class="table-input" placeholder="YYYY-MM-DD" /></td>
    <td><input type="text" class="table-input" placeholder="Source" /></td>
  `;

  applicationsTableBody.prepend(row);

  const firstInput = row.querySelector("input");
  if (firstInput) firstInput.focus();

  row.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEditableRow(row);
    }
  });

  row.addEventListener("focusout", () => {
    setTimeout(() => {
      if (!row.contains(document.activeElement)) {
        saveEditableRow(row);
      }
    }, 0);
  });
}

function saveEditableRow(row) {
  if (!row || !row.isConnected) return;

  const inputs = row.querySelectorAll("input");
  const select = row.querySelector("select");

  const company = inputs[0]?.value.trim() || "—";
  const position = inputs[1]?.value.trim() || "—";
  const location = inputs[2]?.value.trim() || "—";
  const status = select?.value || "Unknown";
  const date = inputs[3]?.value.trim() || "—";
  const source = inputs[4]?.value.trim() || "—";

  const isCompletelyEmpty =
    !inputs[0]?.value.trim() &&
    !inputs[1]?.value.trim() &&
    !inputs[2]?.value.trim() &&
    !inputs[3]?.value.trim() &&
    !inputs[4]?.value.trim();

  if (isCompletelyEmpty) {
    row.remove();
    restorePlaceholderIfEmpty();
    return;
  }

  const newItem = {
    company,
    position,
    location,
    status,
    date,
    source,
    isManual: true
  };

  manualEntries.unshift(newItem);

  extractedData = [...manualEntries, ...extractedData.filter(item => !item.isManual)];

  renderTable(extractedData);
  renderSankey(extractedData);
  renderResponseStats(extractedData);
  updateButtons();
}

function restorePlaceholderIfEmpty() {
  const hasRows = applicationsTableBody.querySelector("tr");
  if (!hasRows) {
    clearTable();
  }
}

function hideSankey() {
  document.getElementById("sankeyFrame")?.classList.add("hidden");
}

/* ── Sankey ── */
function renderSankeyInto(data, frameId, chartId, subtitleId) {
  const frame = document.getElementById(frameId);
  const container = document.getElementById(chartId);
  const subtitle = document.getElementById(subtitleId);

  if (!frame || !container || !subtitle || !data.length || typeof d3 === "undefined" || typeof d3.sankey === "undefined") {
    if (frame) frame.classList.add("hidden");
    return;
  }

  const counts = { Applied: 0, Assessment: 0, Interview: 0, Rejected: 0, Offer: 0, Unknown: 0 };
  data.forEach(d => {
    const s = d.status || "Unknown";
    if (s in counts) counts[s]++; else counts.Unknown++;
  });

  const rightStatuses = ["Applied", "Assessment", "Interview", "Rejected", "Offer", "Unknown"]
    .filter(s => counts[s] > 0);

  if (!rightStatuses.length) {
    frame.classList.add("hidden");
    return;
  }

  const nodeNames = ["Applications", ...rightStatuses];
  const nodeIndex = Object.fromEntries(nodeNames.map((n, i) => [n, i]));

  const links = rightStatuses.map(s => ({
    source: nodeIndex["Applications"],
    target: nodeIndex[s],
    value: counts[s]
  }));

  const palette = {
    Applications: { fill:"#4F81F7", light:"#e8eeff", text:"#1a3a9e" },
    Applied:      { fill:"#1b5fa8", light:"#ebf2fc", text:"#2D6FCB" },
    Assessment:   { fill:"#F5A623", light:"#fff4e0", text:"#7a4800" },
    Interview:    { fill:"#9B6FFF", light:"#f0eaff", text:"#4a1fa8" },
    Rejected:     { fill:"#F45B5B", light:"#fde8e8", text:"#8b1a1a" },
    Offer:        { fill:"#2DC88A", light:"#e0f9f0", text:"#0a5e3a" },
    Unknown:      { fill:"#A0A8BE", light:"#f0f1f5", text:"#3d4460" },
  };

  const labelMap = {
    Applications:"Applications",
    Applied:"Applied",
    Assessment:"Assessments",
    Interview:"Interviews",
    Rejected:"Rejected",
    Offer:"Offers",
    Unknown:"Unknown"
  };

  container.innerHTML = "";

  const numRows = rightStatuses.length;
  const nodeH = 42;
  const nodePad = 16;
  const svgH = Math.max(numRows * nodeH + (numRows - 1) * nodePad + 60, 180);
  const svgW = 520;

  const svg = d3.select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("viewBox", `0 0 ${svgW} ${svgH}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const sankeyGen = d3.sankey()
    .nodeWidth(10)
    .nodePadding(nodePad)
    .extent([[52, 20], [svgW - 170, svgH - 20]]);

  const graph = sankeyGen({
    nodes: nodeNames.map(name => ({ name })),
    links: links.map(l => ({ ...l }))
  });

  svg.append("g")
    .selectAll("path")
    .data(graph.links)
    .join("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("fill", "none")
    .attr("stroke", d => palette[d.target.name]?.fill || "#aaa")
    .attr("stroke-width", d => Math.max(2, d.width))
    .attr("stroke-opacity", 0.18);

  const nodeG = svg.append("g").selectAll("g").data(graph.nodes).join("g");

  nodeG.append("rect")
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .attr("width", d => d.x1 - d.x0)
    .attr("height", d => Math.max(6, d.y1 - d.y0))
    .attr("rx", 3)
    .attr("fill", d => palette[d.name]?.fill || "#aaa");

  const rightNodes = graph.nodes.filter(d => d.x0 >= svgW / 2);

  rightNodes.forEach(d => {
    const midY = (d.y0 + d.y1) / 2;
    const col = palette[d.name] || { fill:"#aaa" };
    const label = labelMap[d.name] || d.name;
    const lx = d.x0 - 12;

    svg.append("text")
      .attr("x", lx).attr("y", midY - 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "central")
      .attr("font-size", "12.5px")
      .attr("font-weight", "600")
      .attr("font-family", "Inter, -apple-system, sans-serif")
      .attr("fill", col.fill)
      .text(label);

    svg.append("text")
      .attr("x", lx).attr("y", midY + 12)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "central")
      .attr("font-size", "11px")
      .attr("font-family", "Inter, -apple-system, sans-serif")
      .attr("fill", "#9ca3af")
      .text(String(d.value));
  });

  const leftNode = graph.nodes.find(d => d.x0 < svgW / 2);
  if (leftNode) {
    const midY = (leftNode.y0 + leftNode.y1) / 2;
    svg.append("text")
      .attr("x", leftNode.x1 + 12).attr("y", midY - 2)
      .attr("dominant-baseline", "central")
      .attr("font-size", "12.5px")
      .attr("font-weight", "600")
      .attr("font-family", "Inter, -apple-system, sans-serif")
      .attr("fill", "#4F81F7")
      .text("Applications");

    svg.append("text")
      .attr("x", leftNode.x1 + 12).attr("y", midY + 12)
      .attr("dominant-baseline", "central")
      .attr("font-size", "11px")
      .attr("font-family", "Inter, -apple-system, sans-serif")
      .attr("fill", "#9ca3af")
      .text(`${leftNode.value} total`);
  }

  const total = data.length;
  const parts = [`${total} total`];
  const nInt = counts.Interview || 0;
  const nOff = counts.Offer || 0;
  if (nInt) parts.push(`${nInt} interviews`);
  if (nOff) parts.push(`${nOff} offers`);
  subtitle.textContent = parts.join(" · ");

  frame.classList.remove("hidden");
}

function renderSankey(data) {
  renderSankeyInto(data, "sankeyFrame", "sankeyChart", "sankeySubtitle");
}

function hideResponseStats() {
  document.getElementById("responseStatsFrame")?.classList.add("hidden");
}

function renderResponseStatsInto(data, frameId, assessmentRatioId, assessmentSubId, interviewRatioId, interviewSubId, offerRatioId, offerSubId) {
  const frame = document.getElementById(frameId);
  if (!frame || !data.length) {
    if (frame) frame.classList.add("hidden");
    return;
  }

  const total = data.length;
  const counts = { Assessment: 0, Interview: 0, Offer: 0 };

  data.forEach(item => {
    if (item.status === "Assessment") counts.Assessment++;
    if (item.status === "Interview") counts.Interview++;
    if (item.status === "Offer") counts.Offer++;
  });

  const formatRatio = (count, totalCount) => {
    if (!count || !totalCount) return "0";
    return `1 in ${Math.round(totalCount / count)}`;
  };

  document.getElementById(assessmentRatioId).textContent = formatRatio(counts.Assessment, total);
  document.getElementById(assessmentSubId).textContent = `${counts.Assessment} of ${total} applications`;

  document.getElementById(interviewRatioId).textContent = formatRatio(counts.Interview, total);
  document.getElementById(interviewSubId).textContent = `${counts.Interview} of ${total} applications`;

  document.getElementById(offerRatioId).textContent = formatRatio(counts.Offer, total);
  document.getElementById(offerSubId).textContent = `${counts.Offer} of ${total} applications`;

  frame.classList.remove("hidden");
}

function renderResponseStats(data) {
  renderResponseStatsInto(
    data,
    "responseStatsFrame",
    "assessmentRatio", "assessmentSub",
    "interviewRatio", "interviewSub",
    "offerRatio", "offerSub"
  );
}

/* ── Legal Stuff ── */
const privacyHtml = `
  <p>
    Looped helps users track job applications by analyzing relevant emails from their inbox.
    Your privacy is important to us, and we are committed to keeping your data secure and transparent.
  </p>

  <h2>Information We Access</h2>
  <p>
    With your permission, Looped may access your Gmail inbox to identify job-related emails such as
    applications, interviews, and offers.
  </p>

  <h2>How We Use Your Data</h2>
  <p>
    We use your email data only to extract structured information (e.g., company name, role, status)
    to display in your dashboard.
  </p>

  <h2>Data Sharing</h2>
  <p>
    We do not sell, rent, or share your personal data with third parties.
  </p>

  <h2>Data Storage</h2>
  <p>
    Processed data may be stored securely to improve your experience and avoid reprocessing the same emails.
  </p>

  <h2>Your Control</h2>
  <p>
    You can revoke access to your Google account at any time through your Google account settings.
  </p>

  <h2>Changes</h2>
  <p>
    This policy may be updated as Looped evolves. Continued use of the product means you accept any updates.
  </p>
`;

const termsHtml = `
  <p>
    By using Looped, you agree to the following terms.
  </p>

  <h2>Use of Service</h2>
  <p>
    Looped is designed to help users track job applications by analyzing email data.
    You agree to use the service responsibly and in compliance with applicable laws.
  </p>

  <h2>Accuracy</h2>
  <p>
    Looped uses automated systems to extract information and may not always be 100% accurate.
    You are responsible for verifying important information.
  </p>

  <h2>Account Access</h2>
  <p>
    You grant Looped permission to access your Gmail account for the purpose of extracting
    job-related information. You may revoke access at any time.
  </p>

  <h2>Limitation of Liability</h2>
  <p>
    Looped is provided “as is” without warranties of any kind. We are not liable for any damages
    resulting from the use of the service.
  </p>

  <h2>Changes</h2>
  <p>
    These terms may be updated over time. Continued use of Looped means you accept any changes.
  </p>
`;

function openLegalModal(type) {
  if (!legalModal || !legalModalTitle || !legalModalContent) return;

  if (type === "privacy") {
    legalModalTitle.textContent = "Privacy Policy";
    legalModalContent.innerHTML = privacyHtml;
  } else {
    legalModalTitle.textContent = "Terms of Service";
    legalModalContent.innerHTML = termsHtml;
  }

  legalModal.classList.remove("hidden");
  legalModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "";
}

function closeLegalModal() {
  if (!legalModal) return;
  legalModal.classList.add("hidden");
  legalModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

/* ── Helpers ── */
function getStatusClass(status) {
  const v = (status||"Unknown").toLowerCase();
  return { applied:"applied", rejected:"rejected", interview:"interview", assessment:"assessment", offer:"offer" }[v] || "unknown";
}

function isLikelyJobEmail({ from, subject, snippet, bodyText }) {
  const text = `${from} ${subject} ${snippet} ${bodyText}`.toLowerCase();

  const strongSignals = [
    "workday",
    "not been selected",
    "move forward in a different direction",
    "move forward with other candidates",
    "other candidates whose overall qualifications",
    "unfortunately",
    "regret to inform",
    "no longer reviewing applicants",
    "put on hold",
    "complete assessment",
    "online assessment",
    "assessment centre",
    "coding challenge",
    "schedule your interview",
    "interview invitation",
    "selected for an interview",
    "final round interview",
    "we are pleased to offer",
    "offer letter",
    "application received",
    "thank you for applying",
    "thanks for applying",
    "thank you for your interest",
    "thank you for sharing your story",
    "we are delighted by the interest",
    "received your application",
    "we received your application",
    "your application was submitted successfully",
    "application submitted successfully",
    "thank you for your application",
    "application is incomplete",
    "your opportunity for employment",
    "candidate home",
    "status of your application",
    "talent acquisition team will review",
    "under review"
  ];

  const obviousNoise = [
    "piazza",
    "canvas",
    "instructure",
    "course survey",
    "daily digest",
    "exam",
    "quiz",
    "office hours",
    "regrade",
    "homework",
    "assignment",
    "terps, your opinion matters",
    "bitcamp"
  ];

  return strongSignals.some(s => text.includes(s)) &&
         !obviousNoise.some(n => text.includes(n));
}

function extractEmailBody(payload) {
  if (!payload) return "";
  let bodyData = "";
  if (payload.body?.data) { bodyData = payload.body.data; }
  else if (payload.parts?.length) { bodyData = findBestBodyPart(payload.parts); }
  if (!bodyData) return "";
  return stripHtml(decodeBase64Url(bodyData)).replace(/\s+/g," ").trim();
}

function findBestBodyPart(parts) {
  for (const p of parts) if (p.mimeType==="text/plain"&&p.body?.data) return p.body.data;
  for (const p of parts) if (p.mimeType==="text/html"&&p.body?.data) return p.body.data;
  for (const p of parts) if (p.parts?.length) { const n=findBestBodyPart(p.parts); if(n) return n; }
  return "";
}

function decodeBase64Url(data) {
  const b = data.replace(/-/g,"+").replace(/_/g,"/");
  return atob(b + "=".repeat((4-b.length%4)%4));
}

function stripHtml(html) {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.textContent||d.innerText||"";
}

function getHeader(headers, name) {
  const h = headers.find(h => h.name.toLowerCase()===name.toLowerCase());
  return h ? h.value : "";
}

function normalizeDate(raw) {
  const d = new Date(raw);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0,10);
}

function cleanEntity(v) {
  if (!v) return "";
  return v.replace(/^(the|joining)\s+/i,"").replace(/\b(position|role|team|application)\b.*$/i,"").replace(/[|:;,]+.*$/,"").replace(/\s{2,}/g," ").trim();
}

function cleanPosition(v) {
  if (!v) return "Unknown Position";
  return (v.replace(/\bposition\b/gi,"").replace(/\bis incomplete\b/gi,"").replace(/\bbut still require.*$/i,"").replace(/\bhas been put on hold.*$/i,"").replace(/\bthank you.*$/i,"").replace(/[|]+.*$/,"").replace(/\s{2,}/g," ").trim()) || "Unknown Position";
}

function shortText(text, max) {
  if (!text) return "";
  return text.length<=max ? text : text.slice(0,max)+"…";
}

function escapeHtml(t) {
  if (t==null) return "";
  return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function escapeAttribute(t) {
  if (t == null) return "";
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

loginBtn?.addEventListener("click", handleAuthClick);
logoutBtn?.addEventListener("click", handleSignoutClick);
scanBtn?.addEventListener("click", runScanPipeline);
sendToSheetsBtn?.addEventListener("click", () => typeTopbarStatus("Google Sheets export is the next step."));
addRowBtn?.addEventListener("click", addEditableRow);

menuBtn?.addEventListener("click", (e) => {
  e.stopPropagation();
  menuDropdown.classList.toggle("hidden");
});

contactBtn?.addEventListener("click", () => {
  window.location.href = "mailto:danyalimrans@gmail.com";
});

document.addEventListener("click", () => {
  menuDropdown?.classList.add("hidden");
});

renderSankeyInto(landingPreviewData, "landingSankeyFrame", "landingSankeyChart", "landingSankeySubtitle");

renderResponseStatsInto(
  landingPreviewData,
  "landingResponseStatsFrame",
  "landingAssessmentRatio", "landingAssessmentSub",
  "landingInterviewRatio", "landingInterviewSub",
  "landingOfferRatio", "landingOfferSub"
);

privacyBtn?.addEventListener("click", () => openLegalModal("privacy"));
termsBtn?.addEventListener("click", () => openLegalModal("terms"));
legalModalClose?.addEventListener("click", closeLegalModal);

deleteModeBtn?.addEventListener("click", enterDeleteMode);
cancelDeleteBtn?.addEventListener("click", exitDeleteMode);
deleteSelectedBtn?.addEventListener("click", deleteSelectedRows);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLegalModal();
});

tableSearch?.addEventListener("input", () => {
  const q = tableSearch.value.toLowerCase();

  document.querySelectorAll("#applicationsTableBody tr.data-row").forEach(row => {
    row.style.display =
      row.innerText.toLowerCase().includes(q)
        ? ""
        : "none";
  });
});

document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
    e.preventDefault();
    tableSearch?.focus();
    tableSearch?.select();
  }
});

settingsBtn.onclick = () => {
  settingsModal.classList.remove("hidden");
  scanLimitSelect.value = scanLimit;
};

settingsClose.onclick = () => {
  settingsModal.classList.add("hidden");
};

scanLimitSelect.onchange = () => {
  scanLimit = Number(scanLimitSelect.value);
  localStorage.setItem("scanLimit", scanLimit);
};

resetScannedBtn.onclick = () => {
  localStorage.removeItem("scannedMessageIds");
  scannedMessageIds = [];
  alert("Scanned emails reset.");
};

resetAllBtn.onclick = () => {
  localStorage.clear();
  location.reload();
};

window.onload = () => {
  initializeGisClient();
  showLandingView();

  if (extractedData.length) {
    renderTable(extractedData);
    renderSankey(extractedData);
    renderResponseStats(extractedData);
  } else {
    clearTable();
  }

  updateButtons();
};