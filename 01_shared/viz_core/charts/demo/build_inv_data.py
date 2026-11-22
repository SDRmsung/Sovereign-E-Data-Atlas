#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
產出 A23 庫存戰情組件模擬資料 (S1)
固定種子 seed=20261116，輸出 demo/data_inv.js，掛載至 window.A23_DEMO_INV。
規模：120 SKU、4 倉（A–D）、12 個月（2026-01 ~ 2026-12）。
"""

import json
import os
import random
import sys

sys.stdout.reconfigure(encoding="utf-8")

SEED = 20261116
random.seed(SEED)

CATEGORIES = [
    "MCU控制晶片",
    "電源管理模組",
    "高頻連接器",
    "精密被動元件",
    "散熱機構件",
    "光電感測模組",
]

PART_NAMES = {
    "MCU控制晶片": ["車規32位元MCU", "邊緣AI推論晶片", "高速DSP控制器的", "工業級微控制器", "雙核通訊SoC"],
    "電源管理模組": ["DC-DC降壓模組", "GaN快充功率IC", "車載穩壓PMIC", "隔離式電源轉換器", "高壓MOSFET陣列"],
    "高頻連接器": ["PCIe5高速排線座", "防水車用線束頭", "光纖SFP+籠架", "板對板微距插座", "Type-C工業母座"],
    "精密被動元件": ["車規MLCC電容", "低阻合金分流電阻", "高頻繞線電感", "石英振盪晶體", "高壓鎖固螺絲組"],
    "散熱機構件": ["均溫板VC模組", "陽極鋁擠散熱鰭片", "高導熱矽膠墊片", "微型液冷岐管", "耐溫密封O型環"],
    "光電感測模組": ["ToF測距感測器", "紅外線熱像模組", "高動態CMOS鏡頭", "光耦合隔離器", "磁編碼位置感測器"],
}

WAREHOUSES = ["A", "B", "C", "D"]
MONTHS = [f"2026-{m:02d}" for m in range(1, 13)]


def build_ccc_series():
    """
    12 個月現金循環序列：DIO、DSO、DPO，且 CCC = DIO + DSO - DPO 逐月嚴格成立。
    """
    base_dio = [54, 56, 53, 51, 55, 58, 61, 59, 56, 52, 49, 47]
    base_dso = [42, 43, 41, 40, 42, 44, 45, 43, 41, 39, 38, 37]
    base_dpo = [34, 33, 35, 36, 34, 32, 31, 33, 35, 36, 37, 38]
    series = []
    for i, m in enumerate(MONTHS):
        dio = base_dio[i]
        dso = base_dso[i]
        dpo = base_dpo[i]
        ccc = dio + dso - dpo
        assert ccc == dio + dso - dpo, f"CCC equation mismatch at {m}"
        series.append({
            "month": m,
            "label": m,
            "DIO": dio,
            "DSO": dso,
            "DPO": dpo,
            "CCC": ccc,
            "dio": dio,
            "dso": dso,
            "dpo": dpo,
            "ccc": ccc,
            "target_ccc": 55,
            "note": "模擬資料",
        })
    return series


def build_skus():
    skus = []
    # 儲位配置：每倉 6 列 (row 1..6) x 5 格 (col 1..5) = 30 格，4 倉共 120 格，120 SKU 一對一配置主儲位
    slots_pool = []
    for wh in WAREHOUSES:
        for r in range(1, 7):
            for c in range(1, 6):
                slots_pool.append((wh, r, c))

    # 預先指定劇情 SKU (前 14 顆設定明確警報與跨倉調撥劇情)
    # 要求：
    # - 至少 8 顆料「可用量 < ROP」（此處設計 12 顆可用量 < ROP）
    # - 其中至少 3 顆在別倉有餘量（應顯示調撥優先，此處設計 6 顆有別倉餘量）
    # - 至少 1 顆 C 類料低於 SS（此處設計 3 顆 C 類料低於 SS）
    # - 另設計數顆 F 類高頻料放在遠區 (row >= 5) 供 #41 儲位熱力圖標示「錯放」
    scripted_specs = [
        # (idx, abc, xyz, fmr, cat_idx, wh, row, col, ss, rop, max_s, on_hand, alloc, on_order, other_wh_qty, daily_use, lead_days, price)
        # available = on_hand + on_order - alloc
        (0, "C", "X", "F", 3, "A", 6, 5, 120, 200, 500, 70, 20, 35, 95, 18.0, 14, 12.5),    # C類 < SS (85), 別倉有餘量(調撥優先), F類遠區錯放
        (1, "A", "X", "F", 0, "A", 5, 4, 150, 260, 600, 95, 30, 45, 0, 22.0, 21, 480.0),    # A類 < SS (110), 採購, F類遠區錯放
        (2, "C", "Y", "M", 4, "B", 3, 2, 100, 180, 450, 65, 15, 30, 130, 14.0, 12, 8.0),    # C類 < SS (80), 別倉有餘量(調撥優先)
        (3, "A", "Y", "F", 1, "B", 6, 4, 140, 240, 550, 90, 25, 50, 110, 19.5, 18, 320.0),  # A類 < SS (115), 別倉有餘量(調撥優先), F類遠區錯放
        (4, "B", "X", "F", 2, "C", 5, 5, 110, 190, 480, 120, 20, 45, 0, 16.0, 15, 95.0),    # B類 < ROP (>SS, 145), 採購, F類遠區錯放
        (5, "A", "X", "F", 0, "A", 1, 2, 160, 280, 650, 175, 35, 80, 85, 24.0, 20, 560.0),  # A類 < ROP (>SS, 220), 別倉有餘量(調撥優先)
        (6, "C", "Z", "R", 3, "D", 4, 3, 90, 160, 400, 52, 12, 25, 0, 11.5, 10, 5.5),       # C類 < SS (65), 採購
        (7, "B", "Y", "M", 5, "C", 2, 4, 100, 175, 420, 118, 18, 40, 75, 13.5, 14, 150.0),  # B類 < ROP (>SS, 140), 別倉有餘量(調撥優先)
        (8, "A", "Z", "M", 1, "D", 6, 3, 130, 220, 520, 140, 20, 60, 0, 17.0, 19, 290.0),   # A類 < ROP (>SS, 180), 採購
        (9, "B", "X", "F", 2, "B", 5, 5, 115, 200, 460, 135, 15, 45, 60, 15.0, 16, 110.0),  # B類 < ROP (>SS, 165), 別倉有餘量(調撥優先), F類遠區錯放
        (10, "A", "Y", "F", 5, "A", 1, 1, 125, 210, 500, 150, 15, 45, 0, 15.5, 15, 410.0),  # A類 < ROP (>SS, 180), 採購
        (11, "C", "Y", "M", 4, "C", 3, 3, 85, 150, 380, 100, 10, 35, 0, 10.5, 11, 18.0),    # C類 < ROP (>SS, 125), 採購
    ]

    used_slots = set()
    for sp in scripted_specs:
        used_slots.add((sp[5], sp[6], sp[7]))
    rem_slots = [s for s in slots_pool if s not in used_slots]
    random.shuffle(rem_slots)

    for idx in range(120):
        sku_id = f"SKU-{idx + 1:03d}"
        if idx < len(scripted_specs):
            (_, abc, xyz, fmr, cat_i, wh, r, c, ss, rop, max_s,
             on_hand, alloc, on_order, other_wh_qty, daily_use, lead_days, price) = scripted_specs[idx]
            cat = CATEGORIES[cat_i]
        else:
            wh, r, c = rem_slots[idx - len(scripted_specs)]
            cat = CATEGORIES[idx % len(CATEGORIES)]
            price_tier = random.choices(["A", "B", "C"], weights=[0.2, 0.3, 0.5])[0]
            xyz = random.choices(["X", "Y", "Z"], weights=[0.4, 0.35, 0.25])[0]
            # 離出貨口近 (row 1..2) 較多 F 類，但也留少數錯放
            if r <= 2:
                fmr = random.choices(["F", "M", "R"], weights=[0.65, 0.25, 0.10])[0]
            elif r <= 4:
                fmr = random.choices(["F", "M", "R"], weights=[0.15, 0.60, 0.25])[0]
            else:
                fmr = random.choices(["F", "M", "R"], weights=[0.08, 0.32, 0.60])[0]

            price = round(
                random.uniform(250, 680) if price_tier == "A"
                else (random.uniform(55, 240) if price_tier == "B" else random.uniform(3, 50)),
                1
            )
            abc = price_tier  # 稍後依 annual_usage_value 累積占比統一覆寫為單一來源
            daily_use = round(
                random.uniform(14, 28) if fmr == "F"
                else (random.uniform(6, 14) if fmr == "M" else random.uniform(1.2, 6.0)),
                1
            )
            lead_days = random.randint(7, 24)
            ss = int(round(daily_use * random.uniform(4.5, 7.0)))
            rop = int(round(ss + daily_use * (lead_days * 0.45)))
            max_s = int(round(rop * random.uniform(1.8, 2.4)))
            # 正常庫存水位（高於 ROP，隨動畫時間推進部分會跌破 ROP）
            avail_target = int(round(random.uniform(rop * 1.04, max_s * 0.92)))
            alloc = int(round(daily_use * random.uniform(0.8, 2.5)))
            on_order = int(round(daily_use * random.uniform(1.5, 4.5))) if random.random() < 0.45 else 0
            on_hand = max(alloc, avail_target + alloc - on_order)
            other_wh_qty = int(round(random.uniform(30, 140))) if random.random() < 0.35 else 0

        available = on_hand + on_order - alloc
        assert available == on_hand + on_order - alloc and available >= 0, (
            f"Available equation mismatch for {sku_id}"
        )
        other_whs = [w for w in WAREHOUSES if w != wh]
        other_detail = {w: 0 for w in WAREHOUSES}
        if other_wh_qty > 0:
            w1 = other_whs[idx % len(other_whs)]
            w2 = other_whs[(idx + 1) % len(other_whs)]
            q1 = int(round(other_wh_qty * 0.65))
            q2 = other_wh_qty - q1
            other_detail[w1] = q1
            other_detail[w2] = q2

        stockout_days = round(available / max(0.1, daily_use), 1)
        part_list = PART_NAMES[cat]
        part_name = part_list[idx % len(part_list)]
        slot_code = f"{wh}-R{r:02d}-C{c:02d}"
        is_golden = (r <= 2)
        is_misplaced = (fmr == "F" and r >= 5)
        pick_freq = int(round(
            random.uniform(75, 100) if fmr == "F"
            else (random.uniform(35, 70) if fmr == "M" else random.uniform(5, 30))
        ))
        action = (
            ("調撥優先" if other_wh_qty > 0 else "緊急採購")
            if available < rop
            else "正常監控"
        )

        # 12 個月庫存演進軌跡（供動態時間軸無縫插值）
        monthly_avail = []
        cur = float(available)
        for m_i in range(12):
            # 讓庫存在時間軸上呈現耗用與補貨波動
            drift = -daily_use * (0.45 + 0.15 * ((idx + m_i) % 3))
            if m_i in (4, 8, 11) and idx >= 4:
                drift += (rop - ss) * 0.85
            cur = max(float(ss) * 0.35, min(float(max_s) * 0.96, cur + drift))
            monthly_avail.append(int(round(cur)))
        monthly_avail[0] = available

        # 12 個月需求變異係數 CV 序列（供 #39 ABC×XYZ 九宮格動態跨格移動）
        # X: CV < 0.25, Y: 0.25 <= CV < 0.55, Z: CV >= 0.55
        base_cv = (
            random.uniform(0.08, 0.22) if xyz == "X"
            else (random.uniform(0.28, 0.50) if xyz == "Y" else random.uniform(0.58, 0.95))
        )
        monthly_cv = []
        cur_cv = base_cv
        for m_i in range(12):
            if m_i == 0:
                cv_val = round(base_cv, 3)
            else:
                # 讓約 35% 料號跨月在 X/Y/Z 邊界移動
                wave = 0.14 * ((1 if (idx % 3 == 0) else -1)) * (1 if (m_i % 6 < 3) else -0.8)
                if idx % 5 == 0:
                    wave *= 1.65
                cur_cv = max(0.05, min(1.08, cur_cv + wave * 0.28 + random.uniform(-0.03, 0.03)))
                cv_val = round(cur_cv, 3)
            monthly_cv.append(cv_val)

        annual_usage_val = round(daily_use * 365.0 * price, 1)
        inv_value = round(max(1, on_hand) * price, 1)
        monthly_inv_value = [round(max(10, mv) * price, 1) for mv in monthly_avail]

        sku_obj = {
            "id": sku_id,
            "name": f"{sku_id} {part_name}",
            "short_name": part_name,
            "category": cat,
            "abc": abc,
            "xyz": xyz,
            "fmr": fmr,
            "unit_price": price,
            "annual_usage_value": annual_usage_val,
            "inv_value": inv_value,
            "cv": monthly_cv[0],
            "monthly_cv": monthly_cv,
            "monthly_inv_value": monthly_inv_value,
            "on_hand": on_hand,
            "on_order": on_order,
            "allocated": alloc,
            "available": available,
            "ss": ss,
            "rop": rop,
            "max": max_s,
            "daily_usage": daily_use,
            "lead_time_days": lead_days,
            "warehouse": wh,
            "row": r,
            "col": c,
            "slot": {"warehouse": wh, "row": r, "col": c, "code": slot_code},
            "other_wh_avail": other_wh_qty,
            "other_wh_detail": other_detail,
            "stockout_days": stockout_days,
            "pick_freq": pick_freq,
            "is_golden": is_golden,
            "is_misplaced": is_misplaced,
            "action": action,
            "monthly_avail": monthly_avail,
            # 中文別名欄位（對齊規格書檢查）
            "品類": cat,
            "ABC": abc,
            "XYZ": xyz,
            "FMR": fmr,
            "單價": price,
            "現有量": on_hand,
            "在途量": on_order,
            "已分配量": alloc,
            "可用量": available,
            "安全庫存": ss,
            "SS": ss,
            "再訂購點": rop,
            "ROP": rop,
            "上限": max_s,
            "Max": max_s,
            "日均耗用": daily_use,
            "交期天數": lead_days,
            "所在倉": wh,
            "儲位": [r, c],
            "其他倉可用餘量": other_wh_qty,
        }
        skus.append(sku_obj)

    return skus


def build_reuse_datasets(skus):
    """建立 S2 沿用 5 型之庫存模擬資料集（invWaterfall / invAgingTreemap / invKitSankey / invLeadBox / invIraGauge）。"""
    # 1. invWaterfall: 期初 -> 入庫 -> 領用 -> 報廢 -> 期末 (單位：萬元，12 個月)
    wf_frames = []
    cur_val = round(sum(s["inv_value"] for s in skus) / 10000.0, 1)
    for m_i, m in enumerate(MONTHS):
        inbound = round(180 + 45 * ((m_i * 3 + 1) % 4) + random.uniform(-12, 18), 1)
        outbound = -round(165 + 38 * ((m_i * 5 + 2) % 4) + random.uniform(-10, 15), 1)
        scrap = -round(8 + 4 * (m_i % 3) + random.uniform(0, 3), 1)
        end_val = round(cur_val + inbound + outbound + scrap, 1)
        wf_frames.append({
            "label": m,
            "base": cur_val,
            "items": [
                {"name": "本期入庫", "delta": inbound},
                {"name": "本期領用", "delta": outbound},
                {"name": "呆滯報廢", "delta": scrap},
            ],
            "end": end_val,
        })
        cur_val = end_val

    # 2. invAgingTreemap: 呆滯品類庫齡 >90天 金額面積 (單位：萬元，12 個月)
    tm_frames = []
    cat_base = {}
    for cat in CATEGORIES:
        cat_skus = [s for s in skus if s["category"] == cat]
        slow_val = sum(s["inv_value"] * (0.45 if s["fmr"] == "R" else (0.22 if s["fmr"] == "M" else 0.08)) for s in cat_skus)
        cat_base[cat] = round(slow_val / 10000.0, 1)
    for m_i, m in enumerate(MONTHS):
        vals = {}
        for ci, cat in enumerate(CATEGORIES):
            factor = 1.0 + 0.14 * ((m_i + ci) % 4 - 1.5) / 1.5
            vals[cat] = round(max(12.0, cat_base[cat] * factor), 1)
        tm_frames.append({"label": m, "values": vals})

    # 3. invKitSankey: 工單 -> BOM 子件 -> 齊套狀態 (含「1顆C類缺料卡住整張單」)
    sankey_data = {
        "nodes": [
            {"id": "WO-101 電控總成單", "layer": 0},
            {"id": "WO-204 電源模組單", "layer": 0},
            {"id": "WO-309 感測機構單", "layer": 0},
            {"id": "MCU晶片(A類·齊套)", "layer": 1},
            {"id": "PMIC功率(A類·齊套)", "layer": 1},
            {"id": "MLCC電容(C類·缺料)", "layer": 1},
            {"id": "散熱鰭片(B類·齊套)", "layer": 1},
            {"id": "密封O環(C類·低SS)", "layer": 1},
            {"id": "齊套可出貨", "layer": 2},
            {"id": "C類缺料卡住整張單", "layer": 2},
        ],
        "links": [
            {"s": "WO-101 電控總成單", "t": "MCU晶片(A類·齊套)", "v": 99},
            {"s": "WO-101 電控總成單", "t": "MLCC電容(C類·缺料)", "v": 1},
            {"s": "WO-204 電源模組單", "t": "PMIC功率(A類·齊套)", "v": 64},
            {"s": "WO-204 電源模組單", "t": "MLCC電容(C類·缺料)", "v": 1},
            {"s": "WO-309 感測機構單", "t": "散熱鰭片(B類·齊套)", "v": 48},
            {"s": "WO-309 感測機構單", "t": "密封O環(C類·低SS)", "v": 2},
            {"s": "MCU晶片(A類·齊套)", "t": "C類缺料卡住整張單", "v": 99},
            {"s": "MLCC電容(C類·缺料)", "t": "C類缺料卡住整張單", "v": 2},
            {"s": "PMIC功率(A類·齊套)", "t": "齊套可出貨", "v": 40},
            {"s": "PMIC功率(A類·齊套)", "t": "C類缺料卡住整張單", "v": 24},
            {"s": "散熱鰭片(B類·齊套)", "t": "齊套可出貨", "v": 48},
            {"s": "密封O環(C類·低SS)", "t": "C類缺料卡住整張單", "v": 2},
        ],
    }

    # 4. invLeadBox: 供應商交期箱型圖 (6 大供應商 x 12 月，單位：天)
    suppliers = ["S1·車規晶圓", "S2·功率模組", "S3·高頻線束", "S4·MLCC被動", "S5·散熱機構", "S6·光電感測"]
    box_frames = []
    base_meds = [18, 15, 12, 9, 14, 16]
    for m_i, m in enumerate(MONTHS):
        stats = []
        for si, sup in enumerate(suppliers):
            med = round(base_meds[si] + ((m_i + si) % 5 - 2) * 1.2, 1)
            lo = round(max(3.0, med - random.uniform(4.0, 6.5)), 1)
            q1 = round(max(lo + 1.0, med - random.uniform(2.0, 3.5)), 1)
            q3 = round(med + random.uniform(2.2, 4.5), 1)
            hi = round(q3 + random.uniform(3.5, 9.0), 1)
            stats.append({"lo": lo, "q1": q1, "med": med, "q3": q3, "hi": hi, "n": 24})
        box_frames.append({"label": m, "stats": stats})

    # 5. invIraGauge: 帳實相符率 IRA (12 個月，0.88 ~ 0.985)
    ira_vals = [0.912, 0.905, 0.924, 0.938, 0.946, 0.931, 0.952, 0.961, 0.968, 0.974, 0.979, 0.984]
    ira_frames = [{"label": m, "value": ira_vals[i]} for i, m in enumerate(MONTHS)]

    return {
        "invWaterfall": {"frames": wf_frames},
        "invAgingTreemap": tm_frames,
        "invKitSankey": sankey_data,
        "invLeadBox": {"groups": suppliers, "frames": box_frames},
        "invIraGauge": {"frames": ira_frames},
    }


def main():
    ccc_series = build_ccc_series()
    skus = build_skus()

    # 驗證可用量等式 120/120 與劇情約束
    for s in skus:
        assert s["available"] == s["on_hand"] + s["on_order"] - s["allocated"], (
            f"Available equation failed on {s['id']}"
        )
        assert len(s["monthly_cv"]) == 12, f"Missing 12-month CV on {s['id']}"

    # 依 annual_usage_value 由大到小排序，統一計算單一來源 ABC（與 invPareto 80/95 邊界一致）
    total_ann = sum(s["annual_usage_value"] for s in skus) or 1.0
    skus_by_ann = sorted(skus, key=lambda x: x["annual_usage_value"], reverse=True)
    cum_ann = 0.0
    idx80 = len(skus_by_ann) - 1
    idx95 = len(skus_by_ann) - 1
    found80 = False
    found95 = False
    for i, s in enumerate(skus_by_ann):
        cum_ann += s["annual_usage_value"]
        cum_pct = (cum_ann / total_ann) * 100.0
        if not found80 and cum_pct >= 80.0:
            idx80 = i
            found80 = True
        if not found95 and cum_pct >= 95.0:
            idx95 = i
            found95 = True
    for i, s in enumerate(skus_by_ann):
        tier = "A" if i <= idx80 else ("B" if i <= idx95 else "C")
        s["abc"] = tier
        s["ABC"] = tier

    # 驗證 9 宮格每月總 SKU 數 = 120 且柏拉圖累積終點 = 100%
    sorted_ann = [s["annual_usage_value"] for s in skus_by_ann]
    cum_end_pct = round(sum(sorted_ann) / total_ann * 100.0, 6)
    assert abs(cum_end_pct - 100.0) < 1e-4, f"Pareto cumulative end != 100%: {cum_end_pct}"

    for m_i in range(12):
        cell_sum = 0
        for s in skus:
            cv_m = s["monthly_cv"][m_i]
            xyz_m = "X" if cv_m < 0.25 else ("Y" if cv_m < 0.55 else "Z")
            assert s["abc"] in ("A", "B", "C") and xyz_m in ("X", "Y", "Z")
            cell_sum += 1
        assert cell_sum == 120, f"Month {m_i} 9-grid SKU sum != 120: {cell_sum}"

    reuse = build_reuse_datasets(skus)
    below_rop = [s for s in skus if s["available"] < s["rop"]]
    below_rop_transfer = [s for s in below_rop if s["other_wh_avail"] > 0]
    c_below_ss = [s for s in skus if s["abc"] == "C" and s["available"] < s["ss"]]
    misplaced_f = [s for s in skus if s["is_misplaced"]]

    assert len(skus) == 120, f"Expected 120 SKUs, got {len(skus)}"
    assert len(below_rop) >= 8, f"Expected >=8 SKUs with available < ROP, got {len(below_rop)}"
    assert len(below_rop_transfer) >= 3, f"Expected >=3 below-ROP SKUs with other_wh_avail > 0, got {len(below_rop_transfer)}"
    assert len(c_below_ss) >= 1, f"Expected >=1 C-class SKU below SS, got {len(c_below_ss)}"
    assert len(misplaced_f) >= 3, f"Expected misplaced F-class SKUs, got {len(misplaced_f)}"

    # A1 自檢：以累積占比重算一次，逐顆等於 abc 欄，120/120
    _re_sorted = sorted(skus, key=lambda x: x["annual_usage_value"], reverse=True)
    _re_tot = sum(x["annual_usage_value"] for x in _re_sorted) or 1.0
    _re_cum = 0.0
    _re_i80, _re_i95 = len(_re_sorted) - 1, len(_re_sorted) - 1
    _f80, _f95 = False, False
    for _i, _s in enumerate(_re_sorted):
        _re_cum += _s["annual_usage_value"]
        _cp = (_re_cum / _re_tot) * 100.0
        if not _f80 and _cp >= 80.0:
            _re_i80 = _i; _f80 = True
        if not _f95 and _cp >= 95.0:
            _re_i95 = _i; _f95 = True
    for _i, _s in enumerate(_re_sorted):
        _exp = "A" if _i <= _re_i80 else ("B" if _i <= _re_i95 else "C")
        assert _s["abc"] == _exp and _s["ABC"] == _exp, f"ABC mismatch on {_s['id']}: {_s['abc']} != {_exp}"

    payload = {
        "note": "模擬資料",
        "seed": SEED,
        "generated_at": "2026-11-16",
        "summary": {
            "sku_count": len(skus),
            "warehouses": WAREHOUSES,
            "months_count": len(MONTHS),
            "below_rop_count": len(below_rop),
            "below_rop_transfer_count": len(below_rop_transfer),
            "c_class_below_ss_count": len(c_below_ss),
            "misplaced_f_count": len(misplaced_f),
            "pareto_cum_end_pct": cum_end_pct,
        },
        "months": MONTHS,
        "ccc_series": ccc_series,
        "warehouses": [
            {"id": "A", "name": "A倉（主電控倉）", "rows": 6, "cols": 5, "golden_rows": [1, 2]},
            {"id": "B", "name": "B倉（功率模組倉）", "rows": 6, "cols": 5, "golden_rows": [1, 2]},
            {"id": "C", "name": "C倉（精密機構倉）", "rows": 6, "cols": 5, "golden_rows": [1, 2]},
            {"id": "D", "name": "D倉（備品保稅倉）", "rows": 6, "cols": 5, "golden_rows": [1, 2]},
        ],
        "skus": skus,
        "invWaterfall": reuse["invWaterfall"],
        "invAgingTreemap": reuse["invAgingTreemap"],
        "invKitSankey": reuse["invKitSankey"],
        "invLeadBox": reuse["invLeadBox"],
        "invIraGauge": reuse["invIraGauge"],
    }

    out_dir = os.path.dirname(os.path.abspath(__file__))
    out_path = os.path.join(out_dir, "data_inv.js")
    js_content = (
        '/* note: "模擬資料" — A23 庫存戰情組件模擬資料 (seed=20261116, 120 SKU x 4 倉 x 12 月) */\n'
        "window.A23_DEMO_INV = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(js_content)

    print(
        f"[OK] Generated {out_path} ({len(js_content):,} bytes) | "
        f"SKUs={len(skus)}, below_ROP={len(below_rop)}, transfer_priority={len(below_rop_transfer)}, "
        f"C_below_SS={len(c_below_ss)}, misplaced_F={len(misplaced_f)}"
    )


if __name__ == "__main__":
    main()
