The **MCDX (Multi Color Dragon Extended)** indicator is a tool used to visualize the flow of smart money in the market. Through it, investors can identify capital flow trends into a stock and make more informed investment decisions.

The indicator is displayed on a chart using three color groups representing three types of market participants:

* **Red** represents large investors / institutional money (**Banker**).
* **Green** represents retail investors (**Retailer**).
* **Yellow** represents speculative capital (**Hot Money**).

This is the **standard formula** (the open-source **Mango2Juice** version on TradingView, which most other variants are based on). The key point is that only two "hands" are calculated using RSI with different periods and then rescaled to a 0–20 range. The **Retailer** component is simply the remainder, drawn to fill the background.

### Default Parameters

| Group              | Sensitivity | RSI Period | Base |
| ------------------ | ----------- | ---------- | ---- |
| Banker (Red)       | 1.5         | 50         | 50   |
| Hot Money (Yellow) | 0.7         | 40         | 30   |

### Formula

Using a display scale of **BASE = 20**:

```text
banker   = 1.5 × (RSI(close, 50) − 50)      → capped to [0, 20]
hotmoney = 0.7 × (RSI(close, 40) − 30)      → capped to [0, 20]
retailer = BASE − hotmoney                  (background fill, plotted at the bottom)
```

Each "hand" is simply an RSI calculated over a specific period and then linearly rescaled:

```text
value = sensitivity × (RSI(period) − base)
```

where **base** shifts the RSI neutral point.

The RSI used here is typically **Wilder's RSI** (EMA smoothing with alpha = 1/period), as in the original TradingView implementation. If an SMA-based RSI is used instead, the values will differ slightly from TradingView, so matching the smoothing method is important when comparing charts.

### Interpreting the Accumulation Phases

The indicator can help identify which stage of the institutional accumulation process a stock is currently in:

* **Banker exceeds 25%**: Large investors are in the **accumulation phase**.
* **Banker exceeds 50%**: Large investors are actively **marking up the price**.
* **Banker exceeds 75%**: Large investors have gained substantial control of the stock, leading to a **parabolic price advance**.
