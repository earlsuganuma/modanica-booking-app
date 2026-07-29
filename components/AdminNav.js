"use client";

const links = [
  { href: "/admin", label: "ダッシュボード" },
  { href: "/admin/reservations", label: "予約一覧" },
  { href: "/admin/reservations/calendar", label: "予約カレンダー" },
  { href: "/admin/reports", label: "売上レポート" },
  { href: "/admin/plans", label: "プラン詳細編集" },
  { href: "/admin/calendar", label: "料金設定" },
  { href: "/admin/options", label: "オプション管理" },
  { href: "/admin/mail-log", label: "メール送信ログ" },
];

export default function AdminNav() {
  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="flex flex-wrap gap-2 text-xs mb-6 items-center">
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          className="rounded-full border border-black/15 px-3 py-1.5 hover:bg-black/5"
        >
          {l.label}
        </a>
      ))}
      <button
        onClick={handleLogout}
        className="ml-auto rounded-full border border-black/15 px-3 py-1.5 hover:bg-black/5 text-black/50"
      >
        ログアウト
      </button>
    </div>
  );
}
