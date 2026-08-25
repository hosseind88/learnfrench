#!/usr/bin/env python3
"""Parse Anki Communication essentielle A1 export into structured JSON for data.js."""

import csv
import html
import json
import re
from collections import OrderedDict
from pathlib import Path

SRC = Path("/Users/hosseindindar/.cursor/projects/Users-hosseindindar-Desktop-France-App/attachments/1d60c553-e5dd-433f-a535-6285b9bf817c/Communication_essentielle_A1.txt")
OUT = Path("/Users/hosseindindar/Desktop/France App/anki_parsed.json")

LESSON_TOPICS = {
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

SOUND_RE = re.compile(r"\s*\[sound:[^\]]+\]")
HTML_TAG_RE = re.compile(r"<[^>]+>")
LESSON_RE = re.compile(r"Leçon\s+(\d+)")


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


def lesson_from_deck(deck: str) -> str:
    m = LESSON_RE.search(deck or "")
    return m.group(1).zfill(2) if m else "00"


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
    if "," in lemma:
        parts = [p.strip() for p in lemma.split(",") if p.strip()]
        lemma = parts[0]
        extra = ", ".join(parts[1:])
    else:
        extra = ""
    low = lemma.lower()

    if low in NUMBERS or original.lower() in NUMBERS:
        return {
            "word": lemma or original,
            "translation": fa,
            "category": "numbers",
        }

    if gender:
        item = {
            "word": lemma,
            "translation": fa,
            "category": "nouns",
            "gender": gender,
        }
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


def parse_file():
    sentences = []
    vocab_by_key = OrderedDict()

    with SRC.open(encoding="utf-8") as f:
        # skip anki header lines starting with #
        content = f.read()

    lines = []
    for line in content.splitlines():
        if line.startswith("#") or not line.strip():
            continue
        lines.append(line)

    reader = csv.reader(lines, delimiter="\t", quotechar='"')
    sent_i = 0
    voc_i = 0

    for row in reader:
        if len(row) < 5:
            continue
        deck = row[2]
        fa = clean_text(row[3])
        fr = clean_text(row[4])
        if not fr or not fa:
            continue

        lesson = lesson_from_deck(deck)
        topic, topic_fa = LESSON_TOPICS.get(lesson, ("other", "سایر"))

        if looks_like_sentence(fr) or lesson != "01":
            # Leçon 01 word cards stay vocab; later lessons are mostly sentences
            # except very short identity-like entries already handled
            if lesson == "01" and not looks_like_sentence(fr):
                pass
            else:
                sent_i += 1
                sentences.append({
                    "id": f"s{sent_i}",
                    "fr": fr,
                    "fa": fa,
                    "topic": topic,
                    "lesson": lesson,
                })
                continue

        voc_i += 1
        item = classify_vocab(fr, fa)
        key = (item.get("word") or item.get("expression") or "").lower()
        if key and key not in vocab_by_key:
            item["id"] = f"a{voc_i}"
            item["lesson"] = lesson
            vocab_by_key[key] = item

    data = {
        "sentences": sentences,
        "vocab": list(vocab_by_key.values()),
        "counts": {
            "sentences": len(sentences),
            "vocab": len(vocab_by_key),
        },
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(data["counts"], ensure_ascii=False))
    print("lessons", sorted({s["lesson"] for s in sentences}))


if __name__ == "__main__":
    parse_file()
