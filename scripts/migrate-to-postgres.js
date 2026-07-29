// 旧JSONファイル（modanica-data/data.json）のデータを、新しいPostgreSQLに一度だけ移行するスクリプト。
//
// 使い方:
//   npm run migrate
// （MODANICA_OLD_DATA_DIR で旧データの場所を変更可能。既定は ~/modanica-data）
//
// DATABASE_URL は .env.local から読み込まれます（先に schema.sql を流し込んでおくこと）。

const fs = require("fs");
const path = require("path");
const os = require("os");
const { save, exists } = require("../lib/store");

const OLD_DATA_DIR = process.env.MODANICA_OLD_DATA_DIR || path.join(os.homedir(), "modanica-data");
const OLD_DATA_PATH = path.join(OLD_DATA_DIR, "data.json");

async function main() {
  if (!fs.existsSync(OLD_DATA_PATH)) {
    console.error(`移行元のファイルが見つかりません: ${OLD_DATA_PATH}`);
    console.error("MODANICA_OLD_DATA_DIR で場所を指定できます。");
    process.exit(1);
  }

  if (await exists()) {
    console.error(
      "PostgreSQL側に既にデータがあります。誤って上書きしないよう、このスクリプトは停止します。\n" +
        "作り直したい場合は、先にDB側のテーブルを空にしてから実行してください。"
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(OLD_DATA_PATH, "utf-8");
  const data = JSON.parse(raw);

  console.log("移行元データ:");
  console.log("  plans:", (data.plans || []).length);
  console.log("  resources:", (data.resources || []).length);
  console.log("  options:", (data.options || []).length);
  console.log("  reservations:", (data.reservations || []).length);
  console.log("  priceRules:", (data.priceRules || []).length);
  console.log("  mailLog:", (data.mailLog || []).length);

  await save(data);

  console.log("移行完了。");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
