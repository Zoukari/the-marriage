import QRCode from "qrcode";
import { formatDate } from "./format";

export const NAME_FONT = '"Cormorant Garamond", Georgia, serif';

export function inviteUrl(token) {
  return `${window.location.origin}/i/${token}`;
}

export function fullName(g) {
  return `${g.first_name} ${g.last_name || ""}`.trim();
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/** QR seul (PNG data URL) */
export async function qrDataUrl(token, size = 1000) {
  return QRCode.toDataURL(inviteUrl(token), {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#141414", light: "#ffffff" },
  });
}

/** Carte complète : fond + QR + nom, retourne un canvas */
export async function renderCard(settings, guest) {
  try {
    await document.fonts.load(`600 80px ${NAME_FONT}`);
  } catch {}
  const bg = await loadImage(settings.card_bg || "/card.jpg");
  const W = bg.naturalWidth;
  const H = bg.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.drawImage(bg, 0, 0, W, H);

  // QR : posé sur la zone dorée du design
  const size = Math.round((settings.qr_size / 100) * W);
  const x = Math.round((settings.qr_x / 100) * W);
  const y = Math.round((settings.qr_y / 100) * H);
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, inviteUrl(guest.token), {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#141414", light: "#c9bc93" },
  });
  ctx.drawImage(qrCanvas, x, y, size, size);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Écrit une ligne centrée, réduite si trop large
  const fit = (text, cx, cy, size, maxW, weight, color) => {
    let fs = Math.round(size);
    ctx.font = `${weight} ${fs}px ${NAME_FONT}`;
    while (ctx.measureText(text).width > maxW && fs > 14) {
      fs -= 2;
      ctx.font = `${weight} ${fs}px ${NAME_FONT}`;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, cx, cy);
  };

  // Noms des mariés (à la place des XXXXXX)
  const cw = ((settings.couple_w ?? 70) / 100) * W;
  const cs = ((settings.couple_size ?? 9.5) / 100) * W;
  if (settings.groom)
    fit(settings.groom, W / 2, ((settings.groom_y ?? 8.9) / 100) * H, cs, cw, 600, settings.groom_color || "#4b5634");
  if (settings.bride)
    fit(settings.bride, W / 2, ((settings.bride_y ?? 26.2) / 100) * H, cs, cw, 600, settings.bride_color || "#b3a06a");

  // Ovale : lieu, date, heure
  const isF = guest.gender === "F";
  const lines = [];
  if (settings.venue) lines.push([settings.venue, 700]);
  lines.push([cap(formatDate(settings.event_date)), 600]);
  lines.push([`${isF ? "Femmes" : "Hommes"} · ${isF ? settings.women_time : settings.men_time}`, 600]);
  const fs = W * 0.036;
  const lh = fs * 1.22;
  const ix = (settings.name_x / 100) * W;
  const iy = (settings.name_y / 100) * H;
  const iw = (settings.name_w / 100) * W;
  lines.forEach(([t, w], i) => {
    fit(t, ix, iy + (i - (lines.length - 1) / 2) * lh, fs, iw, w, settings.name_color || "#3f4a2f");
  });
  return c;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function slug(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** Compresse une image uploadée en JPEG (data URL) */
export async function compressImage(file, maxW = 1240) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  const scale = Math.min(1, maxW / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c.toDataURL("image/jpeg", 0.86);
}
