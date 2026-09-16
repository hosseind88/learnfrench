#!/usr/bin/env python3
"""Build anki_parsed.json from Anki packages in anki_data/.

Drop one .apkg per course in anki_data/:
  anki_data/Communication essentielle A1(+audio).apkg
  anki_data/Communication essentielle A2(+audio).apkg

The level is taken from the filename, a parent folder (A1/A2/B1/B2),
or the deck name inside the package.

Usage:
  python3 tools/parse_anki.py
  python3 tools/parse_anki.py --check
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sqlite3
import tempfile
import zipfile
from collections import Counter, OrderedDict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ANKI_DIR = ROOT / "anki_data"
OUT = ROOT / "anki_parsed.json"
SCENES_JSON = ROOT / "learning-scenes" / "scenes.json"

COURSE_LEVELS = ("A1", "A2", "B1", "B2")
ZSTD_MAGIC = b"\x28\xb5\x2f\xfd"
LEVEL_RE = re.compile(r"\b([AB][12])\b", re.I)
LESSON_RE = re.compile(r"(?:Leçon|Lesson|Unité|درس)\s*(\d+)", re.I)
SOUND_RE = re.compile(r"\s*\[sound:[^\]]+\]")
HTML_TAG_RE = re.compile(r"<[^>]+>")
PERSIAN_RE = re.compile(r"[\u0600-\u06FF]")

LESSON_TOPICS = {
    "A1": {
        "01": ("identity", "هویت، اعداد، ملیت و شغل"),
        "02": ("family", "خانواده و توصیف افراد"),
        "03": ("time", "روزها، ماه‌ها، ساعت و میز غذا"),
        "04": ("housing", "شهر، آدرس و خانه"),
        "05": ("housing", "تأسیسات خانه و تعمیرات"),
        "06": ("housing", "ساختمان، همسایه و حیوانات"),
        "07": ("university", "دانشگاه و درس"),
        "08": ("routine", "برنامه روزانه"),
        "09": ("work", "محیط کار و اداره"),
        "10": ("clothing", "رنگ‌ها، لباس و جنس"),
        "11": ("food", "میوه، سبزی و رستوران"),
        "12": ("food", "نانوایی و آشپزی"),
        "13": ("health", "بدن و بیماری"),
        "14": ("health", "داروخانه و درمان"),
        "15": ("transport", "حمل‌ونقل شهری"),
        "16": ("transport", "قطار و رانندگی"),
        "17": ("travel", "فرودگاه و مدارک سفر"),
        "18": ("travel", "هتل و طبیعت"),
        "19": ("leisure", "ورزش و آب‌وهوا"),
        "20": ("culture", "فرهنگ، موزه و نمایش"),
    }
}

NATIONALITIES = {
    "français", "anglais", "chinois", "américain", "italien", "brésilien",
    "coréen", "espagnol", "allemand", "suisse", "belge", "russe",
}
JOBS = {
    "journaliste", "étudiant", "professeur", "ingénieur", "infirmier",
    "cuisinier", "technicien", "pharmacien", "vendeur", "serveur",
}
NUMBERS = {
    "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit",
    "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
    "dix-sept", "dix-huit", "dix-neuf", "vingt", "trente", "quarante",
    "cinquante", "soixante", "soixante-dix", "quatre-vingts", "quatre-vingt-dix",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def clean_text(value: str) -> str:
    if value is None:
        return ""
    text = html.unescape(value)
    text = SOUND_RE.sub("", text)
    text = HTML_TAG_RE.sub("", text)
    text = text.replace("&#x27;", "'").replace("&apos;", "'")
    text = text.replace("\u2019", "'").replace("`", "'")
    text = re.sub(r"\s+", " ", text).strip().strip('"')
    return text


def normalize_key(text: str) -> str:
    text = clean_text(text).replace("’", "'").replace("\u00a0", " ")
    text = re.sub(r"\s+", " ", text).strip().rstrip(".!?;:…").strip()
    return text.casefold()


def detect_level(*parts: str) -> str:
    for part in parts:
        match = LEVEL_RE.search(part or "")
        if match:
            return match.group(1).upper()
    return ""


def lesson_from_deck(deck: str) -> str:
    match = LESSON_RE.search((deck or "").replace("\x1f", " "))
    return match.group(1).zfill(2) if match else "00"


def topic_for(level: str, lesson: str) -> tuple[str, str]:
    return LESSON_TOPICS.get(level, {}).get(lesson, ("other", "سایر"))


def looks_like_sentence(fr: str) -> bool:
    if re.search(r"[.!?]", fr):
        return True
    words = fr.replace(",", " ").split()
    if len(words) >= 5:
        return True
    starters = ("je", "j'", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "c'est", "ce")
    low = fr.lower()
    if any(low.startswith(s) for s in starters) and len(words) >= 3:
        return True
    return False


def split_card_texts(flds: str) -> tuple[str, str]:
    parts = (flds or "").split("\x1f")
    first = clean_text(parts[0] if parts else "")
    second = clean_text(parts[1] if len(parts) > 1 else "")
    if PERSIAN_RE.search(first) and not PERSIAN_RE.search(second):
        return second, first
    if PERSIAN_RE.search(second) and not PERSIAN_RE.search(first):
        return first, second
    return second, first


def strip_article(word: str) -> tuple[str, str | None]:
    raw = word.strip()
    low = raw.lower()
    articles = [
        ("une ", "feminine"),
        ("un ", "masculine"),
        ("la ", "feminine"),
        ("le ", "masculine"),
        ("l'", "common"),
        ("l’", "common"),
        ("les ", "plural"),
        ("des ", "plural"),
    ]
    for prefix, gender in articles:
        if low.startswith(prefix):
            return raw[len(prefix):].strip(), gender
    return raw, None


def classify_vocab(fr: str, fa: str) -> dict:
    original = fr.strip()
    if " / " in original:
        masc, fem = [p.strip() for p in original.split(" / ", 1)]
        lemma = masc.lower()
        if lemma in JOBS:
            return {
                "word": masc,
                "translation": fa,
                "category": "nouns",
                "gender": "masculine",
                "note": f"مؤنث: {fem}",
                "fem": fem,
            }
        if lemma in NATIONALITIES or lemma.endswith("ais") or lemma.endswith("ois"):
            return {
                "word": masc,
                "translation": fa,
                "category": "adjectives",
                "fem": fem,
            }
        return {
            "word": masc,
            "translation": fa,
            "category": "nouns",
            "gender": "masculine",
            "note": f"مؤنث: {fem}",
            "fem": fem,
        }

    lemma, gender = strip_article(original)
    extra = ""
    if "," in lemma:
        parts = [p.strip() for p in lemma.split(",") if p.strip()]
        lemma = parts[0]
        extra = ", ".join(parts[1:])
    low = lemma.lower()

    if low in NUMBERS or original.lower() in NUMBERS:
        return {"word": lemma or original, "translation": fa, "category": "numbers"}

    if gender:
        item = {"word": lemma, "translation": fa, "category": "nouns", "gender": gender}
        if extra:
            extra_word, _ = strip_article(extra)
            item["note"] = f"همچنین: {extra_word}"
        return item

    return {
        "word": original,
        "translation": fa,
        "category": "expressions",
        "expression": original,
    }


def decompress_zstd(raw: bytes) -> bytes:
    try:
        from compression.zstd import decompress
        return decompress(raw)
    except Exception:
        pass
    try:
        import zstandard
        return zstandard.ZstdDecompressor().decompress(raw)
    except Exception as exc:
        raise RuntimeError(
            "برای خواندن Anki جدید به zstd نیاز است. Python 3.14 یا بسته zstandard را نصب کن."
        ) from exc


def connect_anki(db_path: Path) -> sqlite3.Connection:
    con = sqlite3.connect(db_path)
    con.create_collation(
        "unicase",
        lambda a, b: 0 if (a or "").casefold() == (b or "").casefold()
        else (-1 if (a or "").casefold() < (b or "").casefold() else 1),
    )
    con.row_factory = sqlite3.Row
    return con


def table_names(con: sqlite3.Connection) -> set[str]:
    return {row[0] for row in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}


def load_deck_names(con: sqlite3.Connection) -> dict[int, str]:
    names = table_names(con)
    if "decks" in names:
        try:
            return {int(row[0]): str(row[1] or "") for row in con.execute("SELECT id, name FROM decks")}
        except sqlite3.OperationalError:
            pass
    raw = con.execute("SELECT decks FROM col").fetchone()
    decks = json.loads(raw[0]) if raw else {}
    return {int(key): str((value or {}).get("name") or "") for key, value in decks.items()}


def is_stub_collection(con: sqlite3.Connection) -> bool:
    count = con.execute("SELECT count(*) FROM notes").fetchone()[0]
    if count != 1:
        return False
    flds = con.execute("SELECT flds FROM notes").fetchone()[0] or ""
    return "Please update to the latest Anki version" in flds


def extract_collection(apkg_path: Path, dest_dir: Path) -> Path:
    with zipfile.ZipFile(apkg_path) as archive:
        names = set(archive.namelist())
        if "collection.anki21b" in names:
            raw = archive.read("collection.anki21b")
            if raw.startswith(ZSTD_MAGIC):
                raw = decompress_zstd(raw)
            dest = dest_dir / "collection.sqlite"
            dest.write_bytes(raw)
            return dest
        if "collection.anki21" in names:
            dest = dest_dir / "collection.anki21"
            dest.write_bytes(archive.read("collection.anki21"))
            return dest
        if "collection.anki2" in names:
            dest = dest_dir / "collection.anki2"
            dest.write_bytes(archive.read("collection.anki2"))
            return dest
    raise FileNotFoundError(f"داخل {apkg_path.name} فایل collection پیدا نشد.")


def iter_apkg_notes(apkg_path: Path, fallback_level: str):
    with tempfile.TemporaryDirectory() as tmp:
        db_path = extract_collection(apkg_path, Path(tmp))
        con = connect_anki(db_path)
        if is_stub_collection(con):
            con.close()
            raise RuntimeError(f"{apkg_path.name} نسخه قدیمی Anki است و داده واقعی ندارد.")
        decks = load_deck_names(con)
        notes: dict[int, dict] = {}
        query = """
            SELECT notes.id, notes.flds, notes.tags, cards.did
            FROM notes
            JOIN cards ON cards.nid = notes.id
        """
        for row in con.execute(query):
            note_id = int(row["id"])
            deck = decks.get(int(row["did"]), "")
            current = notes.get(note_id)
            if current is None or (LESSON_RE.search(deck.replace("\x1f", " ")) and not LESSON_RE.search(current["deck"].replace("\x1f", " "))):
                notes[note_id] = {"flds": row["flds"], "tags": row["tags"] or "", "deck": deck}
        con.close()

    for note in notes.values():
        french, persian = split_card_texts(note["flds"])
        if not french or not persian:
            continue
        level = detect_level(fallback_level, note["deck"], note["tags"]) or fallback_level
        yield {
            "fr": french,
            "fa": persian,
            "deck": note["deck"],
            "tags": note["tags"],
            "level": level,
            "lesson": lesson_from_deck(note["deck"]),
        }


def iter_txt_notes(txt_path: Path, fallback_level: str):
    content = txt_path.read_text(encoding="utf-8")
    lines = [line for line in content.splitlines() if line.strip() and not line.startswith("#")]
    reader = csv.reader(lines, delimiter="\t", quotechar='"')
    for row in reader:
        if len(row) < 5:
            continue
        deck = row[2]
        fa = clean_text(row[3])
        fr = clean_text(row[4])
        if not fr or not fa:
            continue
        yield {
            "fr": fr,
            "fa": fa,
            "deck": deck,
            "tags": "",
            "level": detect_level(fallback_level, deck) or fallback_level,
            "lesson": lesson_from_deck(deck),
        }


def discover_sources() -> list[tuple[Path, str]]:
    if not ANKI_DIR.is_dir():
        raise SystemExit(f"پوشه {ANKI_DIR} پیدا نشد.")

    found: list[tuple[Path, str]] = []
    for path in sorted(ANKI_DIR.rglob("*")):
        if not path.is_file() or path.name.startswith("."):
            continue
        if path.suffix.lower() not in {".apkg", ".colpkg", ".txt"}:
            continue
        if path.suffix.lower() == ".txt" and path.name.lower() in {"readme.txt"}:
            continue
        level = detect_level(path.stem, path.parent.name)
        found.append((path, level))
    if not found:
        raise SystemExit(
            f"در {ANKI_DIR.relative_to(ROOT)} فایل Anki نیست. "
            "مثلاً Communication essentielle A2(+audio).apkg را آنجا بگذار."
        )
    return found


def load_existing_ids() -> tuple[dict[str, str], dict[str, str], int, int]:
    if not OUT.is_file():
        return {}, {}, 0, 0
    try:
        data = json.loads(OUT.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}, {}, 0, 0

    sent_ids = {}
    voc_ids = {}
    max_sent = 0
    max_voc = 0
    for item in data.get("sentences") or []:
        key = normalize_key(item.get("fr") or "")
        ident = str(item.get("id") or "")
        if key and ident:
            sent_ids[key] = ident
        match = re.search(r"(\d+)$", ident)
        if match:
            max_sent = max(max_sent, int(match.group(1)))
    for item in data.get("vocab") or []:
        key = normalize_key(item.get("word") or item.get("expression") or "")
        ident = str(item.get("id") or "")
        if key and ident:
            voc_ids[key] = ident
        match = re.search(r"(\d+)$", ident)
        if match:
            max_voc = max(max_voc, int(match.group(1)))
    return sent_ids, voc_ids, max_sent, max_voc


def next_id(existing: dict[str, str], key: str, prefix: str, counter: list[int]) -> str:
    if key in existing:
        return existing[key]
    counter[0] += 1
    ident = f"{prefix}{counter[0]}"
    existing[key] = ident
    return ident


def parse_sources(sources: list[tuple[Path, str]]) -> dict:
    sent_ids, voc_ids, max_sent, max_voc = load_existing_ids()
    sent_counter = [max_sent]
    voc_counter = [max_voc]
    sentences = []
    vocab_by_key: OrderedDict[str, dict] = OrderedDict()
    seen_sentences = set()
    source_reports = []

    for path, file_level in sources:
        if path.suffix.lower() in {".apkg", ".colpkg"}:
            notes = list(iter_apkg_notes(path, file_level))
        else:
            notes = list(iter_txt_notes(path, file_level))

        if notes and not file_level:
            file_level = next((note["level"] for note in notes if note["level"] in COURSE_LEVELS), "")
        if not file_level:
            raise SystemExit(
                f"سطح {path.name} مشخص نشد. اسم فایل را مثل A2.apkg بگذار یا داخل anki_data/A2/ بگذار."
            )

        lesson_counts: Counter[str] = Counter()
        source_sentences = 0
        source_vocab = 0
        for note in notes:
            level = note["level"] if note["level"] in COURSE_LEVELS else file_level
            lesson = note["lesson"]
            topic, _title = topic_for(level, lesson)
            lesson_counts[lesson] += 1

            if looks_like_sentence(note["fr"]) or lesson != "01":
                if not (lesson == "01" and not looks_like_sentence(note["fr"])):
                    key = normalize_key(note["fr"])
                    if key in seen_sentences:
                        continue
                    seen_sentences.add(key)
                    source_sentences += 1
                    sentences.append({
                        "id": next_id(sent_ids, key, "s", sent_counter),
                        "fr": note["fr"],
                        "fa": note["fa"],
                        "topic": topic,
                        "lesson": lesson,
                        "level": level,
                    })
                    continue

            item = classify_vocab(note["fr"], note["fa"])
            key = normalize_key(item.get("word") or item.get("expression") or "")
            if not key or key in vocab_by_key:
                continue
            source_vocab += 1
            item["id"] = next_id(voc_ids, key, "a", voc_counter)
            item["lesson"] = lesson
            item["level"] = level
            vocab_by_key[key] = item

        source_reports.append({
            "file": str(path.relative_to(ANKI_DIR)),
            "level": file_level,
            "notes": len(notes),
            "sentences": source_sentences,
            "vocab": source_vocab,
            "lessons": {key: lesson_counts[key] for key in sorted(lesson_counts)},
        })

    by_level: dict[str, dict] = {}
    for item in sentences:
        bucket = by_level.setdefault(item["level"], {"sentences": 0, "vocab": 0})
        bucket["sentences"] += 1
    for item in vocab_by_key.values():
        bucket = by_level.setdefault(item["level"], {"sentences": 0, "vocab": 0})
        bucket["vocab"] += 1

    return {
        "updatedAt": utc_now(),
        "sources": source_reports,
        "sentences": sentences,
        "vocab": list(vocab_by_key.values()),
        "counts": {
            "sentences": len(sentences),
            "vocab": len(vocab_by_key),
            "byLevel": by_level,
        },
    }


def load_scene_french() -> list[dict]:
    if not SCENES_JSON.is_file():
        return []
    data = json.loads(SCENES_JSON.read_text(encoding="utf-8"))
    return data.get("scenes") if isinstance(data, dict) else data


def print_report(data: dict) -> None:
    print(f"نوشته شد: {OUT.relative_to(ROOT)}")
    print(f"جملات: {data['counts']['sentences']}  ·  واژگان: {data['counts']['vocab']}")
    for source in data["sources"]:
        lessons = ", ".join(source["lessons"]) or "-"
        print(
            f"  {source['level']}  {source['file']}  "
            f"notes={source['notes']}  sentences={source['sentences']}  "
            f"vocab={source['vocab']}  lessons={lessons}"
        )

    scenes = load_scene_french()
    if not scenes:
        return
    anki_keys = {normalize_key(item["fr"]): item for item in data["sentences"]}
    scene_keys = {normalize_key(item.get("french") or "") for item in scenes}
    missing_scenes = [
        item for item in data["sentences"]
        if normalize_key(item["fr"]) not in scene_keys
    ]
    unmatched_scenes = [
        item for item in scenes
        if normalize_key(item.get("french") or "") not in anki_keys
    ]
    print(f"صحنه‌ها: {len(scenes)}  ·  جمله بدون صحنه: {len(missing_scenes)}  ·  صحنه بدون Anki: {len(unmatched_scenes)}")
    missing_by_level = Counter((item.get("level"), item.get("lesson")) for item in missing_scenes)
    if missing_by_level:
        print("جملات بدون صحنه به تفکیک دوره/درس:")
        for (level, lesson), count in sorted(missing_by_level.items()):
            print(f"  {level} درس {lesson}: {count}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Parse Anki packages from anki_data/ into anki_parsed.json")
    parser.add_argument("--check", action="store_true", help="Only print the completeness report after writing")
    args = parser.parse_args()

    ANKI_DIR.mkdir(parents=True, exist_ok=True)
    data = parse_sources(discover_sources())
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print_report(data)
    if args.check and not data["sources"]:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
