# Render deployment

Build command:
```
npm install
```

Start command:
```
node server.js
```

Certificate verification is Render-safe and does not require Python, OpenCV, or a system Tesseract executable. PDF text extraction and image OCR run through Node dependencies. The original certificate is not sent to AIRouter; only locally extracted/redacted text is sent for credential screening.
