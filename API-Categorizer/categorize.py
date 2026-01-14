import os
import re
import json
import time
from openai import OpenAI

API_KEY = open("API.txt").read().strip()
WORDS_FILE = "1212.md"
BATCH_SIZE = 15
MODEL = "laguna-s-2.1"
BASE_URL = "https://router.bynara.id/v1"

client = OpenAI(api_key=API_KEY, base_url=BASE_URL)

def parse_md():
    """Parse 1212.md into list of {word, definition}.
    Format: 'N. word: definition'  (definition may contain colons).
    Some entries are packed inside HTML <table> rows like:
        <tr><td>352.</td><td>displace: move out of position</td></tr>
    Lines starting with ':' are continuations appended to previous definition.

    De-duplication: when a number appears both in an HTML table and as a
    standalone 'N. word: def' line (collisions on 378/786/942), the standalone
    line wins and the table version is discarded.
    """
    raw = []  # list of (number, word, definition, is_line)
    last_continuation = [None]

    def add(number, word, definition, is_line):
        word = word.strip()
        definition = definition.strip()
        if not word:
            return
        raw.append({"number": number, "word": word,
                    "definition": definition, "is_line": is_line})
        last_continuation[0] = raw[-1]

    with open(WORDS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue

            m = re.match(r"^\s*(\d+)\.\s+(.+?)(?::\s*(.*))?$", line)
            if m:
                definition = m.group(3) if m.group(3) is not None else ""
                add(int(m.group(1)), m.group(2), definition, True)
                continue

            if "<td" in line:
                rows = re.findall(r"<td[^>]*>([^<]*)</td>", line)
                i = 0
                while i + 1 < len(rows):
                    num_cell = rows[i].strip()
                    content_cell = rows[i + 1].strip()
                    nm = re.match(r"^\s*(\d+)\.\s*$", num_cell)
                    if nm:
                        if ":" in content_cell:
                            word, definition = content_cell.split(":", 1)
                        else:
                            word, definition = content_cell, ""
                        add(int(nm.group(1)), word, definition, False)
                    i += 2
                continue

            if line.strip().startswith(":"):
                if last_continuation[0] is not None:
                    cont = line.strip().lstrip(":").strip()
                    if last_continuation[0]["definition"]:
                        last_continuation[0]["definition"] += " " + cont
                    else:
                        last_continuation[0]["definition"] = cont

    # Dedupe by number: prefer the standalone line version.
    best = {}
    for e in raw:
        n = e["number"]
        if n not in best or (e["is_line"] and not best[n]["is_line"]):
            best[n] = e
    entries = [{"word": e["word"], "definition": e["definition"]}
               for e in sorted(best.values(), key=lambda x: x["number"])]
    return entries

# The 15 fixed categories. Words must be assigned to exactly one of these.
CATEGORIES = [
    ("Research, Evidence & Scientific Inquiry", "Words related to proofs, hypotheses, data, and analytical methods."),
    ("Quantity, Scale, Size & Intensity", "Terms describing amounts, magnitudes, and comparative degrees."),
    ("Dynamics of Change, Development & Transition", "Vocabulary focused on growth, adaptation, and alteration."),
    ("Time, Sequence & Duration", "Words relating to temporal order, historical eras, and frequency."),
    ("Environment, Geography & Nature", "Terms describing the natural world, biological life, and landscapes."),
    ("Psychology, Mind & Personality", "Vocabulary concerning mental states, emotions, and character traits."),
    ("Communication & Social Interaction", "Words regarding expression, signaling, and interpersonal relationships."),
    ("Politics, Law & Governance", "Terms related to authority, legal structures, and official regulations."),
    ("Business, Economics & Finance", "Vocabulary focused on wealth, resources, trade, and productivity."),
    ("Science, Technology & Mechanics", "Words describing technical processes, tools, and systems."),
    ("Arts, Culture & History", "Terms relating to heritage, aesthetics, and cultural traditions."),
    ("Logical Relations, Comparison & Contrast", "Words that define how concepts relate, oppose, or align with one another."),
    ("Physical Properties, Space & Structure", "Vocabulary describing layouts, shapes, and the physical state of matter."),
    ("Functional Actions, Operations & Management", "Practical verbs and terms related to executing tasks and managing processes."),
    ("Status, Quality & General Conditions", "Adjectives describing the overall state or characteristic of a thing (e.g., rare, vague, excellent)."),
]

def category_filename(name, idx):
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return f"{idx + 1:02d}_{slug}.txt"

def normalize_cat(name):
    return re.sub(r"[^a-z0-9]", "", name.lower())

CAT_NAME_BY_NORM = {normalize_cat(n): n for n, _ in CATEGORIES}

SYSTEM_PROMPT = """You are a categorization expert. Your task is to assign English words/phrases into EXACTLY ONE of the 15 fixed categories provided below.

STRICT RULES:
1. You MUST use ONLY the 15 categories listed. DO NOT create, rename, merge, or invent any new category.
2. Assign EVERY input word to exactly ONE of the 15 categories (pick the single best fit).
3. A word must NOT appear in more than one category.
4. Return ONLY valid JSON in this exact format:
{
  "categories": {
    "Research, Evidence & Scientific Inquiry": ["word1", "word2"],
    "Quantity, Scale, Size & Intensity": ["word3"]
  }
}
5. Use the EXACT category names as given (copy them precisely).
6. Only include a category in the output if it has at least one word."""

def categorize_batch(words):
    cat_block = "\n".join(f"{i+1}. {name} — {desc}" for i, (name, desc) in enumerate(CATEGORIES))

    user_prompt = (
        f"Assign each of these {len(words)} words to exactly ONE of the 15 fixed categories.\n\n"
        f"WORDS:\n" + "\n".join(f"- {w}" for w in words) +
        f"\n\nFIXED CATEGORIES (use these exact names only):\n{cat_block}"
    )

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.3,
        max_tokens=16000
    )

    content = response.choices[0].message.content
    if not content:
        raise ValueError("Empty content from model")
    content = content.strip()
    if content.startswith("```json"):
        content = content[7:-3].strip()
    elif content.startswith("```"):
        content = content[3:-3].strip()

    # Robustly extract the first JSON object, ignoring any prose before/after it.
    start = content.find("{")
    if start == -1:
        raise ValueError("No JSON object found in model response")
    try:
        raw = json.JSONDecoder().raw_decode(content[start:])[0]
    except json.JSONDecodeError as e:
        raise ValueError(f"Could not parse JSON: {e}")
    raw = raw["categories"]

    # Normalize returned category names to our fixed 15; collect unmatched words.
    result = {name: [] for name, _ in CATEGORIES}
    unplaced = []
    for cat, ws in raw.items():
        fixed = CAT_NAME_BY_NORM.get(normalize_cat(cat))
        if fixed is None:
            unplaced.extend(ws)
        else:
            result[fixed].extend(ws)
    return result, unplaced

