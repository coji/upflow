#!/bin/sh
# リモートサーバー上で実行: 全DBのアトミックバックアップを作成し tar.gz にまとめる
# Usage: fly ssh console -C /upflow/ops/remote/prepare-pull.sh
set -e

DATA_DIR="/upflow/data"
STAGING_DIR="/tmp/upflow-pull"
OUTPUT="/tmp/upflow-data.tar.gz"

# 前回の残りがあれば削除
rm -rf "$STAGING_DIR" "$OUTPUT"
mkdir -p "$STAGING_DIR"

cd "$DATA_DIR"

# sqlite3 .backup でアトミックにコピー（WAL書き込み中でも一貫性が保証される）
for f in *.db; do
  sqlite3 "$f" ".backup $STAGING_DIR/$f"
done

# Create archive from staging
tar czf "$OUTPUT" -C "$STAGING_DIR" .

rm -rf "$STAGING_DIR"

# Output file list for caller to parse
echo "---FILES---"
ls -1 *.db
echo "---DONE---"
