#!/usr/bin/env python3
"""Local PII sanitizer for SAGE credential documents.

The original credential never goes to Gemini. This script OCRs/render pages locally,
redacts likely personal identifiers, preserves non-sensitive certificate layout, and
keeps only QR codes that decode to a non-personal URL.
"""
import sys, os, re, json, shutil, tempfile
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw
import pytesseract
from pytesseract import Output

# Windows-friendly Tesseract discovery. PATH is optional.
def _find_tesseract():
    candidates=[
        os.environ.get("TESSERACT_CMD", ""),
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Tesseract-OCR\tesseract.exe"),
    ]
    try:
        import shutil as _shutil
        found=_shutil.which("tesseract.exe") or _shutil.which("tesseract")
        if found: candidates.insert(0,found)
    except Exception: pass
    if sys.platform=="win32":
        try:
            import winreg
            for hive,subkey in [(winreg.HKEY_LOCAL_MACHINE,r"SOFTWARE\Tesseract-OCR"),(winreg.HKEY_LOCAL_MACHINE,r"SOFTWARE\WOW6432Node\Tesseract-OCR"),(winreg.HKEY_CURRENT_USER,r"SOFTWARE\Tesseract-OCR")]:
                try:
                    with winreg.OpenKey(hive,subkey) as key:
                        install_dir,_=winreg.QueryValueEx(key,"InstallDir")
                        candidates.append(str(Path(install_dir)/"tesseract.exe"))
                except OSError: pass
        except Exception: pass
    for candidate in candidates:
        if candidate and Path(candidate).is_file(): return str(Path(candidate))
    return None
TESSERACT_CMD=_find_tesseract()
if TESSERACT_CMD: pytesseract.pytesseract.tesseract_cmd=TESSERACT_CMD
import cv2

PII_LABELS = re.compile(r"\b(name|recipient|candidate|student|learner|applicant|email|e-mail|phone|mobile|contact|address|dob|date of birth|student id|student no|registration no|registration number|application no|application number|personal id)\b", re.I)
EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)
PHONE_RE = re.compile(r"(?<!\d)(?:\+?\d[\d .()\-]{7,}\d)(?!\d)")
ID_RE = re.compile(r"\b(?:student|registration|application|enrollment|learner|candidate|personal)\s*(?:id|no|number|#)?\s*[:#-]?\s*[A-Z0-9][A-Z0-9./_-]{4,}\b", re.I)


def norm(s):
    return re.sub(r"[^a-z0-9 ]", " ", str(s).lower()).replace("  ", " ").strip()


def rect_for_words(data, indexes, pad=8):
    xs=[]; ys=[]; xe=[]; ye=[]
    for i in indexes:
        try:
            x,y,w,h=int(data['left'][i]),int(data['top'][i]),int(data['width'][i]),int(data['height'][i])
            xs.append(x); ys.append(y); xe.append(x+w); ye.append(y+h)
        except Exception: pass
    if not xs: return None
    return (max(0,min(xs)-pad), max(0,min(ys)-pad), max(xe)+pad, max(ye)+pad)


