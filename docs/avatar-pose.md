# アバターのポーズ: 調査と設計

[docs/avatar-motion.md](avatar-motion.md) で「ポーズ間のつなぎ目」を直したあと、**遷移先のポーズそのものに違和感がある**という指摘を受けての調査。
動きの滑らかさではなく、静止したときの姿勢の自然さを対象にする。

## 1. いまのポーズの問題（実際の画面を撮って確認）

`apps/web/src/avatar/motions.ts` の身振りを全部撮り、正面・斜め・横から見て分かったこと。

1. **左右対称すぎる（twinning）** — ほぼ全ての身振りで左右の腕が同じ角度、脚は平行、頭は正面。
   アニメーションの世界では「操り人形に見える最大の原因」とされる典型
2. **指がまっすぐ** — 指の骨を一度も動かしていなかった。手を開いた身振り（驚く・わたわた）で特に目立つ
3. **脚と足をまったく動かしていない** — 重心が両足の真ん中のまま。立ち方に体重が感じられない
4. **腰に手（`angry` / `proud`）が届いていない** — 正面では手が腰の横に見えるが、横から見ると手が腰から離れて前に浮いている
5. **腕が体・スカートに潜る** — 腕を下ろした身振りで、前腕がスカートの中に入る
6. **肩が動かない** — 腕を上げても肩のラインが水平のまま
7. **`sad` が `neutral` とほとんど同じに見える** — 頭を下げるだけで、姿勢に気分が出ていない

## 2. 世の中のやり方（調査）

### 2.1 絵・アニメーションの定石

