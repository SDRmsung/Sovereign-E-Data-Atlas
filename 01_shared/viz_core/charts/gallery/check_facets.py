"""Validate A23 chart_registry.js facets (VOCAB, PURPOSE, FORM, NAME_ZH, KIT)."""
import argparse
import json
import subprocess
import sys
import unicodedata
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

DEFAULT_REG_PATH = Path(__file__).with_name("chart_registry.js")

JS_EXTRACT = r"""
const fs = require('fs');
const vm = require('vm');
const code = fs.readFileSync(process.argv[1], 'utf8');
const sandbox = {
  window: { A23_DEMO_S02: { bar: [{ label: '00', values: { a: 1 } }], heat: { rows: ['r'], cols: ['00'], z: [[0]] }, flow: { arcs: [] } }, A23_DEMO_B4: { donut: {}, hist: {}, box: {}, gauge: {} }, A23_DEMO_B5: {}, A23Charts: {}, A23_TW_TOWNS: [] }
};
sandbox.window.window = sandbox.window;
vm.runInNewContext(code, sandbox);
const R = sandbox.window.A23_REGISTRY;
console.log(JSON.stringify({
  VOCAB: R.VOCAB,
  PURPOSE: R.PURPOSE,
  FORM: R.FORM,
  NAME_ZH: R.NAME_ZH,
  KIT: R.KIT,
  KIT_SHAPE: R.KIT_SHAPE,
  KIT_SHAPE_ORDER: R.KIT_SHAPE_ORDER,
  KIT_ORDER: R.KIT_ORDER,
  T_KEYS: Object.keys(R.T || {}).map(Number)
}));
"""


