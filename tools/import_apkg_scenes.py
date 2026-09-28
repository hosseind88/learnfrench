#!/usr/bin/env python3
"""Import illustrated Anki cards into learning-scenes/.

The pictures already stored in the .apkg are copied in (resized like the
other scene images) and registered in learning-scenes/scenes.json.

Usage:
  python3 tools/import_apkg_scenes.py "/path/to/Communication essentielle A2(+images).apkg"
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sqlite3
import subprocess
import sys
import tempfile
import unicodedata
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCENES_JSON = ROOT / "learning-scenes" / "scenes.json"
IMAGES_DIR = ROOT / "learning-scenes" / "images"
ZSTD_MAGIC = b"\x28\xb5\x2f\xfd"
LEVEL_RE = re.compile(r"\b([AB][12])\b", re.I)
LESSON_RE = re.compile(r"(?:Leçon|Lesson|Unité|درس)\s*(\d+)", re.I)
SOUND_RE = re.compile(r"\s*\[sound:[^\]]+\]")
HTML_TAG_RE = re.compile(r"<[^>]+>")
IMG_RE = re.compile(r"""<img[^>]+src=["']([^"']+)["']""", re.I)
COURSE_LEVELS = ("A1", "A2", "B1", "B2")


def decompress_zstd(raw: bytes) -> bytes:
    try:
        from compression.zstd import decompress
        return decompress(raw)
    except Exception:
        import zstandard
        return zstandard.ZstdDecompressor().decompress(raw)


def read_varint(buf: bytes, index: int) -> tuple[int, int]:
    value = 0
    shift = 0
    while True:
        byte = buf[index]
        index += 1
        value |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return value, index
        shift += 7


def parse_media_entries(raw: bytes) -> list[dict]:
    entries = []
    index = 0
    while index < len(raw):
        key, index = read_varint(raw, index)
        if (key & 7) != 2:
            raise RuntimeError("قالب فایل media این بسته شناخته نشد.")
        length, index = read_varint(raw, index)
        message = raw[index:index + length]
        index += length
        cursor = 0
        name = ""
        digest = ""
        while cursor < len(message):
            field_key, cursor = read_varint(message, cursor)
            field, wire = field_key >> 3, field_key & 7
            if wire == 0:
                _, cursor = read_varint(message, cursor)
                continue
            if wire != 2:
                raise RuntimeError("قالب فایل media این بسته شناخته نشد.")
            size, cursor = read_varint(message, cursor)
            blob = message[cursor:cursor + size]
            cursor += size
            if field == 1:
                name = blob.decode("utf-8")
            elif field == 3:
                digest = blob.hex()
        if name and digest:
            entries.append({"name": name, "sha1": digest})
    return entries


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


def clean_text(value: str) -> str:
    text = html.unescape(value or "")
    text = SOUND_RE.sub("", text)
    text = HTML_TAG_RE.sub("", text)
    text = text.replace("\u2019", "’").replace("`", "’")
    text = re.sub(r"\s+", " ", text).strip().strip('"')
    return text


def detect_level(*parts: str) -> str:
    for part in parts:
        match = LEVEL_RE.search(part or "")
        if match:
            return match.group(1).upper()
    return ""


def lesson_from_deck(deck: str) -> str:
    match = LESSON_RE.search((deck or "").replace("\x1f", " "))
    return match.group(1).zfill(2) if match else ""


def looks_like_sentence(french: str) -> bool:
    if re.search(r"[.!?]", french):
        return True
    words = french.replace(",", " ").split()
    if len(words) >= 5:
        return True
    starters = ("je", "j'", "j’", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "c'est", "c’est", "ce")
    low = french.lower()
    return any(low.startswith(prefix) for prefix in starters) and len(words) >= 3


def connect_anki(db_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def extract_collection(archive: zipfile.ZipFile, dest_dir: Path) -> Path:
    names = set(archive.namelist())
    if "collection.anki21b" in names:
        raw = archive.read("collection.anki21b")
        if raw.startswith(ZSTD_MAGIC):
            raw = decompress_zstd(raw)
        dest = dest_dir / "collection.sqlite"
        dest.write_bytes(raw)
        return dest
    for name in ("collection.anki21", "collection.anki2"):
        if name in names:
            dest = dest_dir / name
            dest.write_bytes(archive.read(name))
            return dest
    raise FileNotFoundError("فایل collection داخل بسته پیدا نشد.")


def load_media_files(archive: zipfile.ZipFile) -> dict[str, bytes]:
    raw_media = archive.read("media")
    if raw_media.startswith(ZSTD_MAGIC):
        raw_media = decompress_zstd(raw_media)
    try:
        mapping = json.loads(raw_media)
    except (UnicodeDecodeError, json.JSONDecodeError):
        mapping = None

    files: dict[str, bytes] = {}
    if isinstance(mapping, dict):
        for key, name in mapping.items():
            if not str(name).lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
                continue
            data = archive.read(str(key))
            if data.startswith(ZSTD_MAGIC):
                data = decompress_zstd(data)
            files[str(name)] = data
        return files

    by_sha = {entry["sha1"]: entry["name"] for entry in parse_media_entries(raw_media)}
    for info in archive.infolist():
        if not info.filename.isdigit():
            continue
        data = archive.read(info.filename)
        if data.startswith(ZSTD_MAGIC):
            data = decompress_zstd(data)
        name = by_sha.get(hashlib.sha1(data).hexdigest())
        if not name or not name.lower().endswith((".png", ".jpg", ".jpeg", ".webp", ".gif")):
            continue
        files[name] = data
    return files


def load_notes(archive: zipfile.ZipFile, fallback_level: str) -> list[dict]:
    with tempfile.TemporaryDirectory() as tmp:
        connection = connect_anki(extract_collection(archive, Path(tmp)))
        decks = {int(row[0]): str(row[1] or "") for row in connection.execute("SELECT id, name FROM decks")}
        notes: dict[int, dict] = {}
        query = """
            SELECT notes.id AS nid, notes.flds AS flds, cards.did AS did
            FROM notes
            JOIN cards ON cards.nid = notes.id
            ORDER BY notes.id
        """
        for row in connection.execute(query):
            note_id = int(row["nid"])
            deck = decks.get(int(row["did"]), "")
            current = notes.get(note_id)
            if current is None or (LESSON_RE.search(deck.replace("\x1f", " ")) and not current["lesson"]):
                parts = (row["flds"] or "").split("\x1f")
                image = ""
                for part in parts:
                    match = IMG_RE.search(part or "")
                    if match:
                        image = match.group(1)
                        break
                french_raw = parts[1] if len(parts) > 1 else ""
                persian_raw = parts[0] if parts else ""
                if re.search(r"[\u0600-\u06FF]", french_raw) and not re.search(r"[\u0600-\u06FF]", persian_raw):
                    french_raw, persian_raw = persian_raw, french_raw
                notes[note_id] = {
                    "id": note_id,
                    "french": clean_text(french_raw),
                    "persian": clean_text(persian_raw),
                    "image": image,
                    "deck": deck,
                    "lesson": lesson_from_deck(deck),
                    "level": detect_level(fallback_level, deck) or fallback_level,
                }
        connection.close()
    return [notes[key] for key in sorted(notes)]


def load_catalog() -> dict:
    data = json.loads(SCENES_JSON.read_text(encoding="utf-8"))
    data.setdefault("scenes", [])
    return data


def save_catalog(catalog: dict) -> None:
    catalog["updatedAt"] = utc_now()
    SCENES_JSON.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def unique_id(existing_ids: set[str], french: str) -> str:
    base = slugify(french)
    if base not in existing_ids:
        return base
    index = 2
    while f"{base}-{index}" in existing_ids:
        index += 1
    return f"{base}-{index}"


def write_jpeg(raw: bytes, dest: Path) -> None:
    suffix = ".png" if raw.startswith(b"\x89PNG") else ".img"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
        handle.write(raw)
        source = Path(handle.name)
    try:
        subprocess.run(
            ["sips", "-Z", "768", "-s", "format", "jpeg", "-s", "formatOptions", "70", str(source), "--out", str(dest)],
            check=True,
            capture_output=True,
        )
    finally:
        source.unlink(missing_ok=True)
    if not dest.is_file() or dest.stat().st_size <= 0:
        raise RuntimeError(f"ساخت تصویر ناموفق بود: {dest.name}")


def import_package(apkg_path: Path, level: str) -> int:
    with zipfile.ZipFile(apkg_path) as archive:
        media = load_media_files(archive)
        notes = load_notes(archive, level)

    catalog = load_catalog()
    existing_ids = {str(item.get("id") or "") for item in catalog["scenes"]}
    existing_keys = {
        (normalize_french(item.get("french") or ""), str(item.get("level") or "").upper())
        for item in catalog["scenes"]
    }
    added = 0
    missing_images = 0
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    notes.sort(key=lambda note: (note["lesson"] or "99", note["id"]))
    for note in notes:
        french = note["french"]
        persian = note["persian"]
        note_level = note["level"] if note["level"] in COURSE_LEVELS else level
        if not french or not persian:
            continue
        key = (normalize_french(french), note_level)
        if key in existing_keys:
            continue
        image_name = Path(note["image"]).name
        raw = media.get(image_name)
        if raw is None:
            missing_images += 1
            print(f"بدون عکس، رد شد: {french}")
            continue

        scene_id = unique_id(existing_ids, french)
        existing_ids.add(scene_id)
        filename = f"{scene_id}.jpg"
        write_jpeg(raw, IMAGES_DIR / filename)
        scene = {
            "id": scene_id,
            "french": french,
            "persian": persian,
            "image": f"learning-scenes/images/{filename}",
            "level": note_level,
            "lesson": note["lesson"],
        }
        if note["lesson"] == "01" and not looks_like_sentence(french):
            scene["kind"] = "word"
        catalog["scenes"].append(scene)
        existing_keys.add(key)
        added += 1
        if added % 25 == 0:
            print(f"  {added} صحنه")

    save_catalog(catalog)
    print(f"اضافه شد: {added}  ·  بدون عکس: {missing_images}  ·  کل صحنه‌ها: {len(catalog['scenes'])}")
    return 0 if added or not notes else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Import illustrated Anki cards into learning scenes")
    parser.add_argument("apkg", type=Path)
    parser.add_argument("--level", default="", help="Course level if the filename has none")
    args = parser.parse_args()
    apkg_path = args.apkg.expanduser().resolve()
    if not apkg_path.is_file():
        raise SystemExit(f"فایل پیدا نشد: {apkg_path}")
    level = detect_level(args.level, apkg_path.stem) 
    if level not in COURSE_LEVELS:
        raise SystemExit("سطح دوره مشخص نیست. اسم فایل باید A1/A2/B1/B2 داشته باشد.")
    return import_package(apkg_path, level)


if __name__ == "__main__":
    raise SystemExit(main())
