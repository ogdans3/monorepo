"""Local-only inference. No user data leaves this service; models are downloaded once."""
import base64
import io
import json
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

TEXT_MODEL = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
IMAGE_MODEL = "sentence-transformers/clip-ViT-B-32"
VISUAL_TEXT_MODEL = "sentence-transformers/clip-ViT-B-32-multilingual-v1"
models = {}
lock = threading.Lock()


def model(name):
    if name not in models:
        from sentence_transformers import SentenceTransformer
        models[name] = SentenceTransformer(name, device="cpu", trust_remote_code=False)
    return models[name]


def file_path(key):
    if not re.fullmatch(r"[0-9a-f]{64}(?:\.[a-z0-9]+)?", key):
        raise ValueError("Invalid file key")
    path = Path("/data/files") / key
    if not path.is_file():
        raise ValueError("File not found")
    return path


def execute(path, data):
    if path == "/embed":
        texts = data.get("texts", [])
        if not texts or len(texts) > 32 or any(not isinstance(t, str) or len(t) > 16000 for t in texts):
            raise ValueError("Use 1–32 texts of at most 16000 characters")
        name = VISUAL_TEXT_MODEL if data.get("visual") else TEXT_MODEL
        return {"model": name, "vectors": model(name).encode(texts, normalize_embeddings=True).tolist()}
    if path == "/image":
        from PIL import Image, ImageOps
        Image.MAX_IMAGE_PIXELS = 40_000_000
        if data.get("key"):
            source = file_path(data["key"])
        else:
            source = io.BytesIO(base64.b64decode(data.get("base64", ""), validate=True))
        with Image.open(source) as im:
            im = ImageOps.exif_transpose(im).convert("RGB")
            return {"model": IMAGE_MODEL, "vectors": model(IMAGE_MODEL).encode([im], normalize_embeddings=True).tolist()}
    if path == "/categorize":
        from categories import classify
        from PIL import Image, ImageOps
        text = data.get("text", "")
        if not isinstance(text,str) or len(text)>16000:
            raise ValueError("Text too long")
        if data.get("key"):
            with Image.open(file_path(data["key"])) as raw:
                im=ImageOps.exif_transpose(raw).convert("RGB")
                return classify(text,im,model,TEXT_MODEL,IMAGE_MODEL)
        return classify(text,None,model,TEXT_MODEL,IMAGE_MODEL)
    if path == "/transcribe":
        from faster_whisper import WhisperModel
        if "whisper" not in models:
            models["whisper"] = WhisperModel("base", device="cpu", compute_type="int8", download_root="/models/whisper", cpu_threads=2)
        segments, info = models["whisper"].transcribe(str(file_path(data["key"])), beam_size=3, vad_filter=True)
        result = []
        for s in segments:
            result.append({"start_seconds": s.start, "end_seconds": s.end, "body": s.text, "kind": "speech"})
            if len(result) >= 2000:
                raise ValueError("Recording exceeds 2000 segments")
        return {"segments": result, "language": info.language, "model": "faster-whisper/base"}
    raise ValueError("Unknown operation")


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self.respond(200 if self.path == "/health" else 404, {"ok": self.path == "/health", "loaded": list(models)})

    def do_POST(self):
        size = int(self.headers.get("Content-Length", "0"))
        if size <= 0 or size > 16 * 1024 * 1024:
            return self.respond(413, {"error": "Payload too large"})
        if not lock.acquire(blocking=False):
            return self.respond(429, {"error": "Local inference is busy; try again later"})
        try:
            self.respond(200, execute(self.path, json.loads(self.rfile.read(size))))
        except Exception as error:
            self.respond(422, {"error": str(error)[:300]})
        finally:
            lock.release()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8090), Handler).serve_forever()
