#!/usr/bin/env python3
import sys, os, re, json
from pathlib import Path

import cv2
import numpy as np


def norm(s):
    return re.sub(r'[^a-z0-9 ]', ' ', str(s).lower()).replace('  ', ' ').strip()


def _order_quad(pts):
    pts = np.asarray(pts, dtype=np.float32).reshape(4, 2)
    sm = pts.sum(axis=1)
    df = pts[:, 1] - pts[:, 0]
    return np.array([pts[np.argmin(sm)], pts[np.argmin(df)], pts[np.argmax(sm)], pts[np.argmax(df)]], dtype=np.float32)


def _warp(img, quad):
    W, H = 1600, 1000
    dst = np.array([[0, 0], [W - 1, 0], [W - 1, H - 1], [0, H - 1]], np.float32)
    return cv2.warpPerspective(img, cv2.getPerspectiveTransform(_order_quad(quad), dst), (W, H), borderMode=cv2.BORDER_REPLICATE)


def _cv_rectify(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 35, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    h, w = gray.shape
    best = None
    best_area = 0
    for c in sorted(contours, key=cv2.contourArea, reverse=True)[:150]:
        area = cv2.contourArea(c)
        if area < 0.30 * w * h:
            continue
        q = cv2.approxPolyDP(c, 0.025 * cv2.arcLength(c, True), True)
        if len(q) == 4 and cv2.isContourConvex(q) and area > best_area:
            best = q.reshape(4, 2)
            best_area = area
    return _warp(img, best) if best is not None else img


def _dl_rectify(img):
    """Prototype DL corner proposal; OpenCV remains the fallback."""
    try:
        import torch
        model_path = Path(__file__).with_name('card_rectifier.pt')
        if not model_path.exists():
            return img
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        small = cv2.resize(gray, (128, 128), interpolation=cv2.INTER_AREA).astype('float32') / 255.0
        model = torch.jit.load(str(model_path), map_location='cpu')
        model.eval()
        with torch.no_grad():
            pred = model(torch.from_numpy(small[None, None]))[0].numpy().reshape(4, 2)
        q = _order_quad(pred * np.array([img.shape[1], img.shape[0]], np.float32))
        area = abs(cv2.contourArea(q))
        if area < 0.20 * img.shape[0] * img.shape[1]:
            return img
        return _warp(img, q)
    except Exception:
        return img


def preprocess_variants(path):
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        return []
    candidates = []
    # Prefer the DL proposal only when it produces a meaningfully different rectangle.
    dl = _dl_rectify(img)
    cv = _cv_rectify(img)
    for x in (dl, cv, img):
        if x is None:
            continue
        x = cv2.resize(x, None, fx=1.6, fy=1.6, interpolation=cv2.INTER_CUBIC)
        lab = cv2.cvtColor(x, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        l = cv2.createCLAHE(2.0, (8, 8)).apply(l)
        enhanced = cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)
        gray = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)
        sharp = cv2.GaussianBlur(gray, (0, 0), 1.0)
        sharp = cv2.addWeighted(gray, 1.5, sharp, -0.5, 0)
        binary = cv2.threshold(sharp, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
        candidates.extend([enhanced, gray, sharp, binary])
    return candidates


def _tesseract_cmd():
    configured = os.environ.get('TESSERACT_CMD', '').strip()
    if configured and Path(configured).is_file():
        return configured
    common = [
        r'C:\Program Files\Tesseract-OCR\tesseract.exe',
        r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    ]
    for p in common:
        if Path(p).is_file():
            return p
    return ''


def ocr_image(path):
    try:
        import pytesseract
        cmd = _tesseract_cmd()
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd
        variants = preprocess_variants(path)
        texts = []
        for img in variants:
            for psm in (6, 11):
                out = pytesseract.image_to_string(img, config=f'--psm {psm}')
                if out and out.strip():
                    texts.append(out)
        return '\n'.join(texts)
    except Exception:
        return ''


def find_name(text):
    from collections import Counter
    lines = [re.sub(r'\s+', ' ', x).strip(' :|-') for x in str(text).splitlines() if x.strip()]
    explicit = []
    for i, line in enumerate(lines):
        low = norm(line)
        if low in ('name', 'naam', 'name of resident') or re.match(r'^(name|naam)\b', low):
            c = re.sub(r'^(name|naam|name of resident)\s*[:\-]?\s*', '', line, flags=re.I).strip()
            c = c.replace(']', 'J').replace('[', 'I').replace('|', 'I')
            c = re.sub(r"[^A-Za-z .\'-]", ' ', c)
            c = re.sub(r'\s+', ' ', c).strip()
            if 2 <= len(c.split()) <= 6 and re.fullmatch(r"[A-Za-z .'-]+", c):
                explicit.append(c)
            elif i + 1 < len(lines):
                c = re.sub(r"[^A-Za-z .\'-]", ' ', lines[i + 1])
                c = re.sub(r'\s+', ' ', c).strip()
                if 2 <= len(c.split()) <= 6 and re.fullmatch(r"[A-Za-z .'-]+", c):
                    explicit.append(c)
    if explicit:
        # Multiple OCR passes are intentionally used. Pick the most repeated labelled-name result.
        return Counter(explicit).most_common(1)[0][0]

    banned = ('government', 'india', 'aadhaar', 'unique', 'identification', 'authority', 'dob', 'male', 'female', 'address', 'enrolment', 'year', 'resident')
    candidates = []
    for line in lines:
        c = line.strip()
        if 2 <= len(c.split()) <= 5 and re.fullmatch(r"[A-Za-z][A-Za-z .'-]+", c) and not re.search(r'\d', c):
            if not any(x in norm(c) for x in banned):
                candidates.append(c)
    return Counter(candidates).most_common(1)[0][0] if candidates else ''

def looks_like_aadhaar(text):
    return bool(re.search(r'\b(aadhaar|uidai|unique identification authority|government of india|my aadhaar)\b', text, re.I))


def main():
    if len(sys.argv) < 4:
        print(json.dumps({'ok': False, 'error': 'usage: government_identity_verifier.py input mime output'}))
        return 2
    src = Path(sys.argv[1])
    mime = sys.argv[2]
    if mime not in ('image/png', 'image/jpeg', 'image/webp'):
        print(json.dumps({'ok': False, 'error': 'Only Aadhaar card photos are supported in this identity flow.'}))
        return 0

    text = ocr_image(src)
    if not text:
        print(json.dumps({'ok': False, 'status': 'needs-review', 'error': 'SAGE could not read the card photo. Try a sharper, well-lit photo with the full card visible.'}))
        return 0

    if not looks_like_aadhaar(text):
        print(json.dumps({'ok': False, 'status': 'rejected', 'error': 'The uploaded image does not contain enough Aadhaar document evidence.'}))
        return 0

    name = find_name(text)
    if not name:
        print(json.dumps({'ok': False, 'status': 'needs-review', 'error': 'Aadhaar document detected, but the printed name could not be read clearly. Try a sharper, well-lit photo.'}))
        return 0

    print(json.dumps({
        'ok': True,
        'status': 'name-imported',
        'verifiedName': name,
        'documentType': 'aadhaar-card-photo',
        'identityStrength': 'document-name-screening',
        'signatureVerified': False,
        'qrVerification': False,
        'message': 'Government name imported from the Aadhaar card photo. This is a local document/name consistency screen; it does not perform UIDAI cryptographic authentication.',
        'ocrUsed': True,
        'rectification': 'DL corner proposal + OpenCV fallback'
    }))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as e:
        print(json.dumps({'ok': False, 'error': str(e)}))
        raise SystemExit(1)
