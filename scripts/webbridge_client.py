#!/usr/bin/env python3
import json, sys, urllib.request

SESSION = "padayon-sims"
URL = "http://127.0.0.1:10086/command"

def send(action, args):
    body = {"action": action, "args": args, "session": SESSION}
    req = urllib.request.Request(
        URL,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8"))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: webbridge_client.py <action> [args_json]", file=sys.stderr)
        sys.exit(1)
    action = sys.argv[1]
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    res = send(action, args)
    print(json.dumps(res, indent=2, ensure_ascii=False))
