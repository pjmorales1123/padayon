#!/usr/bin/env python3
import json, time, sys, urllib.request
import webbridge_client as wb

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

BASE = "http://localhost:3000"
USER_ID = "sim-pack"

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers={"Content-Type": "application/json"} if body else {}, method=method)
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def reset_user():
    api("POST", "/api/seed", {"userId": USER_ID})
    api("PUT", "/api/profile", {
        "userId": USER_ID,
        "name": "PackTester",
        "language_confidence": {"English": "High"},
        "learning_style": {"analogies": True, "short_explanations": True, "visuals": True},
        "strengths": ["Reading", "Memorization"],
        "weaknesses": ["Long explanations"],
        "study_habits": {"preferred_time": "morning", "review_frequency": "daily"},
    })

def find_refs(tree):
    input_ref = None
    send_ref = None
    def walk(node):
        nonlocal input_ref, send_ref
        if isinstance(node, list):
            for c in node: walk(c)
            return
        if not isinstance(node, dict): return
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

def click_button_by_text(text):
    code = f"""
    (() => {{
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.innerText.trim() === {json.dumps(text)});
      if (b) {{ b.click(); return true; }}
      return false;
    }})()
    """
    return wb.send("evaluate", {"code": code})

def main():
    print("=== STUDY PACK & FOLDER TEST ===")
    reset_user()
    wb.send("navigate", {"url": f"{BASE}/chat?userId={USER_ID}", "newTab": True, "group_title": "PADAYON sims"})
    time.sleep(1.5)
    snap = wb.send("snapshot", {})
    input_ref, send_ref = find_refs(snap.get("data", {}).get("tree", []))
    if not input_ref or not send_ref:
        print("Could not find chat controls")
        return

    msg = "Make a complete study pack about photosynthesis with flashcards, a quiz, and a story."
    print(f"\nUser: {msg}")
    elapsed, msgs = send_message(input_ref, send_ref, msg, 0)
    latest = msgs[-1]
    print(f"Reply ({elapsed:.1f}s, hasPack={latest['hasPack']}): {latest['text'][:200].replace(chr(10),' ')}...")

    if not latest["hasPack"]:
        print("FAIL: Study pack was not created")
        return

    # Extract topic id from link
    link_code = """
    (() => {
      const a = document.querySelector('a[href*="/topic/"]');
      return a ? a.getAttribute('href') : null;
    })()
    """
    href = wb.send("evaluate", {"code": link_code}).get("data", {}).get("value")
    if not href:
        print("FAIL: No study pack link found")
        return
    topic_id = href.split("/topic/")[1].split("?")[0]
    print(f"Topic id: {topic_id}")

    # Verify via API
    topic_data = api("GET", f"/api/topic/{topic_id}")
    topic = topic_data.get("topic")
    if not topic:
        print("FAIL: Topic not found via API")
        return
    materials = {m["type"]: m for m in topic.get("materials", [])}
    print(f"Materials: {list(materials.keys())}")

    checks = {
        "clean_notes": materials.get("clean_notes", {}).get("content", {}).get("text", ""),
        "reviewer": materials.get("reviewer", {}).get("content", {}).get("text", ""),
        "flashcards": materials.get("flashcards", {}).get("content", {}).get("flashcards", []),
        "quiz": materials.get("quiz", {}).get("content", {}).get("quiz", []),
        "summary": materials.get("summary", {}).get("content", {}).get("text", ""),
        "story": materials.get("story", {}).get("content", {}).get("text", ""),
    }
    results = {}
    for key, val in checks.items():
        ok = bool(val) and (not isinstance(val, list) or len(val) > 0)
        results[key] = ok
        print(f"  {key}: {'OK' if ok else 'MISSING'} ({len(val) if isinstance(val, list) else len(str(val))} chars/items)")

    # UI checks: navigate topic page, click tabs
    wb.send("navigate", {"url": f"{BASE}/topic/{topic_id}?userId={USER_ID}"})
    time.sleep(1.5)
    for tab in ["Flashcards", "Quiz", "Story"]:
        r = click_button_by_text(tab)
        time.sleep(0.5)
        print(f"  Clicked {tab}: {'OK' if r.get('data',{}).get('value') else 'FAIL'}")

    # Library check
    wb.send("navigate", {"url": f"{BASE}/library?userId={USER_ID}"})
    time.sleep(1.5)
    lib_data = api("GET", f"/api/library?userId={USER_ID}")
    subjects = lib_data.get("subjects", [])
    topic_titles = [t["title"] for s in subjects for t in s.get("topics", [])]
    print(f"  Library subjects: {[s['name'] for s in subjects]}")
    print(f"  Library topics: {topic_titles}")
    pack_in_library = any("photosynthesis" in t.lower() for t in topic_titles)
    print(f"  Pack in library: {'OK' if pack_in_library else 'FAIL'}")

    all_ok = all(results.values()) and pack_in_library
    print(f"\nOVERALL: {'PASS' if all_ok else 'FAIL'}")
    with open("study_pack_report.json", "w", encoding="utf-8") as f:
        json.dump({"materials_ok": results, "topic_id": topic_id, "library_topics": topic_titles, "pass": all_ok}, f, indent=2)

if __name__ == "__main__":
    main()