def redact_page(img, profile_name):
    draw=ImageDraw.Draw(img)
    data=pytesseract.image_to_data(img, output_type=Output.DICT, config='--psm 6')
    words=[]
    for i,t in enumerate(data['text']):
        t=str(t).strip()
        if t:
            words.append((i,t,int(data['top'][i]),int(data['left'][i]),int(data['width'][i]),int(data['height'][i])))

    boxes=[]
    profile_found=False
    full_lines={}
    # Group by OCR line and redact lines that are clearly personal-info fields.
    for i,t,top,left,w,h in words:
        key=(data['block_num'][i], data['par_num'][i], data['line_num'][i])
        full_lines.setdefault(key,[]).append(i)
    for inds in full_lines.values():
        text=' '.join(str(data['text'][i]) for i in inds).strip()
        n=norm(text)
        pn=norm(profile_name)
        has_profile=bool(pn) and all(tok in n.split() for tok in pn.split())
        if has_profile:
            profile_found=True
        if PII_LABELS.search(text) or EMAIL_RE.search(text) or ID_RE.search(text) or has_profile:
            r=rect_for_words(data, inds, pad=10)
            if r: boxes.append(r)

    # Regex-level PII in individual OCR words/lines.
    for inds in full_lines.values():
        text=' '.join(str(data['text'][i]) for i in inds).strip()
        if EMAIL_RE.search(text) or PHONE_RE.search(text):
            r=rect_for_words(data, inds, pad=10)
            if r: boxes.append(r)

    # QR policy: preserve only a decoded URL that does not contain obvious PII.
    arr=cv2.cvtColor(__import__('numpy').array(img), cv2.COLOR_RGB2BGR)
    detector=cv2.QRCodeDetector()
    decoded, pts, _ = detector.detectAndDecode(arr)
    qr_value=(decoded or '').strip()
    if pts is not None:
        pts=pts.astype(int).reshape(-1,2)
        qrbox=(max(0,int(pts[:,0].min())-8), max(0,int(pts[:,1].min())-8), int(pts[:,0].max()+8), int(pts[:,1].max()+8))
        safe_url=bool(re.match(r'^https?://',qr_value,re.I)) and not EMAIL_RE.search(qr_value) and not (norm(profile_name) and any(tok in norm(qr_value).split() for tok in norm(profile_name).split()))
        if not safe_url:
            boxes.append(qrbox)

    # Merge simple overlapping boxes to avoid patchy redactions.
    for r in boxes:
        draw.rectangle(r, fill='white')
    # OCR again AFTER redaction so no original PII is returned to the AI provider.
    sanitized_text=pytesseract.image_to_string(img, config='--psm 6')
    return img, {'qrDecoded': qr_value if pts is not None and qr_value else None, 'redactions': len(boxes), 'profileNameMatched': profile_found, 'ocrText': sanitized_text}


def sanitize(src, dst, profile_name):
    src=Path(src); dst=Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    ext=src.suffix.lower()
    if ext == '.pdf':
        pdf=pymupdf.open(src)
        out=pymupdf.open()
        info={'pages':len(pdf),'redactions':0,'qrDecoded':[],'profileNameMatched':False,'ocrText':''}
        for page in pdf:
            pix=page.get_pixmap(matrix=pymupdf.Matrix(2,2), alpha=False)
            img=Image.frombytes('RGB',[pix.width,pix.height],pix.samples)
            img, meta=redact_page(img, profile_name)
            info['redactions']+=meta['redactions']
            info['profileNameMatched']=info['profileNameMatched'] or meta['profileNameMatched']
            if meta['qrDecoded']: info['qrDecoded'].append(meta['qrDecoded'])
            if meta.get('ocrText'): info['ocrText'] += '\n' + meta['ocrText']
            fd,tmp=tempfile.mkstemp(suffix='.png'); os.close(fd)
            img.save(tmp,'PNG')
            p=out.new_page(width=img.width*72/150, height=img.height*72/150)
            p.insert_image(p.rect, filename=tmp)
            os.unlink(tmp)
        out.set_metadata({'title':'SAGE Sanitized Credential','author':'SAGE Local Privacy Filter','subject':'PII-redacted credential for AI assessment','keywords':'sanitized,credential,privacy'})
        out.save(dst)
        out.close(); pdf.close()
    else:
        img=Image.open(src).convert('RGB')
        img,meta=redact_page(img, profile_name)
        img.save(dst, 'PNG', optimize=True)
        info={'pages':1,'redactions':meta['redactions'],'qrDecoded':[meta['qrDecoded']] if meta['qrDecoded'] else [],'profileNameMatched':meta['profileNameMatched'],'ocrText':meta.get('ocrText','')}
    return info

if __name__=='__main__':
    if len(sys.argv)<4:
        print(json.dumps({'error':'usage: privacy_sanitizer.py input output profile_name'})); sys.exit(2)
    try:
        if not TESSERACT_CMD:
            raise RuntimeError('Tesseract OCR was not found. SAGE checked common Windows install locations, PATH, LocalAppData, and the Windows registry.')
        pytesseract.get_tesseract_version()
        print(json.dumps(sanitize(sys.argv[1],sys.argv[2],sys.argv[3])))
    except Exception as e:
        print(json.dumps({'error':str(e)})); sys.exit(1)
