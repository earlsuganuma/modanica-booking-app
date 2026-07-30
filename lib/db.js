// PostgreSQL接続プール。
// 接続情報は環境変数 DATABASE_URL（例: postgres://modanica:xxxx@127.0.0.1:5432/modanica）で指定する。
// .env.local に設定してください（.env.local.example 参照）。
const { Pool } = require("pg");

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL が設定されていません。.env.local に DATABASE_URL=postgres://user:pass@host:5432/dbname を設定してください。"
      );
    }
    pool = new Pool({ connectionString });
    // start_datetime/end_datetime（TIMESTAMPTZ）は「タイムゾーンなしの壁時計時刻を
    // そのまま文字列として保存・復元する」設計だが、これはPostgresセッションの
    // TimeZone設定がUTCであることが前提になっている（そうでないと、naive文字列の
    // INSERT時・SELECT時にそれぞれサーバのTimeZone設定でUTC変換され、往復のたびに
    // ズレが蓄積してしまう）。接続ごとに明示的にUTCへ固定し、この前提を保証する。
    pool.on("connect", (client) => {
      client.query("SET TIME ZONE 'UTC'").catch(() => {});
    });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, withTransaction, getPool };
