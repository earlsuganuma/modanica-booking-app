// サイト上部のヒーローバナー（MODANICAロゴ入りの外観写真）。
// 画像ファイルは public/header.jpg に配置する。
export default function HeroBanner() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-sm">
      <img
        src="/header.jpg"
        alt="MODANICA"
        className="w-full h-48 sm:h-72 object-cover object-center"
      />
    </div>
  );
}
