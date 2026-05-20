#!/usr/bin/env python3

from vnstock.api.quote import Quote
import pandas as pd
from datetime import datetime, timedelta
import time

# ============================================================
# Find latest trading day
# ============================================================

today = datetime.today()

# Monday=0 ... Sunday=6
weekday = today.weekday()

if weekday == 5:      # Saturday
    latest_day = today - timedelta(days=1)

elif weekday == 6:    # Sunday
    latest_day = today - timedelta(days=2)

else:
    latest_day = today

date_str = latest_day.strftime('%Y-%m-%d')

print(f"Download latest EOD data: {date_str}")

# ============================================================
# Ticker list
# ============================================================

# Add more later if needed
symbols = [
    'VCB', 'BID', 'CTG', 'TCB', 'MBB',
    'ACB', 'VPB', 'SSI', 'VND', 'HCM',
    'FPT', 'MWG', 'HPG', 'VIC', 'VHM',
    'GAS', 'PLX', 'MSN', 'VNM', 'REE'
]

print(f"Total symbols: {len(symbols)}")

# ============================================================
# Download
# ============================================================

all_data = []

for idx, symbol in enumerate(symbols):

    try:
        print(f"[{idx+1}/{len(symbols)}] {symbol}")

        q = Quote(symbol=symbol, source='VCI')

        df = q.history(
            start=date_str,
            end=date_str,
            interval='1D'
        )

        if df is None or df.empty:
            print(f"Empty: {symbol}")
            continue

        df['symbol'] = symbol

        all_data.append(df)

        time.sleep(0.2)

    except Exception as e:
        print(f"ERROR {symbol}: {e}")

# ============================================================
# Save CSV
# ============================================================

if not all_data:
    print("No data downloaded")
    exit(1)

final_df = pd.concat(all_data, ignore_index=True)

filename = f"vn_eod_{date_str}.csv"

final_df.to_csv(filename, index=False)

print(f"Saved: {filename}")
print(f"Rows: {len(final_df)}")