#!/usr/bin/env python3
"""Add lesson tags to Anki vocab in data.js and insert lesson metadata."""

import json
from pathlib import Path

ROOT = Path("/Users/hosseindindar/Desktop/France App")
DATA_JS = ROOT / "data.js"
ANKI = ROOT / "anki_parsed.json"

LESSONS = {
    "01": {"topic": "identity", "titleFa": "هویت، اعداد، ملیت و شغل"},
    "02": {"topic": "family", "titleFa": "خانواده و توصیف افراد"},
    "03": {"topic": "time", "titleFa": "روزها، ماه‌ها، ساعت و میز غذا"},
    "04": {"topic": "housing", "titleFa": "شهر، آدرس و خانه"},
    "05": {"topic": "housing", "titleFa": "تأسیسات خانه و تعمیرات"},
    "06": {"topic": "housing", "titleFa": "ساختمان، همسایه و حیوانات"},
    "07": {"topic": "university", "titleFa": "دانشگاه و درس"},
    "08": {"topic": "routine", "titleFa": "برنامه روزانه"},
    "09": {"topic": "work", "titleFa": "محیط کار و اداره"},
    "10": {"topic": "clothing", "titleFa": "رنگ‌ها، لباس و جنس"},
    "11": {"topic": "food", "titleFa": "میوه، سبزی و رستوران"},
    "12": {"topic": "food", "titleFa": "نانوایی و آشپزی"},
    "13": {"topic": "health", "titleFa": "بدن و بیماری"},
    "14": {"topic": "health", "titleFa": "داروخانه و درمان"},
    "15": {"topic": "transport", "titleFa": "حمل‌ونقل شهری"},
    "16": {"topic": "transport", "titleFa": "قطار و رانندگی"},
    "17": {"topic": "travel", "titleFa": "فرودگاه و مدارک سفر"},
    "18": {"topic": "travel", "titleFa": "هتل و طبیعت"},
    "19": {"topic": "leisure", "titleFa": "ورزش و آب‌وهوا"},
    "20": {"topic": "culture", "titleFa": "فرهنگ، موزه و نمایش"},
}


def norm(text: str) -> str:
    return (text or "").strip().lower().replace("’", "'").replace("`", "'")


def main():
    text = DATA_JS.read_text(encoding="utf-8")
    start = text.index("const APP_DATA = ") + len("const APP_DATA = ")
    data, end = json.JSONDecoder().raw_decode(text, start)
    rest = text[end:]

    anki = json.loads(ANKI.read_text(encoding="utf-8"))
    word_lesson = {}
    for item in anki.get("vocab", []):
        word = item.get("word") or item.get("expression")
        if word and item.get("lesson"):
            word_lesson[norm(word)] = item["lesson"]

    tagged = 0
    for items in data.get("categories", {}).values():
        for item in items:
            word = item.get("word") or item.get("expression")
            lesson = word_lesson.get(norm(word))
            if lesson:
                item["lesson"] = lesson
                tagged += 1

    data["lessons"] = LESSONS

    header = text[: text.index("const APP_DATA = ")]
    DATA_JS.write_text(
        header + "const APP_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + rest,
        encoding="utf-8",
    )
    print("tagged vocab", tagged)
    print("lessons", len(data["lessons"]))


if __name__ == "__main__":
    main()
