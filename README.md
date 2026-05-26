# Photo Paddock

競馬ラボ「馬体FOCUS」と競馬ブック旧アーカイブのフォトパドックを、馬ごと・生年ごとに見るためのローカル閲覧ツールです。

## 使い方

競馬ラボを取り込みます。

```sh
npm run import:keibalab -- --latest 726 --oldest 705 --download-images
```

競馬ブック旧アーカイブを1号分取り込みます。

```sh
npm run import:keibabook -- --issue 180813 --download-images
```

更新は、取得済みの競馬ラボ最大IDから最新IDまでを追加します。

```sh
npm run update -- --latest 726 --download-images
```

データ整合性を確認します。

```sh
npm run audit:data
```

閲覧画面を起動します。

```sh
npm run serve
```

その後、表示された `Photo Paddock: http://127.0.0.1:....` のURLを開きます。標準は `4173` 番ですが、埋まっている場合は次の空きポートを使います。

## データ

- `data/photo-paddock.json`: 馬、写真、取り込みページ、取り込みエラー
- `data/images/`: 画像キャッシュ

公開サイト化や画像再配布ではなく、個人利用のローカル閲覧を前提にしています。元ページURLと画像URLはデータに残します。

## 拡張計画

小さい単位で遡って取り込み、各バッチ後に監査します。詳細は [docs/data-expansion-plan.md](docs/data-expansion-plan.md) を参照してください。
