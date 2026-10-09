// サイト上部のヒーローバナー（MODANICAロゴ入りの外観写真）。
// 画像ファイルは public/header.jpg に配置する。
// 幅はブラウザ幅の90%（コンテンツ幅 max-w-4xl からはみ出して中央に配置）。
export default function HeroBanner() {
  return (
    <div className="relative left-1/2 -translate-x-1/2 w-[90vw] rounded-2xl overflow-hidden shadow-sm">
      <img
        src="/header.jpg"
        alt="MODANICA"
        className="w-full h-48 sm:h-80 lg:h-[28rem] object-cover object-center"
      />
    </div>
  );
}
