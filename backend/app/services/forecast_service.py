from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import List, Literal


TrendDirection = Literal["upward", "downward", "flat"]


@dataclass
class DemandForecastPoint:
  day: date
  value: float


@dataclass
class DemandForecastResult:
  horizon_days: int
  predicted_demand: List[float]
  confidence: float
  trend: TrendDirection
  recommended_action: str
  baseline_window: List[float]
  spike_detected: bool
  change_pct: float


def _moving_average(series: list[float], window: int) -> list[float]:
  if window <= 1 or window >= len(series):
    return series[:]
  out: list[float] = []
  for i in range(len(series) - window + 1):
    window_vals = series[i : i + window]
    out.append(sum(window_vals) / window)
  return out


def build_demo_forecast(horizon_days: int = 14) -> DemandForecastResult:
  """Generate demo-friendly demand forecast with mild trend and spike detection.

  This is intentionally simple: we seed a base series, apply a small linear trend and
  weekly seasonality, then compute a moving average for the forecast window.
  """
  # Seed "historical" demand for last 21 days (units per day).
  base = [980, 1020, 995, 1015, 1040, 1075, 1100, 1110, 1125, 1150, 1175, 1190, 1180, 1205, 1220, 1235, 1260, 1285, 1290, 1310, 1330]

  # Lightweight trend: gently increasing.
  trended = [round(v * (1 + (i * 0.004)), 1) for i, v in enumerate(base)]

  # Weekly seasonality bump.
  series: list[float] = []
  for idx, v in enumerate(trended):
    weekday = idx % 7
    if weekday in (5, 6):  # weekend bump
      series.append(round(v * 1.06, 1))
    else:
      series.append(round(v, 1))

  # Last 7 days are our baseline window.
  baseline_window = series[-7:]
  baseline_avg = sum(baseline_window) / len(baseline_window)

  # Forecast = moving average over last 10 days extended by light trend.
  ma_source = series[-10:]
  ma = _moving_average(ma_source, window=5)
  last = ma[-1]
  forecast: list[float] = []
  for i in range(horizon_days):
    step_trend = 1 + (0.005 * i)
    forecast.append(round(last * step_trend, 1))

  # Trend direction from first/last point.
  if forecast[-1] > forecast[0] * 1.04:
    trend: TrendDirection = "upward"
  elif forecast[-1] < forecast[0] * 0.96:
    trend = "downward"
  else:
    trend = "flat"

  # Change percentage vs baseline.
  horizon_avg = sum(forecast) / len(forecast)
  change_pct = ((horizon_avg - baseline_avg) / baseline_avg) * 100 if baseline_avg else 0

  # Simple spike detection: any forecast point > 1.18x baseline avg.
  spike_detected = any(p > baseline_avg * 1.18 for p in forecast)

  # Recommended action based on direction + spike.
  if trend == "upward":
    if spike_detected:
      recommended = "Demand spike detected. Increase safety stock by 10–15% in high-growth regions and expedite inbound POs."
    elif change_pct > 5:
      recommended = "Upward trend. Plan a 6–8% safety stock uplift for the next two cycles."
    else:
      recommended = "Slight growth. Keep current safety stock; monitor for the next cycle."
  elif trend == "downward":
    if change_pct < -8:
      recommended = "Downward trend. Reduce reorder quantities by 10% and consider stock transfer from slow regions."
    else:
      recommended = "Mild decline. Hold new POs for one cycle and watch sell-through."
  else:
    recommended = "Flat demand. Maintain current policy; no immediate changes required."

  confidence = 0.84 if not spike_detected else 0.78

  return DemandForecastResult(
    horizon_days=horizon_days,
    predicted_demand=forecast,
    confidence=round(confidence, 2),
    trend=trend,
    recommended_action=recommended,
    baseline_window=baseline_window,
    spike_detected=spike_detected,
    change_pct=round(change_pct, 1),
  )

