#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
駅メモ！でんこデータ抽出スクリプト v3.2

概要: 名前のマッピングを正しく行い、スキル情報を正確に紐づけるバージョン
主な仕様: 基本情報ページの正式名とスキル情報ページの下の名前をマッピング
改善点: 外国語名でんこ（「・」「＝」区切り）のファーストネーム抽出に対応
新機能: 特殊な外国語名でんこ（6体）の例外処理を追加 - 2番目のネームを使用
制限事項: HTMLファイルが正しい形式である必要がある
"""

import re
import json
import os
from html import unescape

def extract_name_mapping(full_name):
    """
    正式名からスキル検索用の名前を抽出
    - 日本名のでんこ：下の名前（例：「黄陽セリア」→「セリア」）
    - 外国名（カタカナ名）のでんこ：ファーストネーム（例：「エルミーヌ・ワロン」→「エルミーヌ」、「シャルロッテ＝フォン＝ハノーファー」→「シャルロッテ」、「アリス=カータレット」→「アリス」）
    - 特殊な外国名でんこ：2番目のネームを使用（例外処理）
    """
    # 特殊な外国語名でんこの例外処理（2番目のネームを使用）
    special_foreign_names = {
        'ジン・ティエン': 'ティエン',
        'ツー・スイラン': 'スイラン',
        'ロン・リンファ': 'リンファ',
        'ハノイ・シュアン': 'シュアン',
        'ナム・ソユン': 'ソユン',
        'ピン・ユートン': 'ユートン'
    }
    
    # 特殊な例外処理が必要なでんこかチェック
    if full_name in special_foreign_names:
        return special_foreign_names[full_name]
    
    # 「・」「＝」「=」で区切られている場合は外国名として扱う
    if '・' in full_name:
        # 「・」区切りの外国名の場合はファーストネーム（最初の部分）を返す
        return full_name.split('・')[0]
    elif '＝' in full_name:
        # 「＝」区切りの外国名の場合はファーストネーム（最初の部分）を返す
        return full_name.split('＝')[0]
    elif '=' in full_name:
        # 「=」区切りの外国名の場合はファーストネーム（最初の部分）を返す
        return full_name.split('=')[0]
    
    # 日本名の場合は下の名前を抽出
    patterns = [
        r'([ぁ-ん]+)$',  # ひらがなで終わる
        r'([ァ-ヴー]+)$',  # カタカナで終わる
        r'([a-zA-Z]+)$',  # アルファベットで終わる
    ]
    
    for pattern in patterns:
        match = re.search(pattern, full_name)
        if match:
            return match.group(1)
    
    # パターンにマッチしない場合は全体を返す
    return full_name


def _is_wiki_color_column_td(td_attrs):
    """
    色列の<td>かどうか（wikiの色セルは style に background-color を含む）
    rowspan で色が結合された次の行ではこのセルが省略され、列がずれる。
    """
    if not td_attrs:
        return False
    return 'background-color' in td_attrs.lower()


def _clean_cell_text(cell_inner_html):
    """セル内HTMLから表示テキストを取り出す（タグ除去・エンティティ復元）"""
    text = re.sub(r'<[^>]+>', '', cell_inner_html)
    text = unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    # ノンブレークスペースのみのセルは空扱い
    if text.replace('\xa0', '').strip() == '':
        return ''
    return text


def extract_denko_basic_info(html_file_path):
    """
    でんこの基本情報を抽出（オリジナル・エクストラ共通）
    """
    try:
        with open(html_file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        print(f"ファイル読み込み: {os.path.basename(html_file_path)}")
        
        # テーブル行を抽出
        tr_pattern = r'<tr>(.*?)</tr>'
        rows = re.findall(tr_pattern, content, re.DOTALL)
        
        print(f"抽出されたテーブル行数: {len(rows)}")
        
        denko_list = []
        # 色列が rowspan で結合されているとき、次行は色<td>が無いため直前の色を引き継ぐ
        last_color = None
        
        for i, row in enumerate(rows):
            # 属性付きでセルを抽出（色列判定に属性が必要）
            td_pattern = r'<td([^>]*)>(.*?)</td>'
            td_parts = re.findall(td_pattern, row, re.DOTALL)
            cells = [p[1] for p in td_parts]
            td_attrs_list = [p[0] for p in td_parts]
            
            if len(cells) >= 7:  # 最低7列必要
                clean_cells = [_clean_cell_text(c) for c in cells]
                
                # No.の形式をチェック（オリジナル: 数字、エクストラ: EX01形式）
                first_cell = clean_cells[0] if clean_cells else ''
                denko_id = None
                
                if first_cell:
                    if first_cell.isdigit():
                        # オリジナルでんこの場合
                        denko_id = int(first_cell)
                    elif first_cell.startswith('EX') and len(first_cell) > 2:
                        # エクストラでんこの場合
                        ex_num = first_cell[2:]
                        if ex_num.isdigit():
                            denko_id = int(ex_num)
                
                if denko_id is not None:
                    try:
                        # でんこ名を抽出（リンクテキストから）
                        name_cell = cells[2] if len(cells) > 2 else ''
                        name_match = re.search(r'>([^<]+)</a>', name_cell)
                        if name_match:
                            full_name = name_match.group(1)
                        else:
                            full_name = clean_cells[2] if len(clean_cells) > 2 else ''
                        
                        # 下の名前を抽出
                        short_name = extract_name_mapping(full_name)
                        
                        # その他の情報を抽出
                        denko_type = clean_cells[3] if len(clean_cells) > 3 else ''
                        
                        # 属性を抽出（画像のaltテキストから）
                        attribute_cell = cells[4] if len(cells) > 4 else ''
                        attribute_match = re.search(r'alt="([^"]+)"', attribute_cell)
                        if attribute_match:
                            denko_attribute = attribute_match.group(1)
                        else:
                            denko_attribute = clean_cells[4] if len(clean_cells) > 4 else ''
                        
                        # 色・スキル列: rowspan により色セルが無い行では列が1つずれ、5列目がスキル列になる
                        attrs5 = td_attrs_list[5] if len(td_attrs_list) > 5 else ''
                        if _is_wiki_color_column_td(attrs5):
                            denko_color = clean_cells[5] if len(clean_cells) > 5 else ''
                            skill_name = clean_cells[6] if len(clean_cells) > 6 else ''
                            last_color = denko_color
                        else:
                            denko_color = last_color if last_color is not None else (
                                clean_cells[5] if len(clean_cells) > 5 else '')
                            skill_name = clean_cells[5] if len(clean_cells) > 5 else ''
                        
                        if full_name and full_name != '':
                            denko_info = {
                                'id': denko_id,
                                'name': full_name,
                                'short_name': short_name,  # スキル検索用
                                'type': denko_type,
                                'attribute': denko_attribute,
                                'color': denko_color,
                                'skill_name': skill_name
                            }
                            denko_list.append(denko_info)
                            
                            if len(denko_list) <= 10:
                                print(f"でんこ追加: No.{denko_id} {full_name} ({short_name}) - {denko_type}, {denko_attribute}")
                    
                    except (ValueError, IndexError) as e:
                        if i < 10:
                            print(f"行 {i} の処理でエラー: {e}")
                        continue
        
        print(f"抽出完了: {len(denko_list)}体のでんこ")
        return sorted(denko_list, key=lambda x: x['id'])
        
    except Exception as error:
        print(f"でんこ基本情報の抽出エラー: {error}")
        import traceback
        traceback.print_exc()
        return []

def extract_denko_skill_info(html_file_path):
    """
    でんこのスキル情報を抽出（下の名前ベース）
    """
    try:
        with open(html_file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        print(f"スキル情報読み込み: {os.path.basename(html_file_path)}")
        
        skill_dict = {}
        
        # テーブル行を抽出
        tr_pattern = r'<tr>(.*?)</tr>'
        rows = re.findall(tr_pattern, content, re.DOTALL)
        
        print(f"スキル情報テーブル行数: {len(rows)}")
        
        for i, row in enumerate(rows):
            # セルの内容を抽出
            td_pattern = r'<td[^>]*>(.*?)</td>'
            cells = re.findall(td_pattern, row, re.DOTALL)
            
            if len(cells) >= 5:  # スキル名、効果、タイプ、対象、でんこ名の順
                # HTMLタグを除去してクリーンアップ
                clean_cells = []
                for cell in cells:
                    clean_cell = re.sub(r'<[^>]+>', '', cell)
                    clean_cell = re.sub(r'\s+', ' ', clean_cell).strip()
                    clean_cells.append(clean_cell)
                
                # スキル名（1列目）
                skill_name = clean_cells[0] if len(clean_cells) > 0 else ''
                
                # スキル効果（2列目）
                skill_effect = clean_cells[1] if len(clean_cells) > 1 else ''
                
                # でんこ名を抽出（5列目、リンクテキストから）
                name_cell = cells[4] if len(cells) > 4 else ''
                name_match = re.search(r'>([^<]+)</a>', name_cell)
                if name_match:
                    short_name = name_match.group(1)
                else:
                    short_name = clean_cells[4] if len(clean_cells) > 4 else ''
                
                # でんこ名が有効な場合のみ追加
                if short_name and short_name != '' and skill_name and skill_name != '':
                    skill_dict[short_name] = {
                        'skill_name': skill_name,
                        'skill_effect': skill_effect
                    }
                    
                    if len(skill_dict) <= 10:
                        print(f"スキル追加: {short_name} - {skill_name}")
        
        print(f"スキル情報抽出完了: {len(skill_dict)}件")
        return skill_dict
        
    except Exception as error:
        print(f"スキル情報の抽出エラー: {error}")
        import traceback
        traceback.print_exc()
        return {}

def merge_denko_data(basic_info_list, skill_info_dict):
    """
    基本情報とスキル情報をマージ（short_nameでマッピング）
    """
    merged_list = []
    matched_skills = 0
    
    for denko in basic_info_list:
        short_name = denko.get('short_name', '')
        
        # スキル情報を追加
        if short_name in skill_info_dict:
            skill_info = skill_info_dict[short_name]
            denko['skill_name'] = skill_info['skill_name']
            denko['skill_effect'] = skill_info['skill_effect']
            matched_skills += 1
        else:
            # スキル情報が見つからない場合
            if not denko.get('skill_effect'):
                denko['skill_effect'] = f'※スキル情報が見つかりませんでした（検索名: {short_name}）'
        
        # short_nameは出力JSONから除去
        output_denko = {k: v for k, v in denko.items() if k != 'short_name'}
        merged_list.append(output_denko)
    
    print(f"スキル情報マッチング: {matched_skills}/{len(basic_info_list)}件")
    return merged_list

def main():
    """
    メイン処理: でんこデータを抽出してJSONファイルを生成
    """
    try:
        # スクリプト配置ディレクトリ基準（どのカレントから実行しても同じ結果にする）
        base_dir = os.path.dirname(os.path.abspath(__file__))
        wiki_dir = os.path.join(base_dir, 'wiki')
        
        # ファイルパスの定義（wiki 内の実ファイル名と一致させる）
        original_basic_file = os.path.join(wiki_dir, '顔画像・タイプ・属性・色・スキル名_オリジナルでんこ - 新・駅メモ!!wiki.html')
        original_skill_file = os.path.join(wiki_dir, 'オリジナルでんこスキル一覧・効果 - 駅メモ！情報.html')
        extra_basic_file = os.path.join(wiki_dir, '顔画像・タイプ・属性・色・スキル名_エクストラでんこ - 新・駅メモ!!wiki.html')
        extra_skill_file = os.path.join(wiki_dir, 'エクストラでんこスキル一覧・効果 - 駅メモ！情報.html')
        
        print("=== 駅メモ！でんこデータ抽出開始 v3.1 ===")
        print("改善点: 外国語名でんこ（「・」「＝」区切り）のファーストネーム抽出に対応")
        
        # オリジナルでんこの情報を抽出
        print("\n--- オリジナルでんこ処理開始 ---")
        original_basic = extract_denko_basic_info(original_basic_file)
        original_skills = extract_denko_skill_info(original_skill_file)
        
        # エクストラでんこの情報を抽出
        print("\n--- エクストラでんこ処理開始 ---")
        extra_basic = extract_denko_basic_info(extra_basic_file)
        extra_skills = extract_denko_skill_info(extra_skill_file)
        
        # データをマージ
        print("\n--- データマージ処理 ---")
        original_merged = merge_denko_data(original_basic, original_skills)
        extra_merged = merge_denko_data(extra_basic, extra_skills)
        
        # JSONデータを作成
        denko_data = {
            'original': original_merged,
            'extra': extra_merged
        }
        
        # JSONファイルに保存
        output_file = os.path.join(base_dir, 'denko_data.json')
        with open(output_file, 'w', encoding='utf-8') as file:
            json.dump(denko_data, file, ensure_ascii=False, indent=2)
        
        print(f"\n=== 抽出完了 ===")
        print(f"オリジナルでんこ: {len(original_merged)}体")
        print(f"エクストラでんこ: {len(extra_merged)}体")
        print(f"合計: {len(original_merged) + len(extra_merged)}体")
        print(f"出力ファイル: {output_file}")
        
        # サンプルデータを表示（スキル情報が正しくマッピングされているか確認）
        if original_merged:
            print("\n=== オリジナルでんこサンプル（スキル情報確認） ===")
            for i, denko in enumerate(original_merged[:5]):
                skill_status = "✅" if "※スキル情報が見つかりませんでした" not in denko.get('skill_effect', '') else "❌"
                print(f"{skill_status} No.{denko['id']:3d}: {denko['name']} ({denko['type']}, {denko['attribute']})")
                print(f"         スキル: {denko.get('skill_name', 'N/A')}")
                if i < 2:  # 最初の3件のみスキル効果も表示
                    effect = denko.get('skill_effect', 'N/A')
                    if len(effect) > 50:
                        effect = effect[:50] + "..."
                    print(f"         効果: {effect}")
        
        if extra_merged:
            print("\n=== エクストラでんこサンプル（スキル情報確認） ===")
            for i, denko in enumerate(extra_merged[:3]):
                skill_status = "✅" if "※スキル情報が見つかりませんでした" not in denko.get('skill_effect', '') else "❌"
                print(f"{skill_status} No.{denko['id']:3d}: {denko['name']} ({denko['type']}, {denko['attribute']})")
                print(f"         スキル: {denko.get('skill_name', 'N/A')}")
        
    except Exception as error:
        print(f"メイン処理でエラーが発生しました: {error}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
