# Iruka SAGE — SIH Beta

Iruka SAGE is an AI-powered internship and career guidance platform that helps students **Find → Understand → Improve → Prove → Apply**.

## Student flow

- Enter a profile name manually
- Add education, target role, interests and projects
- Discover internships and receive deterministic match scores
- Open Skill Gap Coach for practical next steps
- Chat with SAGE for career guidance, projects, CV and interview preparation
- Upload certificates for credential screening
- Apply to internships with a CV snapshot

## Company flow

- Enter the hiring portal with email login
- Verify a company-domain email
- Provide employee ID card or company letter evidence
- Post Internship stays locked until both verification layers pass
- Review applications and student CVs

## SAGE AI

SAGE uses **Gemini 3.7 Flash through AIRouter**. The browser never needs the AI API key; the Node server calls the AIRouter API.

```env
AIROUTER_API_KEY=your_airouter_key_here
AIROUTER_BASE_URL=https://api.airouter.in/v1
AIROUTER_MODEL=google/gemini-3.7-flash
```

## Matching vs AI

Internship match scores and skill-gap counts are calculated deterministically from the profile and internship requirements. SAGE then explains the result and recommends what the student can do next. This keeps objective matching separate from AI-generated guidance.

## Credential screening

Certificate verification is separate from profile skills. A manually entered skill is not treated as verified. A certificate can become credential-backed only after the document/name/issuer screening passes. SAGE does not assign beginner/intermediate/advanced proficiency; the hiring company makes that judgment.

## Privacy

Certificate documents use the project's privacy-sanitization pipeline before AI-assisted screening. Do not commit a real `.env` or API key to a public repository. Use `.env.example` as the template and configure the real secret on the machine/deployment service running SAGE.

## Run locally

1. Install Node.js 18+.
2. Create `.env` from `.env.example`.
3. Add your AIRouter key.
4. Run `START.bat` on Windows, or `node server.js`.
5. Open `http://localhost:5173`.

## SIH beta

This is a presentation-ready prototype. Demo internship/company data is intentionally included for the SIH walkthrough.
