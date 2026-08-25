#!/usr/bin/env python3
"""Merge existing APP_DATA with Anki-parsed cards and write data.js."""

import json
from pathlib import Path

EXISTING = Path("/Users/hosseindindar/Desktop/France App/tools/existing.json")
ANKI = Path("/Users/hosseindindar/Desktop/France App/anki_parsed.json")
OUT = Path("/Users/hosseindindar/Desktop/France App/data.js")

FEM_FORMS = {
    "français": "française",
    "anglais": "anglaise",
    "chinois": "chinoise",
    "américain": "américaine",
    "italien": "italienne",
    "brésilien": "brésilienne",
    "coréen": "coréenne",
    "espagnol": "espagnole",
    "allemand": "allemande",
    "suisse": "suisse",
    "belge": "belge",
    "russe": "russe",
}


def norm(text: str) -> str:
    return (text or "").strip().lower().replace("’", "'")


def main():
    existing = json.loads(EXISTING.read_text(encoding="utf-8"))
    anki = json.loads(ANKI.read_text(encoding="utf-8"))

    cats = existing["categories"]
    cats.setdefault("numbers", [])

    seen_words = set()
    for key, items in cats.items():
        for item in items:
            word = item.get("word") or item.get("expression")
            if word:
                seen_words.add(norm(word))

    counters = {k: len(v) for k, v in cats.items()}

    for item in anki["vocab"]:
        word = item.get("word") or item.get("expression")
        key = norm(word)
        if not key or key in seen_words:
            continue
        seen_words.add(key)
        cat = item.get("category") or "expressions"
        if cat not in cats:
            cat = "expressions"
        counters[cat] = counters.get(cat, 0) + 1
        prefix = {
            "verbs": "v",
            "nouns": "n",
            "adjectives": "adj",
            "adverbs": "adv",
            "prepositions": "prep",
            "expressions": "exp",
            "numbers": "num",
        }.get(cat, "x")

        if cat == "expressions":
            cats[cat].append({
                "id": f"exp{counters[cat]}",
                "expression": item.get("expression") or item.get("word"),
                "translation": item["translation"],
            })
            continue

        entry = {
            "id": f"{prefix}{counters[cat]}",
            "word": item.get("word") or item.get("expression"),
            "translation": item["translation"],
        }
        if cat == "nouns":
            entry["gender"] = item.get("gender") or "common"
            if item.get("note"):
                entry["note"] = item["note"]
            elif item.get("fem"):
                entry["note"] = f"مؤنث: {item['fem']}"
        elif cat == "adjectives":
            entry["fem"] = item.get("fem") or FEM_FORMS.get(entry["word"], entry["word"])
        cats[cat].append(entry)

    seen_sents = {norm(s["fr"]) for s in existing["sentences"]}
    sentences = list(existing["sentences"])
    n = len(sentences)
    for s in anki["sentences"]:
        key = norm(s["fr"])
        if key in seen_sents:
            # enrich existing with lesson if missing
            for old in sentences:
                if norm(old["fr"]) == key:
                    old.setdefault("lesson", s.get("lesson"))
                    old.setdefault("topic", s.get("topic"))
                    break
            continue
        seen_sents.add(key)
        n += 1
        sentences.append({
            "id": f"s{n}",
            "fr": s["fr"],
            "fa": s["fa"],
            "topic": s.get("topic") or "other",
            "lesson": s.get("lesson"),
        })

    data = {
        "language": "fr",
        "translation_language": "fa",
        "level": "A1",
        "title": "Apprendre le Français - سطح A1",
        "source": "Communication essentielle A1 + vocabulary pack",
        "categories": cats,
        "grammar_notes": existing["grammar_notes"],
        "sentences": sentences,
    }

    helper = r'''
function getAllVocabItems() {
  const labels = {
    verbs: { fa: 'فعل‌ها', fr: 'Verbes' },
    nouns: { fa: 'اسم‌ها', fr: 'Noms' },
    adjectives: { fa: 'صفت‌ها', fr: 'Adjectifs' },
    adverbs: { fa: 'قیدها', fr: 'Adverbes' },
    prepositions: { fa: 'حروف اضافه', fr: 'Prépositions' },
    numbers: { fa: 'اعداد', fr: 'Nombres' },
    expressions: { fa: 'عبارات و اصطلاحات', fr: 'Expressions' }
  };
  const items = [];
  Object.keys(labels).forEach((categoryKey) => {
    const list = (APP_DATA.categories[categoryKey] || []);
    list.forEach((item) => {
      items.push({
        ...item,
        word: item.word || item.expression,
        categoryKey,
        categoryNameFa: labels[categoryKey].fa,
        categoryNameFr: labels[categoryKey].fr
      });
    });
  });
  const extra = JSON.parse(localStorage.getItem('ff_custom_data') || '{"vocab":[],"sentences":[]}');
  (extra.vocab || []).forEach((item) => {
    const meta = labels[item.categoryKey] || labels.expressions;
    items.push({
      ...item,
      word: item.word || item.expression,
      categoryNameFa: meta.fa,
      categoryNameFr: meta.fr
    });
  });
  return items;
}

function getAllSentences() {
  const extra = JSON.parse(localStorage.getItem('ff_custom_data') || '{"vocab":[],"sentences":[]}');
  return [...APP_DATA.sentences, ...(extra.sentences || [])];
}
'''

    js = "// French A1 Learning Data (Français - فارسی)\n// Source: Communication essentielle A1 (Anki) + existing A1 pack\nconst APP_DATA = "
    js += json.dumps(data, ensure_ascii=False, indent=2)
    js += ";\n"
    js += helper
    OUT.write_text(js, encoding="utf-8")

    print("vocab", {k: len(v) for k, v in cats.items()})
    print("sentences", len(sentences), "total vocab", sum(len(v) for v in cats.values()))


if __name__ == "__main__":
    main()
