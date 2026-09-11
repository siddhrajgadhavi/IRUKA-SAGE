# Render deployment

This project uses Python for government identity image processing and credential privacy screening.

## Render Build Command

Use:

```bash
apt-get update && apt-get install -y tesseract-ocr && npm install && pip3 install -r requirements.txt
```

## Start Command

```bash
node server.js
```

The Python dependencies are installed during the Render build. Tesseract OCR is installed as a system package.
