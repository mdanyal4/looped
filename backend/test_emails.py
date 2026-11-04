import requests
import json

URL = "http://127.0.0.1:8000/parse-email"

# ─────────────────────────────────────────────────────────────────────────────
# TEST CASES
# Each entry: (label, expected_skip, expected_status, payload)
# expected_skip: True = should be filtered out, False = should be kept
# expected_status: what status label we expect (None if skip=True)
# ─────────────────────────────────────────────────────────────────────────────

tests = [

    # ── REAL JOB EMAILS (should NOT be skipped) ───────────────────────────

    (
        "Applied — standard ATS confirmation",
        False, "Applied",
        {
            "subject": "Thank you for applying to Northrop Grumman",
            "from_email": "no-reply@northropgrumman.com",
            "snippet": "Your application has been received.",
            "body": "Hi, thank you for applying to Northrop Grumman for the Software Engineer Intern position. Your application has been received and is currently under review by our recruiting team. We will be in touch if your background is a match. Best regards, Northrop Grumman Recruiting Team."
        }
    ),
    (
        "Applied — hard negative (mentions interview in future tense)",
        False, "Applied",
        {
            "subject": "Thanks for applying to Palantir",
            "from_email": "recruiting@palantir.com",
            "snippet": "Your application is under review.",
            "body": "Hi, thank you for your interest in the Forward Deployed Engineer Intern role at Palantir. Your application is now under review. Should you be selected to move forward, you may be invited to complete a technical assessment or interview with our team. We appreciate your patience."
        }
    ),
    (
        "Applied — Workday style",
        False, "Applied",
        {
            "subject": "Your Amazon Careers Application Is In!",
            "from_email": "no-reply@myworkday.com",
            "snippet": "Thank you for sharing your story.",
            "body": "Thank you for sharing your story with us. Our Talent Acquisition team will review your background for the SDE Intern position. We are delighted by the interest in this role and will reach out if there is a match."
        }
    ),
    (
        "Assessment — HackerRank coding challenge",
        False, "Assessment",
        {
            "subject": "Complete your HackerRank challenge — Jane Street",
            "from_email": "recruiting@janestreet.com",
            "snippet": "Your coding challenge is ready.",
            "body": "Hi, your coding challenge for the Software Engineer Intern opportunity at Jane Street is ready. Please complete it within 72 hours. The challenge covers algorithms and data structures. Good luck!"
        }
    ),
    (
        "Assessment — HireVue video interview",
        False, "Assessment",
        {
            "subject": "Action required: complete your HireVue assessment",
            "from_email": "noreply@hirevue.com",
            "snippet": "Please complete your video assessment.",
            "body": "Dear Candidate, as the next step in your application for the Technology Analyst role at Deloitte, please complete a HireVue video assessment. You will be asked to respond to several questions on camera. The assessment must be completed within 5 days."
        }
    ),
    (
        "Interview — final round invitation",
        False, "Interview",
        {
            "subject": "Final round interview — Citadel",
            "from_email": "recruiting@citadel.com",
            "snippet": "You are invited to a final round interview.",
            "body": "Hi, congratulations on advancing in the Software Engineer Intern process at Citadel. We would like to invite you to a final round interview. You will meet with 4 members of our team including engineers and a hiring manager. Please use the scheduling link to confirm your availability."
        }
    ),
    (
        "Interview — recruiter phone screen",
        False, "Interview",
        {
            "subject": "Let's connect — Stripe recruiting",
            "from_email": "recruiter@stripe.com",
            "snippet": "I'd love to tell you more about the role.",
            "body": "Hi, I'm a recruiter at Stripe and I came across your profile. I'd love to schedule a quick 30-minute call to tell you more about the Backend Engineer Intern opportunity and learn about your background. Please use the link below to find a time that works."
        }
    ),
    (
        "Rejected — standard rejection",
        False, "Rejected",
        {
            "subject": "Update on your application — Snowflake",
            "from_email": "no-reply@greenhouse.io",
            "snippet": "We will not be moving forward.",
            "body": "Hi, thank you for your interest in the Data Engineer Intern position at Snowflake and for the time you invested in our process. After careful consideration, we have decided to move forward with other candidates whose qualifications more closely align with our current needs. We wish you the best in your search."
        }
    ),
    (
        "Rejected — hard negative (mentions assessment but is rejection)",
        False, "Rejected",
        {
            "subject": "Regarding your application — Robinhood",
            "from_email": "recruiting@robinhood.com",
            "snippet": "Thank you for completing the assessment.",
            "body": "Hi, thank you for taking the time to complete the assessment for the Software Engineer Intern role at Robinhood. After reviewing your submission along with those of other candidates, we have decided not to move forward with your application at this time. We appreciate the effort you put in."
        }
    ),
    (
        "Offer — formal offer letter",
        False, "Offer",
        {
            "subject": "Offer of employment — Databricks",
            "from_email": "recruiting@databricks.com",
            "snippet": "We are pleased to extend an offer.",
            "body": "Dear Candidate, we are pleased to extend an offer of employment for the Software Engineer Intern position at Databricks. Please review the attached offer letter carefully and sign by the deadline indicated. We are excited to welcome you to the team. Location: San Francisco, CA."
        }
    ),

    # ── TRICKY NOISE / PROMOTIONAL (should BE skipped) ────────────────────

    (
        "SKIP — LeetCode weekly digest",
        True, None,
        {
            "subject": "LeetCode Weekly Digest — Top problems this week",
            "from_email": "newsletter@leetcode.com",
            "snippet": "Your weekly coding digest is here.",
            "body": "LeetCode Weekly Digest: top contest problems, editorial picks, and discussion highlights from this week. Keep grinding and good luck on your next interview!"
        }
    ),
    (
        "SKIP — Boost Mobile bill",
        True, None,
        {
            "subject": "Restore your service today",
            "from_email": "billing@boostmobile.com",
            "snippet": "Your service has been interrupted.",
            "body": "Your Boost Mobile service has been interrupted due to a missed payment. Restore your service today to stay connected. Click below to pay your bill."
        }
    ),
    (
        "SKIP — Amazon order update",
        True, None,
        {
            "subject": "Update from Seller on Order ID 406-4803246-7520308",
            "from_email": "order-update@amazon.com",
            "snippet": "Your order has shipped.",
            "body": "Your Amazon order has shipped. Your package is on the way and will arrive by Thursday. Track your shipment using the link below."
        }
    ),
    (
        "SKIP — Replit product newsletter",
        True, None,
        {
            "subject": "January Replit Product Updates",
            "from_email": "updates@replit.com",
            "snippet": "See what's new in Replit this month.",
            "body": "Here's what's new in Replit this month: new AI features, editor performance improvements, and community highlights. Check out our latest blog posts."
        }
    ),
    (
        "SKIP — CodePath prework reminder",
        True, None,
        {
            "subject": "Your CodePath Summer Starts Here — Complete Your Prework",
            "from_email": "noreply@codepath.org",
            "snippet": "Complete your prework before the deadline.",
            "body": "Your CodePath summer program starts soon. Make sure to complete your prework before the deadline or you may lose your spot. Log in to the portal to get started."
        }
    ),
    (
        "SKIP — job board weekly alert",
        True, None,
        {
            "subject": "New jobs matching your profile this week",
            "from_email": "jobalerts@indeed.com",
            "snippet": "5 new jobs match your profile.",
            "body": "Here are 5 new jobs that match your profile this week on Indeed: Software Engineer at Company A, Data Analyst at Company B, and more. This is a job alert digest, not an application confirmation."
        }
    ),
    (
        "SKIP — candidate account verification",
        True, None,
        {
            "subject": "Verify your candidate account",
            "from_email": "support@workdayjobs.com",
            "snippet": "Confirm your email address.",
            "body": "Click this link to confirm your email address and complete setup for your candidate account. This link expires in 24 hours."
        }
    ),
    (
        "SKIP — recruiting prep session",
        True, None,
        {
            "subject": "Prep session invitation — improve your outcomes",
            "from_email": "talent@smartrecruiters.com",
            "snippet": "Attend a coaching session to improve your interviewing skills.",
            "body": "You let us know about your application submission. Join a personalized prep session to improve your interviewing and networking skills. Our coaches have helped thousands of candidates land offers."
        }
    ),
    (
        "SKIP — MicroStrategy career quiz",
        True, None,
        {
            "subject": "Let's see if this Career fits",
            "from_email": "jobs@microstrategy.com",
            "snippet": "Take our career fit quiz.",
            "body": "Take our quick quiz to see if a career at MicroStrategy is right for you. Answer a few questions and discover roles that match your interests and skills."
        }
    ),
    (
        "SKIP — Canvas course announcement",
        True, None,
        {
            "subject": "IMPORTANT INFORMATION! PLEASE READ!",
            "from_email": "notifications@instructure.com",
            "snippet": "Canvas course announcement.",
            "body": "Your instructor has posted an announcement in Canvas for CMSC351. Please log in to review the exam logistics and updated office hour schedule."
        }
    ),
]

