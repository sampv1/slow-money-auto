"""Dominance rule: a mapping is accepted when it holds on the overwhelming
majority of symbols. Zero-tolerance was too strict — one provider glitch in one
quarter (AGG 2025-Q3, cost_of_sales sign-flipped) vetoed a mapping that is
exact on the other 18 symbols."""
import json, collections, re, pathlib
S="/tmp/claude-1000/-home-sampham-data-ai-slow-money-auto/602da8ed-34e6-4f39-8d37-1fb56c677353/scratchpad"
data=json.load(open(f"{S}/raw.json")); TOL=1e-4; MIN_SHARED=4; MIN_SUP=1; MAX_BAD=0.15
def inf(s):
    v={round(x,6) for x in s.values()}; return len([x for x in v if x!=0.0])>=2
sup=collections.Counter(); con=collections.Counter(); neg=collections.Counter(); seen=collections.Counter()
for sym,d in data.items():
    for stmt in ("income","balance","cashflow","ratio"):
        P=d["paid"].get(stmt,{}); F=d["free"].get(stmt,{})
        if not P or not F: continue
        for pid,ps in P.items():
            if not inf(ps): continue
            seen[pid]+=1
            for fid,fs in F.items():
                sh=sorted(set(ps)&set(fs))
                if len(sh)<MIN_SHARED: continue
                if not inf({p:fs[p] for p in sh}): continue
                pos=sum(1 for p in sh if abs(ps[p]-fs[p])<=TOL*max(abs(ps[p]),abs(fs[p]),1.0))
                ngt=sum(1 for p in sh if abs(ps[p]+fs[p])<=TOL*max(abs(ps[p]),abs(fs[p]),1.0))
                if max(pos,ngt)/len(sh) >= 0.85:
                    sup[(pid,fid)]+=1
                    if ngt>pos: neg[(pid,fid)]+=1
                else: con[(pid,fid)]+=1
cand=collections.defaultdict(list)
for (pid,fid),n in sup.items():
    bad=con[(pid,fid)]
    if n>=MIN_SUP and bad/(n+bad)<=MAX_BAD:
        cand[pid].append((fid,n,bad,neg[(pid,fid)]>n/2))
clean={}; amb={}
PREFER=("owners_equity","paid_in_capital","inventories","cash_and_cash_equivalents")
for pid,cs in cand.items():
    cs.sort(key=lambda x:(-x[1],x[2]))
    best=[c for c in cs if c[1]==cs[0][1] and c[2]==cs[0][2]]
    if len(best)>1:
        # a genuine tie means the two free lines are numerically identical on
        # every sampled symbol; prefer the one whose NAME is the direct reading.
        named=[b for b in best if b[0] in PREFER]
        if len(named)==1: best=named
    if len(best)==1: clean[pid]={"free":best[0][0],"negate":best[0][3],
                                 "support":best[0][1],"exceptions":best[0][2]}
    else: amb[pid]=[b[0] for b in best]
chart=set(re.findall(r'"((?:IS|BS|CF|RT)_[A-Z_]+)"',
  pathlib.Path("/home/sampham/data/ai/slow-money-auto/dashboard/src/lib/financial-metrics.ts").read_text()))
rubric=set(re.findall(r'"((?:IS|BS)_[A-Z_]+)"',
  pathlib.Path("/home/sampham/data/ai/slow-money-auto/scripts/fa/vnstock_store.py").read_text()))
re_ids={"BS_INVENTORIES","BS_LONG_TERM_PRODUCTION_IN_PROGRESS","BS_ADVANCES_FROM_CUSTOMERS",
 "BS_LONG_TERM_ADVANCES_FROM_CUSTOMERS","BS_CASH","BS_CASH_EQUIVALENTS","BS_SHORT_TERM_BORROWINGS",
 "BS_LONG_TERM_BORROWINGS","BS_OWNERS_EQUITY","BS_SHORT_TERM_ASSETS","BS_SHORT_TERM_LIABILITIES",
 "BS_TRADE_RECEIVABLES","BS_LONG_TERM_TRADE_RECEIVABLES","IS_COST_OF_GOODS_SOLD"}
need=sorted(chart|rubric|re_ids)
ok=[i for i in need if i in clean]; ambi=[i for i in need if i in amb]
miss=[i for i in need if i not in clean and i not in amb]
print(f"ALL paid ids: seen={len(seen)}  proven={len(clean)}  ambiguous={len(amb)}")
print(f"NEEDED {len(need)}: proven={len(ok)}  ambiguous={len(ambi)}  nomatch={len(miss)}")
print(f"  with exceptions: {[i for i in ok if clean[i]['exceptions']]}")
print(f"  negated        : {[i for i in ok if clean[i]['negate']]}")
for i in ambi: print(f"  AMBIG   {i:<42} {amb[i][:5]}")
for i in miss: print(f"  NOMATCH {i:<42} seen in {seen[i]} symbols")
json.dump({"clean":clean,"ambiguous":amb}, open(f"{S}/map3.json","w"), indent=1)
print("\nwrote map3.json")
