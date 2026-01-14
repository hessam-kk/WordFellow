def load_words(f):
    with open(f, "r", encoding="utf-8") as f:
        content = f.read().strip()
    words = [w.strip() for w in content.split("  ") if w.strip()]
    return words

print(len(load_words('1212.md')))
