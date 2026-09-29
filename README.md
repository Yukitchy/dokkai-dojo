# Dokkai Dojo

JLPT読解ドリル（N5〜N1）の箱。Kanji Dojo と同じ型で、`engine/` に中身を持たず、`packs/<name>/` に文章と問題を置く。

- `engine/` — 表示・ふりがなON/OFF（既定OFF・必要な時だけON）・本番モード（ルビOFF＋タイマー＋最後に答え合わせ）・根拠の黄色表示・結果コピー・印刷用PDF。
- `rules/levels.json` — レベルごとの読者像・文体・使ってよい文法／使えない文法・字数・大問構成。check.py の基準。
- `rules/generate.md` — 好みプロファイルからレベル別の文章と問題を作る手順。
- `packs/animesensei/` — 標準パック（秋葉原・喫茶ねこまど・留学生シリーズ）。
- `packs/isekai-ln/` — ライトノベル・異世界もの好き向けパック（好みから作った例）。
- `index.html?pack=<name>&lv=n3` で開く。`&print=1` で印刷用の版を組む。

## 新しい好みのパックを作る
1. `packs/<好みの名前>/profile.json` を書く（生徒の名前は書かない。`likes` と `plan`、既存作品の登場人物名は `ng_terms` へ）。
2. `rules/generate.md` の手順で `n5.json`〜`n1.json` を作る。
3. `uv run --with janome python3 check.py <好みの名前>` が ✗ 0 になるまで直す。

`rules/npo_vocab.json`（語彙表）と `rules/ref_source.txt`（照合用の参照テキスト）はローカル専用で、公開しない。

レベル設計の参考: NPO多言語多読「レベル分けの目安」「語彙表」「文型表」 https://tadoku.org/japanese/