def fullwidth_len(s: str) -> float:
    w = 0.0
    for ch in s:
        eaw = unicodedata.east_asian_width(ch)
        w += 1.0 if eaw in ("F", "W", "A") else 0.5
    return w


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate A23 chart_registry.js facets.")
    parser.add_argument(
        "--registry",
        type=Path,
        default=DEFAULT_REG_PATH,
        help="Path to chart_registry.js (default: sibling chart_registry.js)",
    )
    args = parser.parse_args()

    proc = subprocess.run(
        ["node", "-e", JS_EXTRACT, str(args.registry)],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if proc.returncode != 0:
        print(f"FAIL: node execution failed: {proc.stderr.strip()}")
        return 1

    data = json.loads(proc.stdout)
    vocab = data.get("VOCAB") or {}
    purpose = data.get("PURPOSE") or {}
    form = data.get("FORM") or {}
    name_zh = data.get("NAME_ZH") or {}
    kit = data.get("KIT") or {}
    kit_shape = data.get("KIT_SHAPE") or {}
    kit_shape_order = data.get("KIT_SHAPE_ORDER") or []
    kit_order = data.get("KIT_ORDER") or []
    t_keys = sorted(data.get("T_KEYS") or [])

    errors = []
    v_purpose = set((vocab.get("purpose") or {}).keys())
    v_form = set((vocab.get("form") or {}).keys())
    v_kit = set((vocab.get("kit") or {}).keys())

    if len(v_purpose) != 10:
        errors.append(f"VOCAB.purpose count={len(v_purpose)}, expected 10")
    if len(v_form) != 12:
        errors.append(f"VOCAB.form count={len(v_form)}, expected 12")

    if not t_keys:
        errors.append("T is empty")
        n_total = 0
    else:
        n_total = max(t_keys)
        if t_keys != list(range(1, n_total + 1)):
            errors.append(f"T keys mismatch (must be contiguous 1..{n_total}): {t_keys}")

    t_str_keys = {str(n) for n in t_keys}
    for facet_name, facet_map in (("PURPOSE", purpose), ("FORM", form), ("NAME_ZH", name_zh)):
        f_keys = set(facet_map.keys())
        missing = sorted(t_str_keys - f_keys, key=int)
        extra = sorted(f_keys - t_str_keys, key=lambda x: int(x) if x.isdigit() else 999999)
        if missing:
            errors.append(f"{facet_name} missing keys vs T: {missing}")
        if extra:
            errors.append(f"{facet_name} extra keys not in T: {extra}")

    expected_kit = {30: "CODEX"}
    for i in range(31, 37):
        expected_kit[i] = "YC"
    for i in range(37, 43):
        expected_kit[i] = "INV"
    for i in range(43, 47):
        expected_kit[i] = "STL"
    for i in range(47, 49):
        expected_kit[i] = "QNT"
    for i in range(68, 71):
        expected_kit[i] = "QNT"
    for i in range(49, 53):
        expected_kit[i] = "SWM"
    for i in range(53, 57):
        expected_kit[i] = "LOP"
    for i in range(57, 60):
        expected_kit[i] = "RDR"
    for i in range(60, 64):
        expected_kit[i] = "ORB"
    for i in range(64, 68):
        expected_kit[i] = "STU"
    expected_kit[71] = "MNL"
    for i in range(72, 75):
        expected_kit[i] = "QNT"
    for i in range(75, 82):
        expected_kit[i] = "HUD"

    for n in range(1, n_total + 1):
        k = str(n)
        p_list = purpose.get(k)
        f_list = form.get(k)
        nz = name_zh.get(k)
        if not isinstance(p_list, list) or len(p_list) < 1:
            errors.append(f"#{n} missing PURPOSE")
        else:
            bad_p = [x for x in p_list if x not in v_purpose]
            if bad_p:
                errors.append(f"#{n} invalid PURPOSE: {bad_p}")
        if not isinstance(f_list, list) or len(f_list) < 1:
            errors.append(f"#{n} missing FORM")
        else:
            bad_f = [x for x in f_list if x not in v_form]
            if bad_f:
                errors.append(f"#{n} invalid FORM: {bad_f}")
        if not isinstance(nz, str) or not nz.strip():
            errors.append(f"#{n} missing NAME_ZH")
        else:
            fw = fullwidth_len(nz)
            if fw > 10.0:
                errors.append(f"#{n} NAME_ZH '{nz}' width={fw} > 10.0")

        kv = kit.get(k)
        if n in expected_kit:
            if kv != expected_kit[n]:
                errors.append(f"#{n} KIT={kv}, expected {expected_kit[n]}")
        elif n < 30 and kv is not None:
            errors.append(f"#{n} unexpected KIT={kv}")

    for k, kv in kit.items():
        if kv not in v_kit:
            errors.append(f"#{k} KIT={kv} not in VOCAB.kit")

    kit_values = set(kit.values())
    for vk in sorted(v_kit):
        if vk not in kit_values:
            errors.append(f"kit {vk} 0 張")

    v_kit_shape = set(kit_shape_order)
    if not kit_shape_order:
        errors.append("KIT_SHAPE_ORDER is empty")
    missing_kit_shape = sorted([k for k in kit if k not in kit_shape], key=lambda x: int(x) if str(x).isdigit() else 999999)
    if missing_kit_shape:
        errors.append(f"KIT_SHAPE missing KIT keys: {missing_kit_shape}")
    for k, sv in kit_shape.items():
        if sv not in v_kit_shape:
            errors.append(f"#{k} KIT_SHAPE={sv} not in KIT_SHAPE_ORDER")
    if len(kit_order) != len(kit_shape) or {str(x) for x in kit_order} != set(kit_shape.keys()):
        errors.append("KIT_ORDER inconsistent with KIT_SHAPE")

    if errors:
        print(f"FAIL ({len(errors)} errors):")
        for e in errors:
            print("  -", e)
        return 1

    print(
        f"PASS: {n_total}/{n_total} charts validated | VOCAB purpose={len(v_purpose)} form={len(v_form)} kit={len(v_kit)} | max NAME_ZH width={max(fullwidth_len(name_zh[str(n)]) for n in range(1, n_total + 1)):.1f}"
    )
    return 0


def run_with_quality_gate() -> int:
    """check_facets 流程＝facets 驗證＋§6.7 質感閘門（kit_quality_gate.py；A23_SKIP_QUALITY=1 可略過）。"""
    import os
    rc = main()
    if os.environ.get("A23_SKIP_QUALITY") == "1":
        print("KIT_QUALITY SKIPPED (A23_SKIP_QUALITY=1)")
        return rc
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import kit_quality_gate
    return rc or kit_quality_gate.run(quiet=True)


if __name__ == "__main__":
    raise SystemExit(run_with_quality_gate())