| 原則 | 内容 | 出典 |
|---|---|---|
| ライン・オブ・アクション | 体を貫く1本の曲線でポーズの意図を決める。C字は落ち着き、S字はひねり | [Animseeds](https://www.animseeds.com/post/21-posing-principles-for-animation-and-figure-drawing-for-animators) |
| コントラポスト | 片足に体重を乗せると、その側の骨盤が上がり、肩のラインは逆に傾く。腰と膝のラインは平行 | [パルミー](https://www.palmie.jp/lessons/21) / [MediBang](https://medibangpaint.com/en/use/2020/10/about-posing-basic/) |
| ツイニング回避 | 左右同じ角度・脚が平行・頭が真ん中、は人形に見える。**わずか2〜3度のずれでも効く** | [Animation Mentor](https://www.animationmentor.com/blog/twinning-and-why-you-should-usually-avoid-it/) |
| 塊から置く | 関節をいじる前に、骨盤・胸郭・頭という塊の位置と向きを決める | [Animator's Checklist](https://animatorschecklist.com/en/pose-o-todo-lo-que-hay-que-saber-para-hacer-una-buena-pose/) |
| 回転を分配する | ひねりを1本の背骨に集中させず、複数の背骨に小さく配る | [Blender Visual Investigation](https://blendervisualinvestigation.com/knowledge-base/docs/techniques/animation-dynamics/posing/) |
| シルエット | 黒く塗りつぶしても意図が読めるか。腕と胴の間に隙間（ネガティブスペース）を作る | [Animworks](https://anim.works/silhouette-in-animation/) |
| 重心の検算 | 重心の真下が、支えている足の上か両足の間にあるか（Cascadeur が実装している唯一の物理的な正解判定） | [Cascadeur](https://cascadeur.com/help/animation_pipeline/physics) |
| 肩を連動させる | **腕が体から30度以上離れたら、肩を必ず動かす**。固めたままは硬く見える | [CG Channel](https://www.cgchannel.com/2022/03/10-subtle-mistakes-to-avoid-in-character-animation/) |

**重要な注意**: 絵の講座はほぼ全て定性的で、角度の数値を出さない。「腰を何度落とすか」「肩を何度傾けるか」の数値は、
和英どちらの資料にも見つからなかった。数値が取れるのは臨床・バイオメカニクスと、リグの技術仕様だけ。

### 2.2 体の理屈（数値のある部分）

| 項目 | 数値 | 出典 |
|---|---|---|
| 体のひねりの配分 | 胸椎47度 : 腰椎15.3度（約3:1）。**ひねりはほぼ胸で起きる** | [Anatomy Standard](https://www.anatomystandard.com/biomechanics/spine/rom-of-spine.html) |
| 前屈の配分 | 腰椎65度 : 胸椎26度（約2.5:1）。猫背・前かがみは腰が主役 | 同上 |
| 肩甲上腕リズム | 腕を上げる角度のうち、30度までは肩甲骨は動かない。以降は腕2 : 肩甲骨1 | [Orthofixar](https://orthofixar.com/special-test/scapulohumeral-rhythm/) |
| 首と頭の分担 | 回旋の約半分は頭のすぐ下（C1-C2）、屈伸の約半分は頭と首の間（C0-C1）。おおむね半々 | [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9316247/) |
| ひじの外反（運搬角） | 男 11.2±4.5度 / 女 12.8±5.4度。腕を下ろすと前腕は外へ開く（体と干渉しない理由） | [SciELO](https://www.scielo.br/j/aob/a/HWsQqR85LYVQb4zQdtvBfRt/?lang=en&format=pdf) |
| 骨盤の左右の傾き | 健康な人の立位でも平均2.2±1.6度。**完全に水平のほうがむしろ不自然**。4度超で「弱った人」に見える | [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10229507/) |
| 骨盤の前後傾 ↔ 腰の反り | ほぼ1:1（11.4度 : 10.8度）。骨盤を前傾させたら同量を背骨で戻す | [PubMed](https://pubmed.ncbi.nlm.nih.gov/8866271/) |
| 力を抜いた指の角度 | 付け根 27/33/29/26度、第2関節 39/41/45/43度、第1関節 14/14/14/16度（示指→小指） | [J Clin Diagn Res 2020](https://jcdr.net/ReadXMLFile.aspx?id=13677) |
| 指のカスケード | 指がそろってまっすぐ・均等に開いた手は、医学的には異常所見（腱損傷の徴候） | [WikiSM](https://wikism.org/Cascade_Sign) |
| 頭の傾き | 5〜15度で柔らかく親しみやすく見える。**15度を超えると不自然**。Unityの標準可動域は±40度 | [Scale Headshots](https://scaleheadshots.com/blog/best-professional-headshot-poses/) / [Unity](https://docs.unity3d.com/Manual/MuscleDefinitions.html) |
| 腕を下ろした角度（実装例） | Animaze の VRM 既定の待機: 上腕をZ軸に70度、前腕をさらに10度 | [Animaze](https://www.animaze.us/manual/vrmavatar/vrmanimations) |
| 可動域の上限 | 肩180度、ひじ150度（伸展0度）、手首70/80度、首45度ほか | [goniometer.io](https://goniometer.io/range-of-motion) |

分かったこと: **待機ポーズの角度の業界標準表は存在しない**。公開されている実装値は Animaze の1件だけ。
VRM の仕様にも関節の制限は一切無いので、可動域の見張りは自前で持つ必要がある。

### 2.3 ポーズの作り方・データの入手

| 方法 | 手間 | 公開リポジトリでのライセンス | 質 |
|---|---|---|---|
| 手で数値を書く（いま） | 中 | 問題なし（自作） | 腕次第。いまの違和感の原因 |
| [web-vrm-poser](https://github.com/k3peta/web-vrm-poser)（MIT）でGUIで作り、数値を書き出す | 小 | 問題なし（自作ポーズ） | 見ながら作れる分、確実に上がる |
| 確認画面にポーズ編集UIを内蔵する | 中 | 問題なし | 実際の描画・カメラのまま詰められる |
| VRMA（モーションデータ）を再生する（[@pixiv/three-vrm-animation](https://www.npmjs.com/package/@pixiv/three-vrm-animation)） | 小〜中 | **データは再配布不可**。VRMと同じくローカル資産にすれば可 | プロが作った動き。質は最も高い |
| CC0のモーション（[Quaternius](https://quaternius.com/packs/universalanimationlibrary.html)）を変換 | 大 | CC0なので同梱可 | ゲーム向けの歩走中心で、用途が合わない |
| 画像・テキストから生成（MediaPipe / text-to-vrma） | 中 | 学習データ由来の権利が濁るものが多い | 下書き止まり |

VRoid公式の無料VRMA（7種）は[BOOTH](https://booth.pm/ja/items/5512385)にあり、商用利用も可だが**抽出できる形での再配布は禁止**。
このリポジトリの「VRM本体はローカル、コードだけ公開」という既存の線引きにそのまま乗る。

## 3. 設計（今回やること）

身振りのデータには「見せたい形」だけを書き、**体の理屈はコード側（`apps/web/src/avatar/posture.ts`）で自動的に足す**。
数値を書く人（＝この先ポーズを足すとき）が気にする量を減らし、どの身振りでも破綻しないようにする。

### 3.1 自動で足す規則

- **可動域の見張り**: 身振りの数値が人体に無い角度になっていたら、上の可動域表で止める（ひじが逆に曲がらない等）
- **肩の連動**: 上腕が体から30度以上離れたら、超えた分の半分を肩へ（上限14度）
- **首と頭の分担**: 身振りには頭の向きだけを書き、その半分を首が担う
- **ひねりの配分**: 体のひねりは胸を主役に、腰には1/4だけ
- **重心の片寄せ**: 数秒ごとに体重を片脚へ移す。体重を乗せた側の骨盤を2.5度上げ、肩のラインを逆へ1.8度傾け、
  遊んでいる脚のひざを曲げ、腰の位置を支えている足の上へ1.2cm寄せる
- **指**: 力を抜いた指の実測値を既定にし、身振りごとに「開く・ふんわり・握る・指差す」を選ぶ（実装済み）

### 3.2 身振りのデータの作り直し

- 左右の腕・肩・頭を**必ず違う角度**にする（2〜3度でも効く）
- 頭は「傾け」と「向き」を組み合わせ、正面のままにしない（傾きは15度まで）
- 腰に手・胸の前で手を合わせる、などの接触するポーズは、**横から見て手が届いているか**を毎回確認する
- 腕は体から少し離して、腕と胴の間に隙間を作る（スカートに潜らせない）
- 気分が姿勢に出るようにする（`sad` は背中を丸めて肩を落とす、など）

### 3.3 確認方法

- 「動きを確認」に**見る向き（正面・斜め・横・後ろ）**を足した。接触と潜り込みは正面だけでは分からない
- 確認は Playwright で時計を止めてコマ送りで撮り、並べて見る（[docs/avatar-motion.md](avatar-motion.md) の 4.7）
