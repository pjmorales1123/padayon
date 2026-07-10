#!/usr/bin/env python3
import json, time, sys
import urllib.request
import webbridge_client as wb

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

BASE = "http://localhost:3000"

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers={"Content-Type": "application/json"} if body else {}, method=method)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def reset_user(user_id, persona):
    # create base user + curriculum via seed
    api("POST", "/api/seed", {"userId": user_id})
    # overwrite profile
    api("PUT", "/api/profile", {
        "userId": user_id,
        "name": persona.get("name", "Student"),
        "language_confidence": persona.get("language_confidence", {"English": "High"}),
        "learning_style": persona.get("learning_style", {"analogies": True, "short_explanations": True}),
        "strengths": persona.get("strengths", []),
        "weaknesses": persona.get("weaknesses", []),
        "study_habits": persona.get("study_habits", {}),
    })

def find_refs(tree):
    input_ref = None
    send_ref = None
    def walk(node):
        nonlocal input_ref, send_ref
        if isinstance(node, list):
            for c in node:
                walk(c)
            return
        if not isinstance(node, dict):
            return
        role = node.get("role")
        name = node.get("name", "")
        if role == "textbox" and "Type notes" in name:
            input_ref = node.get("ref")
        if role == "button" and name == "Send":
            send_ref = node.get("ref")
        for c in node.get("children", []):
            walk(c)
    walk(tree)
    return input_ref, send_ref

def get_messages():
    code = """
    (() => {
      const bubbles = Array.from(document.querySelectorAll('.whitespace-pre-wrap'));
      return bubbles.map(b => ({
        role: b.classList.contains('bg-blue-600') ? 'user' : 'assistant',
        text: b.innerText.trim(),
        hasPack: b.innerText.includes('Created for you')
      }));
    })()
    """
    return wb.send("evaluate", {"code": code})

def send_message(input_ref, send_ref, text, prev_count, timeout=180):
    wb.send("fill", {"selector": input_ref, "value": text})
    wb.send("click", {"selector": send_ref})
    start = time.time()
    while time.time() - start < timeout:
        time.sleep(0.5)
        res = get_messages()
        msgs = res.get("data", {}).get("value", [])
        loading = wb.send("evaluate", {"code": "document.querySelector('.animate-spin') !== null"}).get("data", {}).get("value", False)
        if len(msgs) > prev_count and not loading and msgs[-1]["role"] == "assistant":
            elapsed = time.time() - start
            return elapsed, msgs
    raise TimeoutError(f"No assistant reply within {timeout}s")

def run_persona(name, user_id, persona, messages):
    print(f"\n=== PERSONA: {name} ({user_id}) ===")
    reset_user(user_id, persona)
    wb.send("navigate", {"url": f"{BASE}/chat?userId={user_id}", "newTab": True})
    time.sleep(1.5)
    snap = wb.send("snapshot", {})
    input_ref, send_ref = find_refs(snap.get("data", {}).get("tree", []))
    if not input_ref or not send_ref:
        print("Could not find chat input or send button")
        return []
    results = []
    count = 0
    for msg in messages:
        print(f"\nUser: {msg}")
        elapsed, msgs = send_message(input_ref, send_ref, msg, count)
        count = len(msgs)
        latest = msgs[-1]
        preview = latest["text"].replace("\n", " ")[:300]
        print(f"Reply ({elapsed:.1f}s, hasPack={latest['hasPack']}): {preview}...")
        results.append({"user": msg, "elapsed": elapsed, "reply": latest["text"], "hasPack": latest["hasPack"]})
    return results

PERSONAS = {
    "Advanced learner": {
        "user_id": "sim-advanced",
        "persona": {
            "name": "Alex",
            "language_confidence": {"English": "High", "Academic English": "High"},
            "learning_style": {"analogies": False, "short_explanations": True, "visuals": False},
            "strengths": ["Algebra", "Calculus", "Problem solving"],
            "weaknesses": ["Memorizing dates"],
            "study_habits": {"preferred_time": "morning", "review_frequency": "daily"},
        },
        "messages": [
            "Teach me about limits in calculus. I already understand derivatives.",
            "Give me a hard quiz on limits with 3 questions.",
            "That's too easy. Make the next one a proof using epsilon-delta.",
        ],
    },
    "Cebuano-only learner": {
        "user_id": "sim-cebuano",
        "persona": {
            "name": "Maria",
            "language_confidence": {"Cebuano": "High", "Filipino": "Medium", "English": "Developing"},
            "learning_style": {"analogies": True, "short_explanations": True, "visuals": True},
            "strengths": ["Listening", "Oral storytelling"],
            "weaknesses": ["English vocabulary", "Academic English"],
            "study_habits": {"preferred_time": "afternoon", "review_frequency": "weekly"},
        },
        "messages": [
            "Unsa ang photosynthesis? Dili ko kasabot English.",
            "Pwede bisaya lang? Ug kanang simple lang.",
        ],
    },
    "Motivation-struggling learner": {
        "user_id": "sim-motivation",
        "persona": {
            "name": "Juan",
            "language_confidence": {"English": "Medium", "Filipino": "High"},
            "learning_style": {"analogies": True, "short_explanations": True, "games": True},
            "strengths": ["Art", "Music"],
            "weaknesses": ["Math anxiety", "Staying motivated", "Long text"],
            "study_habits": {"preferred_time": "evening", "review_frequency": "rarely"},
        },
        "messages": [
            "I feel dumb and I don't want to study math today.",
            "Can you make it feel like a game instead of homework?",
        ],
    },
    "Often-wrong learner": {
        "user_id": "sim-wrong",
        "persona": {
            "name": "Sam",
            "language_confidence": {"English": "Medium"},
            "learning_style": {"analogies": True, "visuals": True, "short_explanations": True},
            "strengths": ["Asking questions"],
            "weaknesses": ["Basic arithmetic", "Following multi-step problems", "Self-correction"],
            "study_habits": {"preferred_time": "evening", "review_frequency": "daily"},
        },
        "messages": [
            "What is 7 times 8? I think it's 54.",
            "Why is it 56? Show me a trick so I don't forget.",
        ],
    },
}

if __name__ == "__main__":
    all_results = {}
    for pname, cfg in PERSONAS.items():
        try:
            all_results[pname] = run_persona(pname, cfg["user_id"], cfg["persona"], cfg["messages"])
        except Exception as e:
            print(f"ERROR in {pname}: {e}")
            all_results[pname] = {"error": str(e)}
    with open("sim_report.json", "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
    print("\nReport written to sim_report.json")
