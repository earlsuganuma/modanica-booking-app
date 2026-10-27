// 管理画面（ブラウザ側）用の画像アップロード補助。
// ・大きい写真は、アップロード前にブラウザ上で縮小する（長辺1600px・JPEG）。
//   スマホ写真などをそのまま送ると、Webサーバー（nginx等）のサイズ制限で、アプリに届く前に拒否されることがあるため。
// ・失敗したときは、理由が分かるエラーメッセージを投げる（画面に表示できるようにする）。

const MAX_SIDE = 1600;
const RESIZE_THRESHOLD = 700 * 1024; // これより大きい、または長辺が大きい場合に縮小する

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした。JPEG・PNG・WebP形式の画像を選んでください。"));
    };
    img.src = url;
  });
}

export async function prepareImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error("JPEG・PNG・WebP形式の画像のみアップロードできます。");
  }
  const img = await loadImage(file);
  const longSide = Math.max(img.naturalWidth, img.naturalHeight);
  if (file.size <= RESIZE_THRESHOLD && longSide <= MAX_SIDE) return file;

  const scale = Math.min(1, MAX_SIDE / longSide);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // 透過PNGをJPEGにしたときに背景が黒くならないように
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) return file;
  return new File([blob], "upload.jpg", { type: "image/jpeg" });
}

// 画像を縮小してアップロードし、保存先のURLを返す。失敗時は理由付きのErrorを投げる。
export async function uploadImage(file, kind, id) {
  const prepared = await prepareImage(file);
  const formData = new FormData();
  formData.append("file", prepared);
  formData.append("kind", kind);
  formData.append("id", id);

  let res;
  try {
    res = await fetch("/api/admin/upload", { method: "POST", body: formData });
  } catch (e) {
    throw new Error("通信に失敗しました。ネットワークをご確認のうえ、もう一度お試しください。");
  }
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // JSON以外の応答（Webサーバーが返したエラーページなど）
  }
  if (!res.ok || !data || !data.url) {
    if (res.status === 413) {
      throw new Error("画像のサイズが大きすぎて送信できませんでした（サーバーの上限）。小さい画像でお試しください。");
    }
    if (res.status === 401) {
      throw new Error("ログインの有効期限が切れています。再度ログインしてください。");
    }
    throw new Error((data && data.message) || `アップロードに失敗しました（エラー ${res.status}）。`);
  }
  return data.url;
}
