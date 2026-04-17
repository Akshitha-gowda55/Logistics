"""LightGBM demand forecast from historical demand + plant + part + week features."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor


def _stable_hash(s: str) -> int:
    return abs(hash(s)) % (2**31 - 1)


def _encode_categorical(plant: str, part: str) -> tuple[int, int]:
    return _stable_hash("plant:" + plant) % 10_000, _stable_hash("part:" + part) % 50_000


def _synthetic_demand_series(plant: str, part: str, n_weeks: int) -> np.ndarray:
    """Deterministic weekly demand (units) for demo / cold-start training."""
    pe, pr = _encode_categorical(plant, part)
    t = np.arange(n_weeks, dtype=np.float64)
    base = 900.0 + (pr % 500) + (pe % 120)
    seasonal = 45.0 * np.sin(2 * np.pi * t / 52.0) + 22.0 * np.sin(2 * np.pi * t / 13.0)
    trend = 0.35 * t
    weekly_noise = 8.0 * np.sin(2 * np.pi * t / 1.0 + pe * 0.01)
    demand = base + seasonal + trend + weekly_noise
    return np.maximum(50.0, demand)


def _make_supervised_frame(demand: np.ndarray, plant: str, part: str) -> pd.DataFrame:
    plant_enc, part_enc = _encode_categorical(plant, part)
    n = len(demand)
    rows: list[dict] = []
    for i in range(n):
        w = i % 52
        rows.append(
            {
                "week_index": i,
                "week_sin": np.sin(2 * np.pi * w / 52.0),
                "week_cos": np.cos(2 * np.pi * w / 52.0),
                "plant_enc": plant_enc,
                "part_enc": part_enc,
                "lag_1": demand[i - 1] if i >= 1 else np.nan,
                "lag_2": demand[i - 2] if i >= 2 else np.nan,
                "lag_4": demand[i - 4] if i >= 4 else np.nan,
                "roll_mean_4": float(np.mean(demand[max(0, i - 4) : i])) if i > 0 else np.nan,
                "demand": float(demand[i]),
            }
        )
    return pd.DataFrame(rows)


def _compute_holdout_confidence(df: pd.DataFrame, feature_cols: list[str]) -> float:
    """MAPE-based confidence in (0,1) from last holdout window."""
    usable = df.dropna(subset=feature_cols + ["demand"])
    if len(usable) < 24:
        return 0.65
    holdout = 8
    train = usable.iloc[:-holdout]
    test = usable.iloc[-holdout:]
    if len(train) < 16:
        return 0.65
    model = LGBMRegressor(
        n_estimators=120,
        learning_rate=0.06,
        max_depth=6,
        num_leaves=48,
        subsample=0.85,
        colsample_bytree=0.85,
        random_state=42,
        verbose=-1,
    )
    model.fit(train[feature_cols], train["demand"])
    pred = model.predict(test[feature_cols])
    mape = float(np.mean(np.abs(test["demand"].values - pred) / np.maximum(test["demand"].values, 1.0)))
    return float(np.clip(1.0 - mape * 1.2, 0.35, 0.97))


FEATURE_COLS = [
    "week_index",
    "week_sin",
    "week_cos",
    "plant_enc",
    "part_enc",
    "lag_1",
    "lag_2",
    "lag_4",
    "roll_mean_4",
]


@dataclass(frozen=True)
class ForecastRow:
    week_label: str
    predicted_demand: float
    confidence: float
    lower: float
    upper: float


@dataclass(frozen=True)
class HistoryRow:
    week_label: str
    demand: float


def week_label_from_index(global_week_index: int) -> str:
    """ISO-style week label for UI (synthetic year anchor)."""
    year = 2023 + (global_week_index // 52)
    week_in_year = (global_week_index % 52) + 1
    return f"{year}-W{week_in_year:02d}"


def train_predict_lightgbm(
    plant: str,
    part: str,
    *,
    history_weeks: int = 80,
    horizon_weeks: int = 8,
    history_tail_for_chart: int = 24,
) -> tuple[list[HistoryRow], list[ForecastRow], str]:
    """
    Train LightGBM on synthetic+demand path, recursive multi-step forecast.

    Inputs encoded in the feature matrix: historical demand lags, plant_enc,
    part_enc, week cyclical features.
    """
    history_weeks = max(40, min(history_weeks, 200))
    horizon_weeks = max(1, min(horizon_weeks, 26))

    demand = _synthetic_demand_series(plant, part, history_weeks)
    df = _make_supervised_frame(demand, plant, part)
    usable = df.dropna(subset=FEATURE_COLS).copy()
    if len(usable) < 20:
        raise ValueError("Insufficient history after lag construction")

    base_conf = _compute_holdout_confidence(df, FEATURE_COLS)

    model = LGBMRegressor(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=7,
        num_leaves=56,
        subsample=0.9,
        colsample_bytree=0.9,
        min_child_samples=8,
        random_state=42,
        verbose=-1,
    )
    model.fit(usable[FEATURE_COLS], usable["demand"])

    # Recursive forecast: extend demand array
    extended = demand.copy().tolist()
    forecasts: list[ForecastRow] = []

    for h in range(horizon_weeks):
        i = len(extended)
        w = i % 52
        lag_1 = extended[i - 1]
        lag_2 = extended[i - 2]
        lag_4 = extended[i - 4]
        roll_mean_4 = float(np.mean(extended[i - 4 : i]))
        plant_enc, part_enc = _encode_categorical(plant, part)
        X = pd.DataFrame(
            [
                {
                    "week_index": i,
                    "week_sin": np.sin(2 * np.pi * w / 52.0),
                    "week_cos": np.cos(2 * np.pi * w / 52.0),
                    "plant_enc": plant_enc,
                    "part_enc": part_enc,
                    "lag_1": lag_1,
                    "lag_2": lag_2,
                    "lag_4": lag_4,
                    "roll_mean_4": roll_mean_4,
                }
            ]
        )
        yhat = float(model.predict(X[FEATURE_COLS])[0])
        yhat = max(0.0, yhat)
        extended.append(yhat)

        step_conf = float(base_conf * (0.985**h))
        margin = (1.0 - step_conf) * 0.35 + 0.04
        lower = max(0.0, yhat * (1.0 - margin))
        upper = yhat * (1.0 + margin)

        forecasts.append(
            ForecastRow(
                week_label=week_label_from_index(i),
                predicted_demand=round(yhat, 2),
                confidence=round(step_conf, 3),
                lower=round(lower, 2),
                upper=round(upper, 2),
            )
        )

    tail_start = max(0, history_weeks - history_tail_for_chart)
    history_out = [
        HistoryRow(week_label=week_label_from_index(i), demand=round(float(demand[i]), 2))
        for i in range(tail_start, history_weeks)
    ]

    return history_out, forecasts, "lightgbm-v1.0"