def merge_categories(all_categories, batch_result):
    merged = dict(all_categories)
    for cat, ws in batch_result.items():
        merged.setdefault(cat, [])
        merged[cat].extend(ws)
    return merged

def dedupe_categories(category_to_words):
    """Ensure each word appears in exactly ONE category (first claim wins)."""
    seen = set()
    deduped = {}
    for cat, words in category_to_words.items():
        kept = []
        for w in words:
            if w in seen:
                continue
            seen.add(w)
            kept.append(w)
        if kept:
            deduped[cat] = kept
    return deduped

def save_categories(category_to_words, word_to_def):
    os.makedirs("output_categories", exist_ok=True)
    for idx, (name, _) in enumerate(CATEGORIES):
        words = category_to_words.get(name, [])
        filepath = os.path.join("output_categories", category_filename(name, idx))
        with open(filepath, "w", encoding="utf-8") as f:
            for w in words:
                definition = word_to_def.get(w, "")
                f.write(f"{w}: {definition}\n")
    placed = sum(len(v) for v in category_to_words.values())
    print(f"Saved {len(CATEGORIES)} category files ({placed} words placed) to output_categories/")

def main():
    entries = parse_md()
    print(f"Loaded {len(entries)} entries")
    print(f"Fixed categories: {len(CATEGORIES)} (self-evolving disabled)")

    word_to_def = {e["word"]: e["definition"] for e in entries}
    words = [e["word"] for e in entries]

    all_categories = {name: [] for name, _ in CATEGORIES}
    total_batches = (len(words) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(words), BATCH_SIZE):
        batch = words[i:i+BATCH_SIZE]
        batch_num = i // BATCH_SIZE + 1
        print(f"\nProcessing batch {batch_num}/{total_batches} ({len(batch)} words)...")

        placed = set()
        to_place = list(batch)
        # Retry up to 6 times; the reasoning model is non-deterministic and a
        # retry often yields a completed (non-null) answer.
        for attempt in range(6):
            try:
                batch_result, unplaced = categorize_batch(to_place)
            except Exception as e:
                print(f"  API error (attempt {attempt+1}): {e}")
                time.sleep(5 * (attempt + 1))
                continue

            all_categories = merge_categories(all_categories, batch_result)
            placed = set()
            for ws in all_categories.values():
                placed.update(ws)
            missing = [w for w in batch if w not in placed]
            if not missing:
                break
            print(f"  {len(missing)} word(s) not placed, retrying...")
            to_place = missing

        # Fallback: any still-missing word goes to the last category.
        missing = [w for w in batch if w not in placed]
        if missing:
            print(f"  WARNING: {len(missing)} word(s) fell back to '{CATEGORIES[-1][0]}': {missing}")
            all_categories[CATEGORIES[-1][0]].extend(missing)

        # Save after every batch so progress is never lost.
        save_categories(dedupe_categories(all_categories), word_to_def)
        time.sleep(0.5)

    save_categories(dedupe_categories(all_categories), word_to_def)
    print("\nDone! Categorized all words into the output_categories/ directory.")

if __name__ == "__main__":
    main()
