"""Step 2: can gpt-6-luna through Portkey search the web?"""
import os, json, time
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI

here = Path(__file__).resolve().parent.parent
load_dotenv(here / ".env"); load_dotenv(here.parent / ".env")
key = os.environ["PORTKEY_API_KEY"]
client = OpenAI(base_url="https://api.portkey.ai/v1", api_key=key, default_headers={"x-portkey-api-key": key})

q = ("Find 3 real practitioners (not academics) who work on climate adaptation in cities and could speak "
     "at a conference. For each give name, role, organization, and the source URL you found them on.")
for tool in [{"type": "web_search"}, {"type": "web_search_preview"}]:
    t = time.time()
    try:
        r = client.responses.create(model="gpt-6-luna", input=q, tools=[tool], max_output_tokens=2000)
        calls = [o.type for o in r.output]
        cites = [a.url for o in r.output if o.type == "message" for c in o.content for a in (getattr(c, "annotations", None) or []) if getattr(a, "url", None)]
        print(f"== {tool['type']}: OK in {time.time()-t:.1f}s, model={r.model}")
        print("output items:", calls)
        print("citations:", cites[:10])
        print("usage:", r.usage.input_tokens, "in /", r.usage.output_tokens, "out")
        print(r.output_text[:1500])
    except Exception as e:
        print(f"== {tool['type']}: FAILED -> {type(e).__name__}: {str(e)[:400]}")
