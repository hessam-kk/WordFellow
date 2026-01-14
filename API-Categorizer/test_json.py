import categorize, json

sample = 'Sure! Here is the result:\n```json\n{"categories": {"Research, Evidence & Scientific Inquiry": ["absorb"], "Time, Sequence & Duration": ["abrupt"]}}\n```\nHope this helps!'
c = sample.strip()
if c.startswith("```json"):
    c = c[7:-3].strip()
elif c.startswith("```"):
    c = c[3:-3].strip()
start = c.find("{")
raw = json.JSONDecoder().raw_decode(c[start:])[0]["categories"]
print("parsed OK:", raw)

sample2 = '{"categories": {"Arts, Culture & History": ["abstract"]}} some trailing words'
c2 = sample2.strip()
start2 = c2.find("{")
raw2 = json.JSONDecoder().raw_decode(c2[start2:])[0]["categories"]
print("parsed OK2:", raw2)
print("module func check:", hasattr(categorize, "categorize_batch"))
