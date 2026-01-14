import categorize, json, httpx

entries = categorize.parse_md()
words = [e["word"] for e in entries]
batch = words[30:45]  # batch 3 (index 30..44)
print("batch 3 words:", batch)

API_KEY = open("API.txt").read().strip()
headers = {'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json'}
data = {
    'model': 'tencent-hy3-free',
    'messages': [
        {'role': 'system', 'content': categorize.SYSTEM_PROMPT},
        {'role': 'user', 'content': f"Categorize these {len(batch)} words:\n" + "\n".join(f"- {w}" for w in batch)}
    ],
    'temperature': 0.3,
    'max_tokens': 16000
}
r = httpx.post('https://router.bynara.id/v1/chat/completions', headers=headers, json=data, timeout=300)
j = r.json()
print("finish_reason:", j['choices'][0].get('finish_reason'))
print("content:", repr(j['choices'][0]['message'].get('content'))[:300])
print("reasoning len:", len(j['choices'][0]['message'].get('reasoning') or ''))
