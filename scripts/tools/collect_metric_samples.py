"""Collect free + paid series once, to disk. Analysis is then free to iterate."""
import sys, time, json
sys.path.insert(0, "/home/sampham/data/ai/slow-money-auto/scripts")
from ta.common import get_supabase_client, safe_execute
from vnstock import Finance
OUT = "/tmp/claude-1000/-home-sampham-data-ai-slow-money-auto/602da8ed-34e6-4f39-8d37-1fb56c677353/scratchpad/raw.json"
STMTS = {"income":"income_statement","balance":"balance_sheet","cashflow":"cash_flow","ratio":"ratio"}
SYMBOLS = ["FPT","VNM","HPG","AGG","KDH","NLG","TCB","VCB","SSI","VCI","BVH","GAS","REE","PNJ",
           "DGC","DXG","VIC","MWG","HSG","POW"]
def free_series(sym):
    out={}; f=Finance(symbol=sym, source="VCI")
    for stmt, meth in STMTS.items():
        try: df=getattr(f,meth)(period="quarter", lang="en", dropna=False)
        except Exception as e: print(f"   {sym}/{stmt}: {str(e)[:50]}"); continue
        if df is None or df.empty or "item_id" not in df.columns: continue
        pcols=[c for c in df.columns if isinstance(c,str) and "-Q" in c]
        d={}
        for _,r in df.iterrows():
            iid=str(r["item_id"]); s={}
            for p in pcols:
                try:
                    fv=float(r[p])
                    if fv==fv: s[p]=fv
                except (TypeError,ValueError): pass
            if s: d.setdefault(iid,{}).update(s)
        out[stmt]=d; time.sleep(1.5)
    return out
def paid_series(c,sym):
    out={}
    rows=safe_execute(c.table("fa_vnstock_statements").select("statement,period,items")
         .eq("symbol",sym).eq("period_type","quarter"),label="p").data or []
    for r in rows:
        d=out.setdefault(r["statement"],{})
        for k,v in (r["items"] or {}).items():
            if v is None: continue
            try: d.setdefault(k,{})[r["period"]]=float(v)
            except (TypeError,ValueError): pass
    return out
c=get_supabase_client(); data={}
for i,s in enumerate(SYMBOLS,1):
    print(f"[{i}/{len(SYMBOLS)}] {s}", flush=True)
    data[s]={"paid":paid_series(c,s),"free":free_series(s)}
json.dump(data, open(OUT,"w"))
print("saved", OUT)
