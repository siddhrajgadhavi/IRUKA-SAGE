# Iruka SAGE 4.1 — Aadhaar Card Photo Name Screening

This build contains the current SAGE beta architecture plus a simplified government-name screening flow.

## Government identity flow

- Upload a clear PNG/JPG/WEBP photo of the Aadhaar card.
- A bundled prototype DL model proposes card corners.
- OpenCV provides a fallback when the DL proposal is not usable.
- The image is enhanced locally.
- Tesseract OCR runs locally to read the printed government name.
- The extracted name can then be selected into the profile name structure.

This is a **document/name consistency screen**. It is not Aadhaar authentication and does not claim UIDAI cryptographic verification.

There is **no Secure QR step, no DigiLocker step, no Offline e-KYC ZIP/XML step, and no UIDAI signature check** in the active government identity flow.

The Aadhaar image is processed locally and is not sent to AIRouter.

## Start

1. Install Node.js 18+.
2. Run `SETUP-IDENTITY.bat` once on Windows. This installs OpenCV, NumPy, Pillow, Tesseract bindings and the prototype PyTorch runtime.
3. Make a `.env` file from `.env.example` and add your AIRouter key.
4. Run `START.bat`.
5. Open `http://localhost:5173` if it does not open automatically.

## SAGE AI

SAGE uses AIRouter's OpenAI-compatible endpoint with Gemini 3.7 Flash. The API key stays server-side in `.env`.

```env
AIROUTER_API_KEY=your_airouter_key_here
AIROUTER_BASE_URL=https://api.airouter.in/v1
AIROUTER_MODEL=google/gemini-3.7-flash
```

## Important distinction

Certificate uploads have their own credential-screening pipeline. That is separate from the Aadhaar card photo name screen. The Aadhaar flow does not inspect or validate QR codes.
