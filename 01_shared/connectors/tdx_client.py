#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared MOTC TDX OAuth2 Token Cache & Gzip JSON Fetcher."""

import gzip
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

TDX_TOKEN_URL = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token"
CACHE_PATH = Path(__file__).resolve().parent / ".tdx_token_cache.json"


def load_env(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def get_tdx_token(env_dir: Path | None = None) -> str | None:
    if env_dir:
        load_env(env_dir / ".env")
    load_env(Path(__file__).resolve().parents[2] / ".env")
    cid = os.environ.get("TDX_CLIENT_ID", "").strip()
    csec = os.environ.get("TDX_CLIENT_SECRET", "").strip()
    if not cid or not csec:
        return None

    now_ts = time.time()
    if CACHE_PATH.exists():
        try:
            cached = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
            if cached.get("expires_at", 0) - 60 > now_ts and cached.get("access_token"):
                return cached["access_token"]
        except Exception:
            pass

    body = urllib.parse.urlencode(
        {"grant_type": "client_credentials", "client_id": cid, "client_secret": csec}
    ).encode("utf-8")
    req = urllib.request.Request(
        TDX_TOKEN_URL,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "A23-Shared/3.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            tok = data.get("access_token")
            exp = int(data.get("expires_in", 86400))
            if tok:
                CACHE_PATH.write_text(
                    json.dumps({"access_token": tok, "expires_at": now_ts + exp}, ensure_ascii=False),
                    encoding="utf-8",
                )
                return tok
    except Exception:
        return None
    return None


def fetch_tdx_json(url: str, token: str, timeout: int = 10):
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}", "Accept-Encoding": "gzip", "User-Agent": "A23-Shared/3.0"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read()
        if raw[:2] == b"\x1f\x8b":
            raw = gzip.decompress(raw)
        return json.loads(raw.decode("utf-8"))
