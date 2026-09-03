#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
denko_data.json に英字表記 (name_en) を付与する。

読みの一次情報は Wikipedia「ステーションメモリーズ!」の括弧書き。
かな読みはヘボン式（マクロン無し）へ変換し、公式ラテン綴りがある場合はそれを優先する。
"""

from __future__ import annotations

import json
import os
import re
import sys
from html import unescape


# Wikipedia の自動抽出で崩れる／公式綴りが別にある名前
NAME_EN_OVERRIDE = {
    'のぞみ': 'Nozomi',
    'ニャッシュ': 'Nyash',
    'ダッチュー': 'Dachu',
    '粟生津しいら': 'Aozu Siira',
    '王子しぐれ': 'Oji Sigure',
    '尺土るる': 'Shakudo Lulu',
    '白浜マリン': 'Shirahama Malin',
    '果鳴ツヅキ': 'Hatenaki Tsuduki',
    '総天ギンカ': 'Suten Ginka',
    '大雄山るり': 'Daiyuzan Ruri',
    '蓮台寺ナギサ': 'Rendaiji Nagisa',
    '中津コヨイ': 'Nakatsu Koyoi',
    '阿下喜ニナ': 'Ageki Nina',
    '上ノ山ゆのか': 'Kaminoyama Yunoka',
    '海部なる': 'Kaifu Naru',
    '唐津シズ': 'Karatsu Shizu',
    '那珂湊ねも': 'Nakaminato Nemo',
    '郡元ゆう': 'Korimoto You',
    '美々津あさひ': 'Mimitsu Asahi',
    '下新ゆき': 'Shimonii Yuki',
    '八景島あいり': 'Hakkeijima Airi',
    '新津えつこ': 'Niitsu Etsuko',
    '立野みれい': 'Tateno Mirei',
    '土佐久礼りょう': 'Tosakure Ryo',
    '新阪ルナ': 'Shinsaka Luna',
    '大月シーナ': 'Otsuki Sheena',
    '京橋リオナ': 'Kyobashi Riona',
    '八雲レーノ': 'Yakumo Reno',
    '新居浜ありす': 'Niihama Alice',
    '三条なつめ': 'Sanjo Natsume',
    '小鳥谷スピカ': 'Kozuya Spica',
    '観音町ひめ': 'Kanonmachi Hime',
    '諸星すばる': 'Moroboshi Subaru',
    '調布みずか': 'Chofu Mizuka',
    '東海なな': 'Tokai Nana',
    '但馬ひょうこ': 'Tajima Hyouko',
    '大三東きっか': 'Omisaki Kikka',
    '桑川ゆうり': 'Kuwagawa Yuuri',
    '生山ほたる': 'Shoyama Hotaru',
    '雲屋みゅう': 'Kumoya Myu',
    '五葉あこ': 'Goyo Aco',
    '泰らいむ': 'Tai Lime',
    '南乃れいる': 'Minamino Reiru',
    'エルミーヌ・ワロン': 'Hermine Walloon',
    'ジン・ティエン': 'Jin Tian',
    'ツー・スイラン': 'Zi Suiran',
    'ロン・リンファ': 'Long Linhua',
    'ハノイ・シュアン': 'Hanoi Xuan',
    'ナム・ソユン': 'Nam Seoyun',
    'ピン・ユートン': 'Ping Yu-tung',
    'ヨンサン・ソウ': 'Yongsan Seou',
    'トンタン・チェリン': 'Dongtan Chaerin',
    'ソウル・マウム': 'Seoul Maum',
    'ルジェント・ローマ': 'Rgento Roma',
    'リタ・マドリード': 'Lita Madrid',
    'アメリー・ニーッテュクンプ': 'Amelie Niittykumpu',
    'サブリナ・サンタバーバラ': 'Sabrina Santa Barbara',
    'アヌシュカ・ニューデリー': 'Anushka New Delhi',
    'レニャ・サンモリッツ': 'Lenya St. Moritz',
    'リロ・コオリナ': 'Lilo Ko Olina',
    '蕗つぐみ': 'Fuki Tsugumi',
    '蕗つばめ': 'Fuki Tsubame',
    'ナディア・ヴォヤジャー': 'Nadia Voyager',
    'カフラマーナ・ケニトラ': 'Kahramana Kenitra',
    'ジャミラ・ラバト': 'Jamila Rabat',
    '中ふ頭ななえ': 'Nakafuto Nanae',
}

# かな→ローマ字の後処理（駅名標・通例に合わせる）
ROMAJI_WORD_FIX = {
    'koyou': 'koyo',
    'shichiyou': 'shichiyo',
    'youkaichi': 'yokaichi',
    'ouji': 'oji',
    'oushio': 'oshio',
    'nangou': 'nango',
    'tennouji': 'tennoji',
    'makinokou': 'makinoko',
    'yuuni': 'yuni',
    'yuuhigaoka': 'yuhigaoka',
    'ootsuki': 'otsuki',
    'oomisaki': 'omisaki',
    'aouzu': 'aozu',
    'miyuu': 'miyu',
    'myuu': 'myu',
    'tsuduki': 'tsuzuki',
    'shiina': 'shina',
    'kyoubashi': 'kyobashi',
    'sanjou': 'sanjo',
    'choufu': 'chofu',
    'toukai': 'tokai',
    'shouyama': 'shoyama',
    'goyou': 'goyo',
    'kanommachi': 'kanonmachi',
    'morohoshi': 'moroboshi',
}


KANA_TO_ROMA = {
    'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
    'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
    'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
    'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
    'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
    'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
    'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
    'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
    'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
    'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
    'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',
    'てぃ': 'ti', 'でぃ': 'di', 'でゅ': 'dyu', 'とぅ': 'tu',
    'ふぁ': 'fa', 'ふぃ': 'fi', 'ふぇ': 'fe', 'ふぉ': 'fo',
    'うぃ': 'wi', 'うぇ': 'we', 'うぉ': 'wo',
    'ヴぁ': 'va', 'ヴぃ': 'vi', 'ヴぇ': 've', 'ヴぉ': 'vo', 'ヴゅ': 'vyu',
    'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o',
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'ゐ': 'wi', 'ゑ': 'we', 'を': 'o', 'ん': 'n',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'ー': '-',
}


def _katakana_to_hiragana(text: str) -> str:
    """カタカナをひらがなへ（長音はそのまま）。"""
    out = []
    for ch in text:
        code = ord(ch)
        if 0x30A1 <= code <= 0x30F6:
            out.append(chr(code - 0x60))
        else:
            out.append(ch)
    return ''.join(out)


def kana_to_romaji(text: str) -> str:
    """かなをヘボン式ローマ字へ変換する。失敗時は空文字。"""
    if not text:
        return ''
    src = _katakana_to_hiragana(text)
    result = []
    i = 0
    length = len(src)
    while i < length:
        ch = src[i]
        if ch in ' \u3000・＝=/.-':
            result.append(' ')
            i += 1
            continue
        if ch in 'っッ':
            nxt = src[i + 1] if i + 1 < length else ''
            nxt_roma = ''
            if i + 2 <= length:
                nxt_roma = KANA_TO_ROMA.get(src[i + 1:i + 3], '')
            if not nxt_roma:
                nxt_roma = KANA_TO_ROMA.get(nxt, '')
            if nxt_roma:
                doubled = nxt_roma[0]
                if doubled == 'c':
                    doubled = 't'
                result.append(doubled)
            i += 1
            continue
        if i + 2 <= length and src[i:i + 2] in KANA_TO_ROMA:
            result.append(KANA_TO_ROMA[src[i:i + 2]])
            i += 2
            continue
        if ch in KANA_TO_ROMA:
            roma = KANA_TO_ROMA[ch]
            if roma == '-':
                # 長音は直前の母音を伸ばす
                if result:
                    prev = result[-1]
                    vowel = next((v for v in reversed(prev) if v in 'aiueo'), 'u')
                    result.append(vowel)
            else:
                result.append(roma)
            i += 1
            continue
        # 変換できない文字が混ざったら中断して呼び出し側で別処理
        if re.search(r'[A-Za-zÀ-ÿ]', ch):
            result.append(ch)
            i += 1
            continue
        return ''
    joined = ''.join(result)
    joined = re.sub(r'n([bmp])', r'm\1', joined)
    joined = re.sub(r'\s+', ' ', joined).strip()
    return joined


def title_romaji_word(word: str) -> str:
    """ローマ字単語をタイトルケースにする（von / van / de は小文字）。"""
    lower = word.lower()
    lower = ROMAJI_WORD_FIX.get(lower, lower)
    if lower in {'von', 'van', 'de', 'da', 'di', 'del', 'el', 'al', 'st.'}:
        return lower
    if not lower:
        return word
    return lower[0].upper() + lower[1:]


def reading_to_name_en(reading: str) -> str:
    """括弧内の読み・ラテン綴りを英字表記へ正規化する。"""
    if not reading:
        return ''
    text = unescape(reading).strip()
    # スラッシュ以降（現地語・キリルなど）は捨てる
    text = text.split('/')[0].strip()
    text = text.replace('＝', '=').replace('・', ' ')
    # すでにラテン文字中心なら整形して返す
    letters = re.sub(r'[^A-Za-zÀ-ÿ]', '', text)
    others = re.sub(r'[A-Za-zÀ-ÿ0-9\s.\-\'’ʻʻ]', '', text)
    if letters and len(letters) >= max(3, len(others)):
        cleaned = re.sub(r'\s+', ' ', text).strip()
        # Newdelhi のような連結を後で OVERRIDE する
        return cleaned
    roma = kana_to_romaji(text)
    if not roma:
        return ''
    words = [title_romaji_word(w) for w in roma.split(' ') if w]
    return ' '.join(words)


def extract_wiki_readings(wiki_text: str) -> dict[str, str]:
    """Wikipedia本文から 名前（読み） をできるだけ拾う。"""
    readings: dict[str, str] = {}
    pattern = re.compile(
        r'([一-龥ぁ-んァ-ヴー＝=・]{2,40})\s*[（(]([^）)]{1,80})[）)]'
    )
    for name, reading in pattern.findall(wiki_text):
        key = name.replace('=', '＝').replace(' ', '')
        if key not in readings:
            readings[key] = reading.strip()
    # 半角括弧の読み（阿下喜ニナ (あげき にな) など）
    pattern2 = re.compile(
        r'([一-龥ぁ-んァ-ヴー＝=・]{2,40})\s*\(([ぁ-んァ-ヴーA-Za-zÀ-ÿ /.\-\']+)\)'
    )
    for name, reading in pattern2.findall(wiki_text):
        key = name.replace('=', '＝').replace(' ', '')
        if key not in readings:
            readings[key] = reading.strip()
    return readings


def find_reading(name: str, readings: dict[str, str]) -> str:
    """正式名に対応する読みを返す。"""
    key = name.replace('=', '＝').replace(' ', '')
    if key in readings:
        return readings[key]
    # 末尾の下の名前で部分一致（黄陽レイカ ← レイカ など）
    m = re.search(r'([ぁ-んァ-ヴーA-Za-z]+)$', key)
    if not m:
        return ''
    tail = m.group(1)
    for wiki_name, reading in readings.items():
        if wiki_name.endswith(tail) and len(wiki_name) >= 2:
            # 読みにスペースがあれば姓+名として採用
            if ' ' in reading or re.search(r'[A-Za-z]', reading):
                return reading
    return ''


def build_name_en(name: str, readings: dict[str, str]) -> str:
    """でんこ名から英字表記を組み立てる。"""
    if name in NAME_EN_OVERRIDE:
        return NAME_EN_OVERRIDE[name]
    reading = find_reading(name, readings)
    converted = reading_to_name_en(reading) if reading else ''
    if converted:
        # 漢字・ハングルだけが残った場合は OVERRIDE 必須
        if re.search(r'[一-龥가-힣]', converted):
            raise ValueError(f'ラテン綴りの解決が必要です: {name} ({reading})')
        return converted
    raise ValueError(f'英字表記を生成できませんでした: {name}')


def reorder_denko(denko: dict) -> dict:
    """JSONのキー順を id, name, name_en, ... に揃える。"""
    ordered = {}
    for key in ('id', 'name', 'name_en', 'type', 'attribute', 'color', 'skill_name', 'skill_effect'):
        if key in denko:
            ordered[key] = denko[key]
    for key, value in denko.items():
        if key not in ordered:
            ordered[key] = value
    return ordered


def main() -> int:
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        json_path = os.path.join(base_dir, 'denko_data.json')
        with open(json_path, 'r', encoding='utf-8') as file:
            denko_data = json.load(file)

        wiki_candidates = [
            os.path.join(base_dir, 'wiki', 'station_memories_wikipedia.txt'),
            os.path.join(
                os.path.expanduser('~'),
                '.cursor/projects/home-sleach/agent-tools/2e64d1c4-1f9e-4d30-9383-5bdecb48a89f.txt',
            ),
        ]
        wiki_text = ''
        for wiki_path in wiki_candidates:
            if os.path.isfile(wiki_path):
                with open(wiki_path, 'r', encoding='utf-8') as file:
                    wiki_text = file.read()
                break
        if not wiki_text:
            print('Wikipedia読みソースが見つからないため、OVERRIDE と既存 name_en を使います。')
        readings = extract_wiki_readings(wiki_text)

        generated = 0
        for group in ('original', 'extra'):
            for denko in denko_data[group]:
                name = denko.get('name', '')
                existing_en = denko.get('name_en')
                try:
                    denko['name_en'] = build_name_en(name, readings)
                except ValueError as error:
                    if existing_en:
                        denko['name_en'] = existing_en
                        print(f'警告: {error} → 既存の name_en を保持します')
                    else:
                        raise
                generated += 1

        denko_data['original'] = [reorder_denko(d) for d in denko_data['original']]
        denko_data['extra'] = [reorder_denko(d) for d in denko_data['extra']]

        with open(json_path, 'w', encoding='utf-8') as file:
            json.dump(denko_data, file, ensure_ascii=False, indent=2)
            file.write('\n')

        print(f'name_en を {generated} 件書き込みました: {json_path}')
        print('--- sample original ---')
        for denko in denko_data['original'][:8]:
            print(f"  {denko['id']:3} {denko['name']} / {denko['name_en']}")
        print('--- sample extra ---')
        for denko in denko_data['extra'][:6]:
            print(f"  {denko['id']:3} {denko['name']} / {denko['name_en']}")
        return 0
    except Exception as error:
        print(f'英字表記の付与に失敗しました: {error}', file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
