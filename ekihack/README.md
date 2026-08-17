# ekihack

## download.ps1
駅メモの既知のでんこ・ラッピングを全てダウンロードするスクリプトです。  

### 動作要件
- 実行ポリシーでスクリプトの実行がブロックされないこと
    - PowerShell には**実行ポリシー**という概念があり、不正なコードを含むスクリプトの実行を防止するため、PowerShellスクリプトの実行を拒否することでコンピュータのセキュリティを高めています。`download.ps1`はPowerShellで記述されたスクリプトですので、ポリシーによって実行が拒否される場合があります。
    - 実行ポリシーを変更するには次のコマンドを実行します。
        ```
        Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
        ```

### How to use
PowerShellで以下のように実行します。
```
iwr https://raw.githubusercontent.com/sweshelo/ekihack/master/download.ps1 | iex
```

### FAQ

- Q. 「Search」というボックスは何ですか  
A. 検索対象になるでんこの**英名**を入力し「search」を押すと、該当のでんこが存在するかチェックが掛かります。ヒットした場合は、検索欄に入力されているでんこのみフィルターされてダウンロードします。検索欄内を削除するとこのフィルターは解除されます。  

- Q. 追加してほしいコラボでんこがあります  
A. [issue](https://github.com/sweshelo/ekihack/issues/new) を立てるか作者のTwitterにご連絡ください。

### 免責事項
このスクリプトを用いることで一部非公開データにアクセスできる可能性があります。  
なお、ダウンロードされるファイルはサーバ上に配置されアクセス制限が掛けられていない状態のため、利用規約や法令等に違反する動作は行っておりません。

## ekihack.js
駅メモ! Our Railsで利用できる自動チェックインツールです。  
このスクリプトは[IKS.gadget](https://github.com/iks-org/IKS.gadget)へ移管しました。  
