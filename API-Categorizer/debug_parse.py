import re

raw = []
last = [None]

def add(number, word, definition, is_line):
    raw.append({"number": number, "word": word, "definition": definition, "is_line": is_line})
    last[0] = raw[-1]

with open("1212.md", "r", encoding="utf-8") as f:
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
                nm = re.match(r"^\s*(\d+)\.\s*$", rows[i].strip())
                if nm:
                    c = rows[i + 1].strip()
                    w, d = (c.split(":", 1) if ":" in c else (c, ""))
                    add(int(nm.group(1)), w, d, False)
                i += 2
            continue
        if line.strip().startswith(":"):
            if last[0] is not None:
                cont = line.strip().lstrip(":").strip()
                last[0]["definition"] += ((" " if last[0]["definition"] else "") + cont)

from collections import Counter
nums = [e["number"] for e in raw]
print("raw entries:", len(raw), "unique nums:", len(set(nums)))
c = Counter(nums)
print("dup nums:", {n: k for n, k in c.items() if k > 1})
print("missing 1..1212:", [n for n in range(1, 1213) if n not in set(nums)])
