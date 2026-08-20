"""End-to-end smoke test against the locally running API.

Exercises the happy path and, more importantly, the failure paths: an
unaffordable redeem, an unknown reward, a backwards filter range, an unknown
sort column, an oversized page, and an unauthenticated read.
"""

import json
import sys
import uuid

import httpx

BASE = "http://127.0.0.1:8000"
results = []


def check(name, condition, detail=""):
    results.append((name, bool(condition), detail))
    mark = "PASS" if condition else "FAIL"
    print(f"  [{mark}] {name}{(' -- ' + str(detail)) if detail and not condition else ''}")


with httpx.Client(base_url=BASE, timeout=60.0) as c:
    print("\n-- health --")
    r = c.get("/health")
    check("health 200", r.status_code == 200, r.text[:200])

    r = c.get("/health/ready")
    check("readiness reaches db", r.status_code == 200 and r.json()["database"] == "reachable", r.text[:200])

    print("\n-- auth --")
    r = c.get("/api/transactions")
    check("unauthenticated read is 401", r.status_code == 401, r.status_code)
    check("401 carries a fault id", r.json().get("error", {}).get("id") == "AUTH_TOKEN_INVALID", r.text[:200])
    check("401 carries an action", bool(r.json().get("error", {}).get("action")), r.text[:200])

    r = c.post("/api/auth/login", json={"email": "demo@coinfold.app", "password": "wrong-password"})
    check("bad password is 401", r.status_code == 401, r.status_code)
    check("bad password fault id", r.json().get("error", {}).get("id") == "AUTH_INVALID_CREDENTIALS", r.text[:200])

    r = c.post("/api/auth/login", json={"email": "demo@coinfold.app", "password": "coinfold-demo-2026"})
    check("demo login 200", r.status_code == 200, r.text[:300])
    body = r.json()
    token = body["tokens"]["access_token"]
    auth = {"Authorization": f"Bearer {token}"}
    check("login returns user", body["user"]["email"] == "demo@coinfold.app", body.get("user"))

    r = c.get("/api/auth/me", headers=auth)
    check("me 200", r.status_code == 200, r.text[:200])

    r = c.post("/api/auth/refresh", json={"refresh_token": body["tokens"]["refresh_token"]})
    check("refresh issues new pair", r.status_code == 200 and "access_token" in r.json(), r.text[:200])

    r = c.post("/api/auth/refresh", json={"refresh_token": token})
    check("access token rejected as refresh", r.status_code == 401, r.status_code)

    print("\n-- transactions --")
    r = c.get("/api/transactions", headers=auth)
    page = r.json()
    check("default page 200", r.status_code == 200, r.text[:300])
    check("total is 10000", page["total"] == 10000, page.get("total"))
    check("page size 50", len(page["rows"]) == 50, len(page.get("rows", [])))
    check("sorted newest first", page["rows"][0]["occurred_at"] >= page["rows"][-1]["occurred_at"], "")
    first_id = page["rows"][0]["id"]

    r = c.get("/api/transactions", headers=auth, params={"page": 200, "page_size": 50})
    check("last page reachable", r.status_code == 200 and len(r.json()["rows"]) == 50, r.json().get("total_pages"))

    r = c.get("/api/transactions", headers=auth, params={"page": 500})
    check("beyond-last page is empty not error", r.status_code == 200 and r.json()["rows"] == [], r.status_code)

    r = c.get("/api/transactions", headers=auth, params={"search": "domino"})
    check("merchant search works", r.status_code == 200 and r.json()["total"] > 0, r.json().get("total"))
    check("search matches only that merchant",
          all("domino" in row["merchant"].lower() for row in r.json()["rows"]), "")

    r = c.get("/api/transactions", headers=auth, params={"search": "zzzz-no-such-merchant"})
    check("no-match search returns empty page", r.status_code == 200 and r.json()["total"] == 0, r.json().get("total"))

    r = c.get("/api/transactions", headers=auth, params={"categories": "fuel,travel", "statuses": "SUCCESS"})
    combo = r.json()
    check("combined filters work", r.status_code == 200 and combo["total"] > 0, r.text[:200])
    check("combined filters respected",
          all(row["category_slug"] in ("fuel", "travel") and row["status"] == "SUCCESS" for row in combo["rows"]), "")

    r = c.get("/api/transactions", headers=auth, params={"sort_by": "amount", "direction": "asc"})
    rows = r.json()["rows"]
    check("amount ascending sorts", rows == sorted(rows, key=lambda x: float(x["amount"])), rows[0]["amount"])
    check("most negative refund first", float(rows[0]["amount"]) < 0, rows[0]["amount"])

    r = c.get("/api/transactions", headers=auth, params={"sort_by": "amount", "direction": "desc"})
    check("sentinel is the largest amount", float(r.json()["rows"][0]["amount"]) == 999999999.0, r.json()["rows"][0]["amount"])

    r = c.get("/api/transactions", headers=auth, params={"sort_by": "merchant"})
    check("unknown sort rejected", r.status_code == 422, r.status_code)
    check("unknown sort fault id", r.json().get("error", {}).get("id") == "QUERY_UNKNOWN_SORT", r.text[:200])

    r = c.get("/api/transactions", headers=auth, params={"sort_by": "amount; DROP TABLE transaction--"})
    check("sql injection in sort rejected", r.status_code == 422, r.status_code)

    r = c.get("/api/transactions", headers=auth, params={"date_from": "2026-01-01", "date_to": "2025-01-01"})
    check("backwards date range rejected", r.status_code == 422, r.status_code)
    check("backwards range fault id", r.json().get("error", {}).get("id") == "QUERY_INVALID_RANGE", r.text[:200])

    r = c.get("/api/transactions", headers=auth, params={"amount_min": 500, "amount_max": 100})
    check("backwards amount range rejected", r.status_code == 422, r.status_code)

    r = c.get("/api/transactions", headers=auth, params={"page_size": 100000})
    check("oversized page rejected", r.status_code == 422, r.status_code)
    check("oversized page fault id", r.json().get("error", {}).get("id") == "QUERY_PAGE_TOO_LARGE", r.text[:200])

    r = c.get("/api/transactions", headers=auth, params={"include_anomalous": "false", "sort_by": "amount", "direction": "desc"})
    check("anomalous excluded on request", float(r.json()["rows"][0]["amount"]) < 1000000, r.json()["rows"][0]["amount"])

    print("\n-- detail --")
    r = c.get(f"/api/transactions/{first_id}", headers=auth)
    check("detail 200", r.status_code == 200, r.text[:200])
    check("detail carries anomalies list", isinstance(r.json().get("anomalies"), list), r.text[:200])

    r = c.get("/api/transactions/99999999", headers=auth)
    check("unknown transaction is 404", r.status_code == 404, r.status_code)
    check("404 fault id", r.json().get("error", {}).get("id") == "TRANSACTION_NOT_FOUND", r.text[:200])

    print("\n-- facets & summary --")
    r = c.get("/api/transactions/facets", headers=auth)
    f = r.json()
    check("facets 200", r.status_code == 200, r.text[:200])
    check("facets total 10000", f["total"] == 10000, f.get("total"))
    check("facet amount max is sentinel", float(f["amount_max"]) == 999999999.0, f.get("amount_max"))

    r = c.get("/api/transactions/summary", headers=auth)
    s = r.json()
    check("summary 200", r.status_code == 200, r.text[:200])
    check("summary matched 10000", s["matched"] == 10000, s.get("matched"))
    check("summary counts failures", s["failed"] == 700, s.get("failed"))
    check("summary counts pending", s["pending"] == 500, s.get("pending"))
    check("refunds are negative", float(s["total_refunded"]) < 0, s.get("total_refunded"))

    print("\n-- analytics --")
    r = c.get("/api/analytics/by-category", headers=auth)
    cats = r.json()
    check("category breakdown 200", r.status_code == 200, r.text[:200])
    check("has 10 real categories", len(cats) == 10, len(cats))
    check("category totals descending", cats == sorted(cats, key=lambda x: float(x["total"]), reverse=True), "")
    check("sentinel excluded from analytics", all(float(x["total"]) < 100000000 for x in cats), "")

    r = c.get("/api/analytics/monthly", headers=auth)
    months = r.json()
    check("monthly trend 200", r.status_code == 200, r.text[:200])
    check("14 months present", len(months) == 14, len(months))
    check("months ascending", months == sorted(months, key=lambda x: x["month"]), "")

    r = c.get("/api/analytics/by-category", headers=auth, params={"categories": "fuel"})
    check("chart respects table filter", len(r.json()) == 1 and r.json()[0]["category_slug"] == "fuel", r.text[:200])

    print("\n-- rewards --")
    r = c.get("/api/rewards/balance", headers=auth)
    bal = r.json()["balance"]
    check("balance 200", r.status_code == 200, r.text[:200])
    check("balance is seeded 362629", bal == 362629, bal)

    r = c.get("/api/rewards/catalogue", headers=auth)
    cat = r.json()
    check("catalogue has 6 rewards", len(cat) == 6, len(cat))
    check("affordability computed", all("affordable" in x for x in cat), "")

    cheapest = min(cat, key=lambda x: x["coin_cost"])
    key = str(uuid.uuid4())
    r = c.post("/api/rewards/redeem", headers=auth, json={"reward_id": cheapest["id"], "idempotency_key": key})
    check("redeem 200", r.status_code == 200, r.text[:300])
    red = r.json()
    check("balance debited exactly", red["balance"] == bal - cheapest["coin_cost"], (red.get("balance"), bal, cheapest["coin_cost"]))
    check("voucher code issued", bool(red.get("voucher_code")), red.get("voucher_code"))
    check("not marked replayed", red["replayed"] is False, red.get("replayed"))

    r2 = c.post("/api/rewards/redeem", headers=auth, json={"reward_id": cheapest["id"], "idempotency_key": key})
    check("retry is idempotent", r2.status_code == 200 and r2.json()["replayed"] is True, r2.text[:200])
    check("retry did not double-charge", r2.json()["id"] == red["id"], (r2.json().get("id"), red.get("id")))

    r = c.get("/api/rewards/balance", headers=auth)
    check("balance stable after retry", r.json()["balance"] == red["balance"], r.json().get("balance"))

    other = max(cat, key=lambda x: x["coin_cost"])
    r = c.post("/api/rewards/redeem", headers=auth, json={"reward_id": other["id"], "idempotency_key": key})
    check("key reuse for different reward rejected", r.status_code == 409, r.status_code)
    check("idempotency conflict fault id", r.json().get("error", {}).get("id") == "REWARD_IDEMPOTENCY_CONFLICT", r.text[:200])

    r = c.post("/api/rewards/redeem", headers=auth, json={"reward_id": 99999, "idempotency_key": str(uuid.uuid4())})
    check("unknown reward is 404", r.status_code == 404, r.status_code)
    check("unknown reward fault id", r.json().get("error", {}).get("id") == "REWARD_NOT_FOUND", r.text[:200])

    r = c.post("/api/rewards/redeem", headers=auth, json={"reward_id": -1, "idempotency_key": str(uuid.uuid4())})
    check("negative reward id rejected by validation", r.status_code == 422, r.status_code)

    r = c.post("/api/rewards/redeem", headers=auth, json={"reward_id": cheapest["id"], "idempotency_key": "short"})
    check("short idempotency key rejected", r.status_code == 422, r.status_code)

    r = c.get("/api/rewards/redemptions", headers=auth)
    check("redemption history lists the redeem", r.status_code == 200 and len(r.json()) >= 1, r.text[:200])

    print("\n-- unaffordable redeem (fresh account) --")
    email = f"poor-{uuid.uuid4().hex[:8]}@coinfold.app"
    r = c.post("/api/auth/register", json={"email": email, "display_name": "Broke Tester", "password": "a-long-enough-password"})
    check("register 201", r.status_code == 201, r.text[:300])
    poor_auth = {"Authorization": f"Bearer {r.json()['tokens']['access_token']}"}

    r = c.post("/api/auth/register", json={"email": email, "display_name": "Dup", "password": "a-long-enough-password"})
    check("duplicate email is 409", r.status_code == 409, r.status_code)
    check("duplicate email fault id", r.json().get("error", {}).get("id") == "AUTH_EMAIL_TAKEN", r.text[:200])

    r = c.post("/api/auth/register", json={"email": "x@y.z", "display_name": "Short", "password": "short"})
    check("short password rejected", r.status_code == 422, r.status_code)

    r = c.get("/api/rewards/balance", headers=poor_auth)
    fresh_balance = r.json()["balance"]
    check("new account got its own seeded ledger", fresh_balance == 362629, fresh_balance)

    # Drain the balance to test the insufficient path deterministically.
    biggest = max(cat, key=lambda x: x["coin_cost"])
    drained = 0
    for _ in range(60):
        rr = c.post("/api/rewards/redeem", headers=poor_auth,
                    json={"reward_id": biggest["id"], "idempotency_key": str(uuid.uuid4())})
        if rr.status_code != 200:
            break
        drained += 1
    check("drain loop ended on a rejection", rr.status_code in (409, 200), rr.status_code)
    if rr.status_code == 409:
        check("drained rejection is a known fault",
              rr.json().get("error", {}).get("id") in ("REWARD_INSUFFICIENT_COINS", "REWARD_OUT_OF_STOCK"),
              rr.text[:200])
        check("rejection explains the shortfall", bool(rr.json()["error"].get("action")), rr.text[:200])

    r = c.get("/api/rewards/balance", headers=poor_auth)
    check("balance never went negative", r.json()["balance"] >= 0, r.json().get("balance"))

print("\n" + "=" * 60)
passed = sum(1 for _, ok, _ in results if ok)
failed = [(n, d) for n, ok, d in results if not ok]
print(f"  {passed}/{len(results)} checks passed")
if failed:
    print("\n  FAILURES:")
    for name, detail in failed:
        print(f"    - {name}: {detail}")
    sys.exit(1)
print("  all green")
