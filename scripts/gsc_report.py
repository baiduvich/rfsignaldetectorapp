#!/usr/bin/env python3
"""Search Console report for rfsignaldetectorapp.com.

Run: ~/.venvs/gsc/bin/python scripts/gsc_report.py [days]
Key: ~/.secrets/gsc_service_account.json (Restricted user on the GSC property).
"""
import os
import sys
from datetime import date, timedelta

from google.oauth2 import service_account
from googleapiclient.discovery import build

SITE = "sc-domain:rfsignaldetectorapp.com"
KEY = os.path.expanduser("~/.secrets/gsc_service_account.json")

creds = service_account.Credentials.from_service_account_file(
    KEY, scopes=["https://www.googleapis.com/auth/webmasters.readonly"])
gsc = build("searchconsole", "v1", credentials=creds, cache_discovery=False)


def query(start, end, dims, limit=25000):
    body = {"startDate": str(start), "endDate": str(end), "dimensions": dims, "rowLimit": limit}
    return gsc.searchanalytics().query(siteUrl=SITE, body=body).execute().get("rows", [])


def totals(rows):
    impr = sum(r["impressions"] for r in rows)
    clicks = sum(r["clicks"] for r in rows)
    pos = sum(r["position"] * r["impressions"] for r in rows) / impr if impr else 0
    return clicks, impr, pos


days = int(sys.argv[1]) if len(sys.argv) > 1 else 28
end = date.today() - timedelta(days=2)  # GSC data lags ~2 days
cur_start = end - timedelta(days=days - 1)
prev_end = cur_start - timedelta(days=1)
prev_start = prev_end - timedelta(days=days - 1)

print(f"== Weekly trend since launch ({SITE}) ==")
daily = query(date(2026, 7, 25), end, ["date"])
weeks = {}
for r in daily:
    d = date.fromisoformat(r["keys"][0])
    wk = d - timedelta(days=d.weekday())
    weeks.setdefault(wk, []).append(r)
print(f"{'week of':<12}{'clicks':>8}{'impr':>8}{'avg pos':>9}")
for wk in sorted(weeks):
    c, i, p = totals(weeks[wk])
    print(f"{str(wk):<12}{c:>8}{i:>8}{p:>9.1f}")

cur = {r["keys"][0]: r for r in query(cur_start, end, ["query"])}
prev = {r["keys"][0]: r for r in query(prev_start, prev_end, ["query"])}
c, i, p = totals(list(cur.values()))
pc, pi, pp = totals(list(prev.values()))
print(f"\n== Last {days}d ({cur_start}..{end}) vs previous {days}d ==")
print(f"clicks {pc} -> {c} | impressions {pi} -> {i} | avg pos {pp:.1f} -> {p:.1f} | queries {len(prev)} -> {len(cur)}")

print(f"\n== Top 30 queries, last {days}d (pos change vs previous period) ==")
print(f"{'query':<52}{'clk':>5}{'impr':>6}{'pos':>7}{'prev':>7}")
for q, r in sorted(cur.items(), key=lambda kv: -kv[1]["impressions"])[:30]:
    pv = f"{prev[q]['position']:.1f}" if q in prev else "new"
    print(f"{q[:51]:<52}{r['clicks']:>5}{r['impressions']:>6}{r['position']:>7.1f}{pv:>7}")

print(f"\n== Page 1 (pos <= 10, 5+ impr), last {days}d ==")
for q, r in sorted(cur.items(), key=lambda kv: kv[1]["position"]):
    if r["position"] <= 10 and r["impressions"] >= 5:
        print(f"  {r['position']:>5.1f}  {r['impressions']:>4} impr  {q}")

print(f"\n== Pages, last {days}d ==")
for r in sorted(query(cur_start, end, ["page"]), key=lambda r: -r["impressions"]):
    print(f"{r['clicks']:>5}{r['impressions']:>7}{r['position']:>7.1f}  {r['keys'][0].replace('https://rfsignaldetectorapp.com', '')}")
