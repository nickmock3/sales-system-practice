# VS Code と C# Dev Kit メモ

## `System.Object` が見つからないエラー

`Program.cs` などで以下のようなエラーが出ることがある。

```text
定義済みの型 'System.Object' は定義、またはインポートされていません
```

これはコードの問題ではなく、VS Code の C# language server が適切な .NET SDK や reference assemblies を見つけられていない時に起きやすい。

今回の原因は、ターミナルでは .NET 10 を見ていたが、VS Code が拾いやすい `dotnet` が .NET 9 を指していたこと。

`net10.0` のプロジェクトを .NET 9 SDK で解析しようとすると、基本型の解決に失敗することがある。

## 確認コマンド

```sh
which dotnet
dotnet --version
dotnet --list-sdks
dotnet --info
```

このリポジトリでは以下が見えていればよい。

```text
10.0.300
```

## 対応したこと

- `/opt/homebrew/bin/dotnet` が `.NET 10` を指すようにした
- `global.json` で SDK `10.0.300` を明示した
- `dotnet build` が成功することを確認した

## VS Code 側での再読み込み

SDK の参照先を直した後は、VS Code 側の language server を再起動する。

手順:

1. VS Code を完全に終了する
2. VS Code を再起動する
3. コマンドパレットで `Developer: Reload Window` を実行する
4. まだ残る場合は `C#: Restart Language Server` または `C# Dev Kit: Restart Language Server` を実行する

## CLI と VS Code の違い

`dotnet build` はターミナルの環境変数や PATH を使う。

一方、VS Code を Dock や Finder から起動した場合、シェルの設定を完全には引き継がないことがある。そのため、ターミナルではビルドできるのに VS Code 上ではエラーが出ることがある。

この差を小さくするため、このリポジトリでは `global.json` で SDK バージョンを固定する。
