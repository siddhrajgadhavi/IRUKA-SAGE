# SAGE Government Name Screening

The current prototype identity flow is deliberately simple:

1. Student uploads a clear photo of the Aadhaar card.
2. A bundled prototype DL model proposes the card corners.
3. OpenCV provides a document-rectangle fallback.
4. The image is enhanced locally.
5. Tesseract OCR runs locally and extracts the printed name.
6. SAGE imports that government name for profile-name consistency.

This is a **document/name consistency screen**, not UIDAI authentication. It does not decode, validate, or require a Secure QR, DigiLocker credential, Offline e-KYC ZIP, XML signature, or UIDAI cryptographic signature.

The Aadhaar image is processed locally by the SAGE server and is not sent to the AIRouter AI model.
