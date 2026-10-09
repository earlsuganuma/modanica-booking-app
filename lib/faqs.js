// よくある質問（Q&A）。plans等の全件入れ替え方式の load()/save()（lib/store.js）とは独立して、
// faqsテーブルだけを単独で読み書きする（Q&Aの更新が予約データの全件書き換えに影響しないようにするため）。
const { query, withTransaction } = require("./db");

const CATEGORIES = ["facility", "cafe"];

// テーブル未作成（マイグレーション前）などでエラーになっても、ページ自体は表示できるよう空配列を返す。
async function listFaqs(category) {
  try {
    const res = await query(
      "SELECT id, category, question, answer, sort_order FROM faqs WHERE category = $1 ORDER BY sort_order, id",
      [category]
    );
    return res.rows.map((r) => ({ id: r.id, category: r.category, question: r.question, answer: r.answer }));
  } catch (e) {
    console.error("listFaqs failed:", e.message);
    return [];
  }
}

async function replaceFaqs(category, items) {
  await withTransaction(async (client) => {
    await client.query("DELETE FROM faqs WHERE category = $1", [category]);
    for (let i = 0; i < items.length; i++) {
      await client.query(
        "INSERT INTO faqs (category, question, answer, sort_order) VALUES ($1,$2,$3,$4)",
        [category, items[i].question, items[i].answer, i + 1]
      );
    }
  });
}

module.exports = { CATEGORIES, listFaqs, replaceFaqs };
