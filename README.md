# Iruka SAGE

### Smart Skill-Match & Career Intelligence Platform

Iruka SAGE is an AI-powered internship and career platform designed to bridge the gap between students and industry.

Instead of simply listing internships, SAGE helps students understand:
• Which internships fit their current profile
• Why they match
• Which skills they are missing
• What they should learn next
• How to improve their CV and projects
• How to prepare for interviews

At the same time, companies get a structured way to discover students, review applications and verify their organizational identity.

---

## 🚀 What SAGE Does

### For Students
• Build a profile with education, skills, interests and projects
• Discover relevant internships
• Get deterministic skill-based match scores
• See skill gaps for each opportunity
• Get personalized guidance from SAGE
• Receive project and learning recommendations
• Apply for internships with a CV snapshot
• Track applications

### For Companies
• Access a dedicated recruiter portal
• Create internship opportunities
• Review student applications and CVs
• Identify preferred candidates
• Complete two-layer company verification
• Posting remains locked until verification requirements are satisfied

---

## 🧠 SAGE AI

SAGE is the career-intelligence layer of Iruka.

The application uses Gemini 3.7 Flash through AIRouter's OpenAI-compatible API.

SAGE can:
• Analyze student context
• Explain internship matches
• Identify skill gaps
• Create learning roadmaps
• Suggest portfolio projects
• Help improve CVs
• Prepare students for interviews
• Answer general questions without forcing every conversation into career advice

The foundation model is pre-trained. Iruka SAGE customizes its behavior through structured prompts, profile context, internship data and application logic rather than training a foundation model from scratch.

---

## 🎯 Matching Engine

Internship matching is handled separately from the AI.

The backend calculates skill overlap between a student's profile and internship requirements. SAGE then uses that structured result to explain the match and recommend next steps.

This separation makes objective matching more predictable while allowing AI to provide personalized guidance.

---

## 🛡️ Verification

Iruka SAGE uses verification as an evidence layer rather than allowing users to simply claim that a skill is verified.

### Student credentials
Credential documents can be screened for:
• Recipient-name consistency
• Credential/document structure
• Course or credential title
• Issuer information
• Date and credential ID when available
• Additional verification evidence when useful

A credential does not automatically determine a student's skill level. Final evaluation of what a credential demonstrates remains with the hiring organization.

### Company verification
Recruiters use two layers:
1. Company-domain email verification
2. Employee ID card or official company letter

Internship posting is unlocked only after the required verification checks pass.

---

## ⚙️ Technology Stack

Frontend:
• HTML
• CSS
• JavaScript

Backend:
• Node.js
• Express-style REST API architecture

AI:
• Gemini 3.7 Flash
• AIRouter OpenAI-compatible API

Document processing:
• Python
• OCR
• Image/PDF processing

The frontend communicates with the Node.js backend, while AI requests and document-processing operations remain server-side.

---

## 🔄 System Flow

Student / Recruiter
        ↓
Iruka SAGE Web Interface
        ↓
Node.js Backend
        ↓
Matching / Verification / Application Logic
        ↓
AIRouter
        ↓
Gemini 3.7 Flash
        ↓
SAGE Response

---

## 💡 What Makes Iruka SAGE Different?

Most internship platforms focus on finding opportunities.

Iruka SAGE focuses on the complete journey:

Find → Understand → Improve → Prove → Apply

The goal is not just to tell a student which internship they can apply for, but to explain what they should do to become a stronger candidate.

---

## 🔮 Future Scope

• Semantic skill matching using embeddings
• Larger internship and industry datasets
• Advanced recruiter analytics
• More document verification integrations
• Personalized long-term learning paths
• Production database and scalable cloud deployment
• Privacy-preserving analytics and anonymized model improvement

---

## 🏗️ Project Status

Iruka SAGE is currently a working beta/prototype demonstrating the core student, AI, application, recruiter and verification workflows.

Built for Smart India Hackathon.
