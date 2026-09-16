#!/usr/bin/env python3
"""Generate cute animation-style images for French sentences.

Providers:
  arvan  — Arvan AIaaS for translation and image (default)
  avalai — AvalAI Gemini for translation and image

Usage:
  python3 tools/generate_learning_scenes.py
  python3 tools/generate_learning_scenes.py --provider arvan
  python3 tools/generate_learning_scenes.py --provider avalai
  python3 tools/generate_learning_scenes.py "Elle ouvre un dossier important."

Env (.env):
  ARVAN_API_KEY, ARVAN_ENDPOINT, ARVAN_TEXT_MODEL, ARVAN_IMAGE_MODEL
  AVALAI_API_KEY
  LEARNING_AI_PROVIDER=arvan|avalai

Docs:
  https://docs.arvancloud.ir/fa/aiaas/api-usage/
  https://docs.avalai.ir/fa/
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCENES_DIR = ROOT / "learning-scenes"
IMAGES_DIR = SCENES_DIR / "images"
SCENES_JSON = SCENES_DIR / "scenes.json"
ANKI_JSON = ROOT / "anki_parsed.json"
COURSE_LEVELS = ("A1", "A2", "B1", "B2")

AVALAI_BASE = "https://api.avalai.ir/v1"
AVALAI_TEXT_MODEL = "gemini-2.5-flash-lite"
AVALAI_IMAGE_MODEL = "gemini-3.1-flash-lite-image"
DEFAULT_ARVAN_TEXT_MODEL = "Gemini-2.5-Flash-lite"
DEFAULT_ARVAN_IMAGE_MODEL = "Gemini-3.1-Flash-Image-Preview"
MARKDOWN_IMAGE_RE = re.compile(r"!\[[^\]]*\]\(([^)]+)\)")
DATA_IMAGE_RE = re.compile(r"data:image/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+")

IMAGE_STYLE = (
    "Cute lightweight 2D animation still for a French flashcard. "
    "Soft pastel colors, simple clean shapes, friendly cartoon characters, "
    "Pixar-lite / modern animation style, uncluttered composition. "
    "No text, no letters, no watermark, no logo, no caption. "
    "Square educational illustration that is easy to remember."
)

TRANSLATE_SYSTEM = """You help a Persian speaker memorize French A1 sentences with pictures.
Given one French sentence, reply with JSON only:
{"persian":"...","image_prompt":"..."}
- persian: natural idiomatic Persian translation
- image_prompt: one English visual description of the exact scene (people, objects, emotion, setting)
If a name like Marie appears, keep that person as a consistent cute adult cartoon character.
Do not add extra commentary."""


@dataclass
class Settings:
    provider: str
    avalai_key: str
    arvan_key: str
    arvan_endpoint: str
    arvan_text_model: str
    arvan_image_model: str
    compress: bool

    @property
    def text_model(self) -> str:
        return self.arvan_text_model if self.provider == "arvan" else AVALAI_TEXT_MODEL

    @property
    def image_model(self) -> str:
        return self.arvan_image_model if self.provider == "arvan" else AVALAI_IMAGE_MODEL


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if raw.startswith("export "):
            raw = raw[7:].strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return (text[:60] or "scene").strip("-")


def normalize_french(text: str) -> str:
    text = unicodedata.normalize("NFKC", text or "")
    text = text.replace("\u2019", "'").replace("\u2018", "'").replace("`", "'")
    text = text.replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    text = text.rstrip(".!?;:…").strip()
    return text.casefold()


def normalize_lesson(value: str) -> str:
    lesson = str(value or "").strip()
    if lesson.isdigit():
        return lesson.zfill(2)
    return lesson


_ANKI_LOOKUP: dict[str, dict] | None = None


def load_anki_lookup() -> dict[str, dict]:
    global _ANKI_LOOKUP
    if _ANKI_LOOKUP is not None:
        return _ANKI_LOOKUP
    if not ANKI_JSON.is_file():
        _ANKI_LOOKUP = {}
        return _ANKI_LOOKUP
    data = json.loads(ANKI_JSON.read_text(encoding="utf-8"))
    sentences = data.get("sentences") if isinstance(data, dict) else data
    lookup: dict[str, dict] = {}
    for item in sentences or []:
        key = normalize_french(item.get("fr") or "")
        if key and key not in lookup:
            lookup[key] = item
    _ANKI_LOOKUP = lookup
    return lookup


def resolve_scene_meta(french: str, level: str = "", lesson: str = "") -> dict:
    resolved_level = str(level or "").strip().upper()
    resolved_lesson = normalize_lesson(lesson)
    match = load_anki_lookup().get(normalize_french(french), {})
    if resolved_level not in COURSE_LEVELS:
        match_level = str(match.get("level") or "").strip().upper()
        resolved_level = match_level if match_level in COURSE_LEVELS else "A1"
    if not resolved_lesson:
        resolved_lesson = normalize_lesson(match.get("lesson") or "")
    return {"level": resolved_level, "lesson": resolved_lesson}


def scene_exists(catalog: dict, french: str) -> bool:
    key = normalize_french(french)
    return any(normalize_french(item.get("french") or "") == key for item in catalog["scenes"])


def load_catalog() -> dict:
    if SCENES_JSON.is_file():
        data = json.loads(SCENES_JSON.read_text(encoding="utf-8"))
        if isinstance(data, list):
            data = {"updatedAt": None, "scenes": data}
        data.setdefault("scenes", [])
        return data
    return {"updatedAt": None, "scenes": []}


def save_catalog(catalog: dict) -> None:
    catalog["updatedAt"] = utc_now()
    SCENES_JSON.write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def upsert_scene(catalog: dict, scene: dict) -> None:
    scenes = catalog["scenes"]
    for index, existing in enumerate(scenes):
        if existing.get("id") == scene["id"] or existing.get("french") == scene["french"]:
            scenes[index] = {**existing, **scene}
            return
    scenes.append(scene)


def normalize_chat_url(base: str) -> str:
    url = (base or "").strip().rstrip("/")
    if not url:
        raise ValueError("آدرس Endpoint آروان خالی است.")
    if url.endswith("/chat/completions"):
        return url
    if url.endswith("/v1"):
        return f"{url}/chat/completions"
    return f"{url}/v1/chat/completions"


def chat_request(url: str, authorization: str, payload: dict, timeout: int = 180) -> dict:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": authorization,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"AI {exc.code}: {detail[:800]}") from exc


def text_chat(settings: Settings, payload: dict, timeout: int = 90) -> dict:
    if settings.provider == "arvan":
        return chat_request(
            normalize_chat_url(settings.arvan_endpoint),
            f"apikey {settings.arvan_key}",
            payload,
            timeout=timeout,
        )
    return chat_request(
        f"{AVALAI_BASE}/chat/completions",
        f"Bearer {settings.avalai_key}",
        payload,
        timeout=timeout,
    )


def extract_message_text(data: dict) -> str:
    choice = (data.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    content = message.get("content")
    if isinstance(content, str):
        text = content
    elif isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                if item.get("type") in {"text", "output_text"} and item.get("text"):
                    parts.append(item["text"])
        text = "\n".join(parts)
    else:
        text = ""
    reasoning = message.get("reasoning_content") or message.get("reasoning")
    if isinstance(reasoning, str) and reasoning.strip() and not text.strip():
        text = reasoning
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S)
    return text.strip()


def parse_json_object(text: str) -> dict:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", cleaned, flags=re.S)
    if not match:
        raise ValueError("پاسخ ترجمه JSON نبود.")
    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("پاسخ ترجمه نامعتبر است.")
    return parsed


def translate_sentence(settings: Settings, french: str) -> dict:
    payload = {
        "model": settings.text_model,
        "temperature": 0.2,
        "max_tokens": 800,
        "messages": [
            {"role": "system", "content": TRANSLATE_SYSTEM},
            {"role": "user", "content": french},
        ],
    }
    data = text_chat(settings, payload, timeout=90)
    parsed = parse_json_object(extract_message_text(data))
    persian = str(parsed.get("persian") or "").strip()
    image_prompt = str(parsed.get("image_prompt") or parsed.get("prompt") or "").strip()
    if not persian:
        raise ValueError("ترجمه فارسی برنگشت.")
    if not image_prompt:
        image_prompt = f"A simple cartoon scene showing: {french}"
    return {"persian": persian, "image_prompt": image_prompt}


def collect_image_urls(node) -> list[str]:
    found = []
    if isinstance(node, dict):
        url = None
        image_url = node.get("image_url")
        if isinstance(image_url, dict):
            url = image_url.get("url")
        elif isinstance(image_url, str):
            url = image_url
        if not url:
            url = node.get("url") or node.get("b64_json")
        if isinstance(url, str) and (
            url.startswith("data:image") or url.startswith("http") or len(url) > 200
        ):
            found.append(url)
        for value in node.values():
            found.extend(collect_image_urls(value))
    elif isinstance(node, list):
        for item in node:
            found.extend(collect_image_urls(item))
    elif isinstance(node, str):
        found.extend(extract_images_from_text(node))
    return found


def extract_images_from_text(text: str) -> list[str]:
    found = []
    for match in MARKDOWN_IMAGE_RE.finditer(text or ""):
        url = match.group(1).strip()
        if url.startswith("data:image") or url.startswith("http"):
            found.append(re.sub(r"\s+", "", url) if url.startswith("data:image") else url)
    for match in DATA_IMAGE_RE.finditer(text or ""):
        found.append(re.sub(r"\s+", "", match.group(0)))
    return found


def collect_image_payloads(data: dict) -> list[str]:
    found = collect_image_urls(data)
    seen = []
    for item in found:
        if item not in seen:
            seen.append(item)
    return seen


def decode_image_payload(payload: str) -> bytes:
    if payload.startswith("data:image"):
        _, encoded = payload.split(",", 1)
        return base64.b64decode(encoded)
    if payload.startswith("http://") or payload.startswith("https://"):
        with urllib.request.urlopen(payload, timeout=90) as response:
            return response.read()
    return base64.b64decode(payload)


def generate_image(settings: Settings, image_prompt: str) -> bytes:
    prompt = f"{IMAGE_STYLE}\n\nScene: {image_prompt}"
    payload = {
        "model": settings.image_model,
        "messages": [{"role": "user", "content": prompt}],
        "modalities": ["image", "text"],
        "max_tokens": 3000,
        "temperature": 0.7,
    }
    if settings.provider == "avalai":
        payload["generationConfig"] = {
            "imageConfig": {
                "aspectRatio": "1:1",
                "imageSize": "1K",
            }
        }
    data = text_chat(settings, payload, timeout=180)
    urls = collect_image_payloads(data)
    if not urls:
        preview = json.dumps(data, ensure_ascii=False)[:600]
        raise RuntimeError(f"تصویری در پاسخ {settings.provider} نبود.\n{preview}")
    return decode_image_payload(urls[0])


def compress_image(src: Path, dest: Path) -> bool:
    if sys.platform != "darwin":
        return False
    try:
        subprocess.run(
            [
                "sips",
                "-Z",
                "768",
                "-s",
                "format",
                "jpeg",
                "-s",
                "formatOptions",
                "70",
                str(src),
                "--out",
                str(dest),
            ],
            check=True,
            capture_output=True,
        )
        return dest.is_file() and dest.stat().st_size > 0
    except (OSError, subprocess.CalledProcessError):
        return False


def unique_id(catalog: dict, french: str) -> str:
    base = slugify(french)
    existing = {item.get("id") for item in catalog["scenes"]}
    if base not in existing:
        return base
    for existing_item in catalog["scenes"]:
        if existing_item.get("french") == french:
            return existing_item["id"]
    index = 2
    while f"{base}-{index}" in existing:
        index += 1
    return f"{base}-{index}"


def process_sentence(settings: Settings, french: str, *, level: str = "", lesson: str = "") -> dict:
    french = " ".join(french.strip().split())
    if not french:
        raise ValueError("جمله خالی است.")

    catalog = load_catalog()
    if scene_exists(catalog, french):
        print(f"\n↷ قبلاً ساخته شده، رد شد: {french}")
        return next(
            item
            for item in catalog["scenes"]
            if normalize_french(item.get("french") or "") == normalize_french(french)
        )

    print(f"\n→ ترجمه با {settings.provider} / {settings.text_model} …")
    translated = translate_sentence(settings, french)
    print(f"  فارسی: {translated['persian']}")

    print(f"→ ساخت تصویر انیمیشنی با {settings.provider} / {settings.image_model} …")
    raw_bytes = generate_image(settings, translated["image_prompt"])

    scene_id = unique_id(catalog, french)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    raw_path = IMAGES_DIR / f"{scene_id}.png"
    raw_path.write_bytes(raw_bytes)

    final_name = f"{scene_id}.jpg"
    final_path = IMAGES_DIR / final_name
    if settings.compress and compress_image(raw_path, final_path):
        raw_path.unlink(missing_ok=True)
    else:
        final_name = f"{scene_id}.png"
        final_path = raw_path

    size_kb = max(1, final_path.stat().st_size // 1024)
    image_link = f"learning-scenes/images/{final_name}"
    scene = {
        "id": scene_id,
        "french": french,
        "persian": translated["persian"],
        "image": image_link,
        **resolve_scene_meta(french, level, lesson),
    }
    upsert_scene(catalog, scene)
    save_catalog(catalog)
    print(f"  ذخیره شد: {image_link} ({size_kb} KB)")
    print(f"  JSON: {SCENES_JSON.relative_to(ROOT)}  •  {len(catalog['scenes'])} صحنه")
    return scene


def read_sentences(args: argparse.Namespace) -> list[str]:
    sentences = [item.strip() for item in args.sentences if item.strip()]
    if args.file:
        path = Path(args.file)
        sentences.extend(
            line.strip()
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.strip().startswith("#")
        )
    return sentences


def prompt_value(label: str) -> str:
    try:
        return input(label).strip()
    except EOFError:
        return ""


def resolve_settings(args: argparse.Namespace) -> Settings:
    load_dotenv(ROOT / ".env")
    provider = (args.provider or os.environ.get("LEARNING_AI_PROVIDER") or "arvan").strip().lower()
    if provider not in {"arvan", "avalai"}:
        raise SystemExit("provider باید arvan یا avalai باشد.")

    avalai_key = (
        (args.avalai_key or args.key or "").strip()
        or os.environ.get("AVALAI_API_KEY", "").strip()
    )
    arvan_key = (args.arvan_key or "").strip() or os.environ.get("ARVAN_API_KEY", "").strip()
    endpoint = (args.endpoint or "").strip() or os.environ.get("ARVAN_ENDPOINT", "").strip()
    text_model = (
        (args.text_model or "").strip()
        or os.environ.get("ARVAN_TEXT_MODEL", "").strip()
        or DEFAULT_ARVAN_TEXT_MODEL
    )
    image_model = (
        (args.image_model or args.model or "").strip()
        or os.environ.get("ARVAN_IMAGE_MODEL", "").strip()
        or os.environ.get("ARVAN_MODEL", "").strip()
        or DEFAULT_ARVAN_IMAGE_MODEL
    )

    if provider == "arvan":
        if not arvan_key:
            arvan_key = prompt_value("کلید آروان را وارد کن: ")
        if not arvan_key:
            raise SystemExit("کلید آروان پیدا نشد. ARVAN_API_KEY را در .env بگذار.")
        if not endpoint:
            endpoint = prompt_value("آدرس Endpoint آروان را وارد کن: ")
        if not endpoint:
            raise SystemExit(
                "آدرس Endpoint آروان لازم است. از پنل AIaaS کپی کن و در ARVAN_ENDPOINT بگذار."
            )
    else:
        if not avalai_key:
            avalai_key = prompt_value("کلید AvalAI را وارد کن: ")
        if not avalai_key:
            raise SystemExit("کلید AvalAI پیدا نشد. AVALAI_API_KEY را در .env بگذار.")

    return Settings(
        provider=provider,
        avalai_key=avalai_key,
        arvan_key=arvan_key,
        arvan_endpoint=endpoint,
        arvan_text_model=text_model,
        arvan_image_model=image_model,
        compress=not args.no_compress,
    )


def interactive_loop(settings: Settings) -> None:
    print()
    print(f"{settings.provider} • یادگیری با تصویر انیمیشنی")
    print(f"متن: {settings.text_model}")
    print(f"عکس: {settings.image_model}")
    print("جمله فرانسه را بنویس. خالی بگذار یا quit بزن تا خارج شوی.")
    print("مثال: Elle ouvre un dossier important.")
    while True:
        try:
            french = input("\nجمله فرانسه: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nتمام.")
            return
        if not french or french.lower() in {"q", "quit", "exit"}:
            print("تمام.")
            return
        try:
            process_sentence(settings, french)
        except Exception as exc:
            print(f"خطا: {exc}")
            time.sleep(0.3)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Generate animation scenes with Arvan or AvalAI."
    )
    parser.add_argument("sentences", nargs="*", help="French sentences to generate now")
    parser.add_argument("--file", help="Text file with one French sentence per line")
    parser.add_argument(
        "--provider",
        choices=("arvan", "avalai"),
        help="Provider (default: LEARNING_AI_PROVIDER or arvan)",
    )
    parser.add_argument("--endpoint", help="Arvan AIaaS endpoint URL")
    parser.add_argument("--text-model", help=f"Arvan text model (default: {DEFAULT_ARVAN_TEXT_MODEL})")
    parser.add_argument("--image-model", help=f"Arvan image model (default: {DEFAULT_ARVAN_IMAGE_MODEL})")
    parser.add_argument("--model", help="Alias for --image-model")
    parser.add_argument("--arvan-key", help="Arvan API key")
    parser.add_argument("--avalai-key", help="AvalAI API key")
    parser.add_argument("--key", help="Alias for --avalai-key")
    parser.add_argument("--no-compress", action="store_true", help="Keep the raw PNG")
    parser.add_argument("--level", default="", help="Course level: A1, A2, B1, or B2")
    parser.add_argument("--lesson", default="", help="Lesson number, e.g. 09")
    args = parser.parse_args()

    SCENES_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    if not SCENES_JSON.exists():
        save_catalog({"updatedAt": None, "scenes": []})

    settings = resolve_settings(args)
    batch = read_sentences(args)

    if batch:
        failed = 0
        for french in batch:
            try:
                process_sentence(settings, french, level=args.level, lesson=args.lesson)
            except Exception as exc:
                failed += 1
                print(f"خطا برای «{french}»: {exc}")
        return 1 if failed else 0

    interactive_loop(settings)
    return 0


if __name__ == "__main__":
    sys.exit(main())