# ─────────────────────────────────────────────────────────────────────────────
# RUN TESTS
# ─────────────────────────────────────────────────────────────────────────────

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

passed = 0
failed = 0
errors = 0

print(f"\n{BOLD}{'─'*90}{RESET}")
print(f"{BOLD}  LOOPED — Email Parser Test Suite{RESET}")
print(f"{BOLD}{'─'*90}{RESET}\n")

for label, expected_skip, expected_status, payload in tests:
    try:
        r = requests.post(URL, json=payload, timeout=10)
        r.raise_for_status()
        result = r.json()

        got_skip   = result.get("skip", False)
        got_status = result.get("status", "—")
        got_conf   = result.get("confidence", 0) or 0
        got_co     = result.get("company", "—")
        got_pos    = result.get("position", "—")

        # Determine pass/fail
        skip_ok   = (got_skip == expected_skip)
        status_ok = expected_skip or (got_status == expected_status)
        ok        = skip_ok and status_ok

        if ok:
            icon = f"{GREEN}✓ PASS{RESET}"
            passed += 1
        else:
            icon = f"{RED}✗ FAIL{RESET}"
            failed += 1

        print(f"  {icon}  {label}")

        if not skip_ok:
            exp_s = "SKIP" if expected_skip else "KEEP"
            got_s = "SKIP" if got_skip else "KEEP"
            print(f"         {YELLOW}skip:     expected={exp_s}  got={got_s}{RESET}")

        if not status_ok:
            print(f"         {YELLOW}status:   expected={expected_status}  got={got_status}  conf={got_conf:.2f}{RESET}")

        if ok and not expected_skip:
            print(f"         status={got_status} ({got_conf:.2f})  company={got_co}  position={got_pos[:40]}")

        print()

    except requests.exceptions.ConnectionError:
        print(f"  {RED}✗ ERROR{RESET}  {label}")
        print(f"         {YELLOW}Could not connect to {URL} — is your server running?{RESET}\n")
        errors += 1
    except Exception as e:
        print(f"  {RED}✗ ERROR{RESET}  {label}")
        print(f"         {YELLOW}{e}{RESET}\n")
        errors += 1

print(f"{BOLD}{'─'*90}{RESET}")
total = len(tests)
print(f"\n  Results: {GREEN}{passed} passed{RESET}  {RED}{failed} failed{RESET}  {YELLOW}{errors} errors{RESET}  ({total} total)\n")
if failed == 0 and errors == 0:
    print(f"  {GREEN}{BOLD}All tests passed!{RESET}\n")
elif failed > 0:
    print(f"  {YELLOW}Fix the failing cases above, then rerun.{RESET}\n")