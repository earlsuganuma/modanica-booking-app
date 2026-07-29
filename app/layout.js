import "./globals.css";

export const metadata = {
  title: "MODANICA ご予約",
  description: "MODANICA カフェ・宿泊・BBQ 予約",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>
        <header className="border-b border-black/10 bg-white/70 backdrop-blur">
          <div className="mx-auto max-w-4xl px-4 py-4 flex items-center justify-between">
            <a href="/" className="font-bold tracking-wide text-ink">
              MODANICA <span className="font-normal text-sm text-black/50">ご予約</span>
            </a>
            <nav className="flex gap-4 text-sm">
              <a href="/plans/facility" className="hover:underline">施設利用</a>
              <a href="/plans/cafe" className="hover:underline">カフェ</a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-4xl px-4 py-10 text-xs text-black/40">
          MODANICA 予約管理システム（開発版プロトタイプ）
        </footer>
      </body>
    </html>
  );
}
