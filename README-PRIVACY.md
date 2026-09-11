# SAGE Credential Privacy Layer

Before any credential reaches AIRouter AI provider, SAGE runs `privacy_sanitizer.py` locally.

The original upload is never sent to AIRouter AI provider by the credential route.

The sanitizer:
- OCRs PDF/image pages locally with Tesseract.
- Detects and redacts the profile name and common personal identifiers.
- Redacts email, phone, student/application/registration identifiers and labeled personal fields.
- Decodes QR codes locally and preserves a QR only when it resolves to a non-personal HTTP(S) URL; otherwise the QR is redacted.
- Rebuilds PDFs as sanitized page images and strips original PDF metadata.
- Returns a local identity-match signal to SAGE so AIRouter AI provider does not need to receive the student's name.
- Fails closed: if the sanitizer cannot run, SAGE returns an error and does not send the original credential to AIRouter AI provider.

Install:
1. Run `SETUP-PRIVACY.bat`.
2. Make sure the Tesseract executable is installed and available on PATH.
3. Keep `GEMINI_API_KEY` and `OPENAI_API_KEY` in `.env` only.

Privacy note: the sanitizer minimizes PII sent to AIRouter AI provider; it does not change the provider's retention/data-use policy. The current AIRouter AI provider free tier states that content may be used to improve Google's products, so do not rely on this layer as a guarantee of zero exposure. For production, use a paid tier with the applicable data-use terms or a provider/configuration that meets your privacy requirements.
