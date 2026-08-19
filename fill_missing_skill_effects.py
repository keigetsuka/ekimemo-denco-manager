#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
denko_data.json の未記載スキル効果を新・駅メモ!!wiki から補完する。

各でんこ個別ページの Lv.1 説明文を効果テキストとして採用する。
スキルなしのでんこ（さや・もぼ）は「スキルはありません」を設定する。
wiki 由来のフレーバーテキスト「成長すると～」は除去する。
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
import urllib.parse
from html import unescape
from pathlib import Path

WIKI_BASE = 'https://newekimemo.wiki.fc2.com/wiki/'
NO_SKILL_NAMES = {'天下さや', '有栖川もぼ'}
NO_SKILL_EFFECT = 'スキルはありません'
MISSING_MARKER = 'スキル情報が見つかりませんでした'
REQUEST_INTERVAL_SEC = 0.35


def fetch_wiki_text(page_name: str) -> str:
    """wiki ページ本文を取得する（curl 経由で HTML→テキスト簡易変換）"""
    url = WIKI_BASE + urllib.parse.quote(page_name)
    try:
        proc = subprocess.run(
            [
                'curl', '-sL', '--noproxy', '*', '--connect-timeout', '20',
                '-A', 'Mozilla/5.0 (compatible; ekimemo-denco-manager/1.0)',
                url,
            ],
            capture_output=True,
            text=True,
            check=False,
            timeout=30,
        )
    except subprocess.TimeoutExpired as error:
        raise TimeoutError(f'curl timeout: {page_name}') from error

    if proc.returncode != 0:
        raise RuntimeError(f'curl failed ({proc.returncode}): {page_name}')

    html = proc.stdout
    if not html.strip():
        raise RuntimeError(f'empty response: {page_name}')

    # user_body 相当を抽出
    body_match = re.search(r'<div class="user_body">(.*?)</div>\s*<div class="user_footer">', html, re.DOTALL)
    if not body_match:
        body_match = re.search(r'<div class="user_body">(.*)', html, re.DOTALL)
    body = body_match.group(1) if body_match else html

    text = re.sub(r'<br\s*/?>', '\n', body, flags=re.IGNORECASE)
    text = re.sub(r'</tr>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</t[dh]>', ' | ', text, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = unescape(text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text


def clean_effect_text(effect: str) -> str:
    """テーブル列の混入とフレーバーテキストを除去して効果文を整形する"""
    effect = effect.strip().replace('\u200b', '')
    # wiki Lv.1 説明末尾の成長フレーバー文を除去
    if '成長すると' in effect:
        effect = effect.split('成長すると', 1)[0].rstrip()
    cut_markers = [
        ' | Lv.2',
        ' | Lv.3',
        ' | ATK',
        ' | DEF',
        ' | HP',
        ' | 経験値',
        ' | ダメージ',
        ' | 効果量',
        ' | 2駅',
        ' | 3回',
        ' | 4回',
        ' | 100%',
        ' | 30分',
        ' | 編成内のフィルム',
    ]
    for marker in cut_markers:
        idx = effect.find(marker)
        if idx > 0:
            effect = effect[:idx]
    return re.sub(r'\s+', ' ', effect).strip()


def extract_lv1_effect(page_text: str, skill_name: str) -> str | None:
    """
    スキルセクション内の Lv.1 行から効果説明を抽出する。
    """
    skill_idx = page_text.find(skill_name)
    search_text = page_text[skill_idx:] if skill_idx >= 0 else page_text

    row_match = re.search(
        r'Lv\.1\s*\(でんこLv\.?\s*5\)\s*\|\s*(.+)',
        search_text,
        re.DOTALL,
    )
    if not row_match:
        return None

    # 最初の列のみが効果説明（以降は数値・発動率など）
    effect = row_match.group(1).split(' | ')[0].strip()
    effect = clean_effect_text(effect)
    if len(effect) >= 8:
        return effect
    return None


def load_missing_denko(data: dict) -> list[dict]:
    """未記載のでんこ一覧を返す"""
    missing = []
    for category in ('original', 'extra'):
        for denko in data.get(category, []):
            if MISSING_MARKER in denko.get('skill_effect', ''):
                item = dict(denko)
                item['category'] = category
                missing.append(item)
    return missing


def main() -> int:
    base_dir = Path(__file__).resolve().parent
    json_path = base_dir / 'denko_data.json'

    try:
        data = json.loads(json_path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as error:
        print(f'denko_data.json の読み込みに失敗: {error}', file=sys.stderr)
        return 1

    missing_list = load_missing_denko(data)
    if not missing_list:
        print('未記載のスキル効果はありません。')
        return 0

    results: dict[tuple[str, int], str] = {}
    failures: list[str] = []

    for denko in missing_list:
        cat = denko['category']
        denko_id = denko['id']
        name = denko['name']
        skill_name = denko.get('skill_name', '')

        if name in NO_SKILL_NAMES or skill_name == NO_SKILL_EFFECT:
            results[(cat, denko_id)] = NO_SKILL_EFFECT
            print(f'OK (no skill): {name}')
            continue

        try:
            page_text = fetch_wiki_text(name)
            effect = extract_lv1_effect(page_text, skill_name)
            if not effect:
                # ページ未作成・名称不一致のフォールバック
                if 'ページ名' in page_text and '見つかりません' in page_text:
                    failures.append(f'{name}: wiki page not found')
                else:
                    failures.append(f'{name}: Lv.1 effect not parsed (skill={skill_name})')
                print(f'FAIL: {name}')
            else:
                results[(cat, denko_id)] = effect
                print(f'OK: {name}')
        except (RuntimeError, TimeoutError, subprocess.SubprocessError) as error:
            failures.append(f'{name}: {error}')
            print(f'FAIL: {name} ({error})')
        except Exception as error:  # noqa: BLE001 — 1件失敗で全体を止めない
            failures.append(f'{name}: {error}')
            print(f'FAIL: {name} ({error})')

        time.sleep(REQUEST_INTERVAL_SEC)

    updated = 0
    for category in ('original', 'extra'):
        for denko in data.get(category, []):
            key = (category, denko['id'])
            if key in results:
                denko['skill_effect'] = results[key]
                updated += 1

    json_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8',
    )

    print(f'\n更新: {updated}/{len(missing_list)} 件')
    if failures:
        print(f'失敗: {len(failures)} 件')
        for msg in failures:
            print(f'  - {msg}')
        return 2

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
