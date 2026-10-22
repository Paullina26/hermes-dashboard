"""Backend wtyczki `hermes-dashboard` — montowany pod /api/plugins/hermes-dashboard/.

Czyta wyłącznie lokalne bazy stanu botów (state.db) i ich dziennik.
Nic nie zapisuje i nic nie wysyła na zewnątrz. Limity i salda providerów
pochodzą z wtyczki provider-usage, wołanej w tym samym procesie.
"""

from __future__ import annotations

import datetime as dt
import importlib.util
import os
import sqlite3
import time
from collections import defaultdict
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

HERMES_HOME = Path(os.environ.get("HERMES_HOME") or "/opt/data")
PROFILES_DIR = HERMES_HOME / "profiles"
TZ = dt.timezone(dt.timedelta(hours=2))

_CACHE: dict[str, tuple[float, dict]] = {}
_LIMITS_TTL = 120.0
WINDOWS = (("24h", 1), ("7d", 7), ("30d", 30))


def _profile_dirs() -> list[Path]:
    if not PROFILES_DIR.is_dir():
        return []
    return sorted(
        p for p in PROFILES_DIR.iterdir()
        if p.is_dir() and not p.name.startswith(".") and (p / "config.yaml").exists()
    )


def _ro(path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True)


def _journal_days(pdir: Path) -> int:
    jdir = pdir / "journal"
    if not jdir.is_dir():
        return 0
    return len(list(jdir.glob("????-??-??.md")))


def _scan(since: float) -> dict:
    """Zbiera boty, modele i providerów od `since` (epoch)."""
    bots: dict[str, dict] = {}
    models: dict[str, dict] = defaultdict(
        lambda: {"model": "", "provider": "", "cost": 0.0, "calls": 0,
                 "tokens_in": 0, "tokens_out": 0, "bots": set()}
    )

    for pdir in _profile_dirs():
        name = pdir.name
        bot = {
            "name": name, "model": "", "cost": 0.0, "calls": 0, "sessions": 0,
            "tokens_in": 0, "tokens_out": 0, "last_work": None,
            "journal": _journal_days(pdir),
        }
        seen: set[str] = set()
        db = pdir / "state.db"
        if db.exists():
            try:
                con = _ro(db)
                cur = con.execute(
                    "select session_id, model, billing_provider, api_call_count,"
                    " input_tokens, output_tokens, estimated_cost_usd, last_seen"
                    " from session_model_usage where last_seen >= ?",
                    (since,),
                )
                for sid, model, bprov, calls, tin, tout, cost, last in cur:
                    calls = int(calls or 0)
                    tin = int(tin or 0)
                    tout = int(tout or 0)
                    cost = float(cost or 0.0)
                    model = model or ""
                    provider = bprov or (model.split("/")[0] if "/" in model else "") or "—"
                    bot["cost"] += cost
                    bot["calls"] += calls
                    bot["tokens_in"] += tin
                    bot["tokens_out"] += tout
                    seen.add(sid)
                    if model:
                        bot["model"] = model
                        m = models[model]
                        m["model"] = model
                        m["provider"] = provider
                        m["cost"] += cost
                        m["calls"] += calls
                        m["tokens_in"] += tin
                        m["tokens_out"] += tout
                        m["bots"].add(name)
                    if last and (bot["last_work"] is None or float(last) > bot["last_work"]):
                        bot["last_work"] = float(last)
                con.close()
            except sqlite3.Error:
                pass
        bot["sessions"] = len(seen)
        bot["cost"] = round(bot["cost"], 4)
        bot["last_work"] = (
            dt.datetime.fromtimestamp(bot["last_work"], TZ).isoformat(timespec="minutes")
            if bot["last_work"] else None
        )
        bots[name] = bot

    model_rows = [
        {
            "model": m["model"], "provider": m["provider"], "cost": round(m["cost"], 4),
            "calls": m["calls"], "tokens_in": m["tokens_in"], "tokens_out": m["tokens_out"],
            "bots": sorted(m["bots"]),
        }
        for m in models.values()
    ]
    model_rows.sort(key=lambda r: r["cost"], reverse=True)

    prov: dict[str, dict] = defaultdict(
        lambda: {"provider": "", "cost": 0.0, "calls": 0, "models": set()}
    )
    for r in model_rows:
        p = prov[r["provider"] or "—"]
        p["provider"] = r["provider"] or "—"
        p["cost"] += r["cost"]
        p["calls"] += r["calls"]
        p["models"].add(r["model"])
    provider_rows = [
        {"provider": p["provider"], "cost": round(p["cost"], 4),
         "calls": p["calls"], "models": len(p["models"])}
        for p in prov.values()
    ]
    provider_rows.sort(key=lambda r: r["cost"], reverse=True)

    bot_rows = sorted(bots.values(), key=lambda b: b["cost"], reverse=True)
    return {
        "bots": bot_rows,
        "models": model_rows,
        "providers": provider_rows,
        "totals": {
            "bots": len(bot_rows),
            "active": sum(1 for b in bot_rows if b["calls"] > 0),
            "calls": sum(b["calls"] for b in bot_rows),
            "tokens_in": sum(b["tokens_in"] for b in bot_rows),
            "tokens_out": sum(b["tokens_out"] for b in bot_rows),
            "cost": round(sum(b["cost"] for b in bot_rows), 4),
        },
    }


def _limits() -> dict:
    """Limity providerów z wtyczki provider-usage (import w procesie)."""
    now = time.time()
    hit = _CACHE.get("limits")
    if hit and now - hit[0] < _LIMITS_TTL:
        return hit[1]
    result: dict = {"providers": [], "error": None, "fetched_at": None}
    path = HERMES_HOME / "plugins" / "provider-usage" / "dashboard" / "plugin_api.py"
    if path.exists():
        try:
            spec = importlib.util.spec_from_file_location("_pu_api", path)
            mod = importlib.util.module_from_spec(spec)
            assert spec.loader is not None
            spec.loader.exec_module(mod)
            data = mod.payload(False)
            if isinstance(data, dict):
                result["providers"] = data.get("providers", [])
                result["fetched_at"] = data.get("fetched_at")
        except Exception as exc:  # noqa: BLE001 - brak limitów nie może psuć widoku botów
            result["error"] = f"{type(exc).__name__}: {exc}"
    else:
        result["error"] = "provider-usage nie jest zainstalowany"
    _CACHE["limits"] = (now, result)
    return result


def build_summary(days: int = 1) -> dict:
    days = max(1, min(int(days or 1), 90))
    now = time.time()
    return {
        "generated_at": dt.datetime.now(TZ).isoformat(timespec="seconds"),
        "window_days": days,
        "windows": {label: _scan(now - span * 86400) for label, span in WINDOWS},
        "limits": _limits(),
    }


@router.get("/summary")
def summary(days: int = 1) -> dict:
    return build_summary(days)


@router.get("/health")
def health() -> dict:
    return {"ok": True, "profiles": len(_profile_dirs())}
