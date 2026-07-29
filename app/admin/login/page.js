"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";

  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "ログインに失敗しました。");
        setLoading(false);
        return;
      }
      // クッキーを反映させるため、フルリロードで遷移する
      window.location.href = next;
    } catch (err) {
      setError("通信エラーが発生しました。");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm space-y-4">
        <div>
          <h1 className="text-lg font-bold">管理画面ログイン</h1>
          <p className="text-xs text-black/50 mt-1">MODANICA 予約管理システム</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 text-red-700 text-sm p-3">{error}</div>
        )}

        <div className="space-y-1">
          <label className="text-xs text-black/60">ユーザー名</label>
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            required
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-black/60">パスワード</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-black text-white text-sm py-2.5 disabled:opacity-50"
        >
          {loading ? "ログイン中…" : "ログイン"}
        </button>
      </form>
    </div>
  );
}
