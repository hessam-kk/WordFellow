import httpx
import json

API_KEY = open("API.txt").read().strip()
headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}
data = {
    'model': 'tencent-hy3-free',
    'messages': [
        {'role': 'system', 'content': 'Return JSON only'},
        {'role': 'user', 'content': 'Say hello in JSON: {"message": "hello"}'}
    ],
    'max_tokens': 2000
}
response = httpx.post('https://router.bynara.id/v1/chat/completions', headers=headers, json=data, timeout=120)
print(response.status_code)
print(response.text)
