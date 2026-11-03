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

/** Contenu du QR : le code seul (aucun lien) */
export const qrPayload = (token) => token;

/** QR seul (PNG data URL) */
export async function qrDataUrl(token, size = 1000) {
  return QRCode.toDataURL(qrPayload(token), {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#141414", light: "#ffffff" },
  });
}

export function timesLine(s) {
  return `Hommes : ${s.men_time}  ·  Femmes : ${s.women_time}`;
}

/** Carte : familles en haut, texte d'invitation, 2 ovales (infos + doua), QR en bas */
export async function renderCard(settings, guest) {
  try {
    await Promise.all([
      document.fonts.load(`600 80px ${NAME_FONT}`),
      document.fonts.load(`italic 500 40px ${NAME_FONT}`),
      document.fonts.load("400 40px Amiri"),
      document.fonts.load("600 40px Inter"),
    ]);
  } catch {}
  const bg = await loadImage(settings.card_bg || "/card.jpg");
  const W = bg.naturalWidth;
  const H = bg.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.drawImage(bg, 0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const fit = (text, cx, cy, size, maxW, font, color) => {
    let fs = Math.round(size);
    ctx.font = font(fs);
    while (ctx.measureText(text).width > maxW && fs > 14) {
      fs -= 2;
      ctx.font = font(fs);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, cx, cy);
    return fs;
  };
  const serif = (w) => (fs) => `${w} ${fs}px ${NAME_FONT}`;

  // 1. Les deux familles
  const cw = ((settings.couple_w ?? 70) / 100) * W;
  const cs = ((settings.couple_size ?? 9.5) / 100) * W;
  const brideY = ((settings.bride_y ?? 26.2) / 100) * H;
  if (settings.groom)
    fit(settings.groom, W / 2, ((settings.groom_y ?? 8.9) / 100) * H, cs, cw, serif(600), settings.groom_color || "#4b5634");
  if (settings.bride) fit(settings.bride, W / 2, brideY, cs, cw, serif(600), settings.bride_color || "#b3a06a");

  // Géométrie des ovales
  const px = (settings.name_x / 100) * W;
  const pw = (settings.name_w / 100) * W;
  const ph = H * 0.108;
  const p1y = (settings.name_y / 100) * H; // centre ovale 1
  const p2y = p1y + ph + H * 0.018; // centre ovale 2

  // 2. Texte d'invitation entre les familles et les ovales
  const tY = (brideY + cs * 0.45 + (p1y - ph / 2)) / 2;
  const tfs = W * 0.043;
  const tcol = "#5a5f4a";
  fit("vous invitent au déjeuner de mariage", W / 2, tY - tfs * 0.62, tfs, W * 0.84, serif("italic 500"), tcol);
  fit("de leurs enfants", W / 2, tY + tfs * 0.62, tfs, W * 0.84, serif("italic 500"), tcol);

  // 3. Les deux ovales
  const pill = (cy, fill) => {
    ctx.save();
    ctx.shadowColor = "rgba(60,50,20,.22)";
    ctx.shadowBlur = W * 0.02;
    ctx.shadowOffsetY = W * 0.006;
    ctx.fillStyle = fill;
    roundRect(ctx, px - pw / 2, cy - ph / 2, pw, ph, ph / 2);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = W * 0.0075;
    ctx.strokeStyle = "#7c7c78";
    roundRect(ctx, px - pw / 2, cy - ph / 2, pw, ph, ph / 2);
    ctx.stroke();
  };
  pill(p1y, "#e4e1ce");
  pill(p2y, "#faf8f2");

  const infoCol = settings.name_color || "#3f4a2f";
  const lines = [];
  if (settings.venue) lines.push([settings.venue, 700]);
  lines.push([cap(formatDate(settings.event_date)), 600]);
  lines.push([timesLine(settings), 600]);
  const ifs = W * (lines.length > 2 ? 0.033 : 0.038);
  const ilh = ifs * 1.25;
  lines.forEach(([t, w], i) => fit(t, px, p1y + (i - (lines.length - 1) / 2) * ilh, ifs, pw * 0.82, serif(w), infoCol));

  // Doua dans l'ovale 2 (2 lignes, de droite à gauche)
  ctx.direction = "rtl";
  const afs = W * 0.04;
  ctx.font = `400 ${afs}px Amiri, serif`;
  const parts = DOUA_1.split("، ");
  const dl = parts.length === 2 ? [parts[0] + "،", parts[1]] : [DOUA_1];
  dl.forEach((t, i) => fit(t, px, p2y + (i - (dl.length - 1) / 2) * afs * 1.45, afs, pw * 0.84, (fs) => `400 ${fs}px Amiri, serif`, "#1e1e1e"));
  ctx.direction = "ltr";

  // 4. QR tout en bas
  const size = Math.round((settings.qr_size / 100) * W);
  const x = Math.round((settings.qr_x / 100) * W);
  const y = Math.round((settings.qr_y / 100) * H);
  fit("PRÉSENTEZ CE QR CODE À L'ENTRÉE", W / 2, y - W * 0.03, W * 0.024, W * 0.8, (fs) => `700 ${fs}px Inter, sans-serif`, "#4b5634");
  const r = size * 0.06;
  ctx.save();
  ctx.shadowColor = "rgba(60,50,20,.25)";
  ctx.shadowBlur = size * 0.04;
  ctx.shadowOffsetY = size * 0.012;
  ctx.fillStyle = "#c9bc93";
  roundRect(ctx, x, y, size, size, r);
  ctx.fill();
  ctx.restore();
  const pad = Math.round(size * 0.035);
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, qrPayload(guest.token), {
    width: size - pad * 2,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#141414", light: "#c9bc93" },
  });
  ctx.drawImage(qrCanvas, x + pad, y + pad, size - pad * 2, size - pad * 2);
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const DOUA_1 = "اللَّهُمَّ اجْعَلْ زَوَاجَهُمَا مَوَدَّةً وَرَحْمَةً وَسَكِينَةً، وَارْزُقْهُمَا سَعَادَةً لَا تَزُولُ";
export const DOUA_1_FR = "Ô Allah, fais de leur union une source d'affection, de miséricorde et de sérénité, et accorde-leur un bonheur qui ne s'éteint jamais.";
export const DOUA_2 = "بَارَكَ اللَّهُ لَهُمَا، وَبَارَكَ عَلَيْهِمَا، وَجَمَعَ بَيْنَهُمَا فِي خَيْرٍ";
export const DOUA_2_FR = "Qu'Allah les bénisse, répande Sa bénédiction sur eux et les unisse dans le bien.";

function wrapLines(ctx, text, maxW) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Page complète en image : carte + toutes les infos en dessous */
export async function renderFullPage(settings, guest) {
  const card = await renderCard(settings, guest);
  try {
    await Promise.all([
      document.fonts.load('400 40px Amiri'),
      document.fonts.load('600 40px Inter'),
      document.fonts.load('400 40px Inter'),
      document.fonts.load(`italic 500 40px ${NAME_FONT}`),
    ]);
  } catch {}
  const W = card.width;
  const M = W * 0.08;
  const maxW = W - M * 2;
  const isF = guest.gender === "F";
  const INTER = "Inter, system-ui, sans-serif";
  const AR = "Amiri, serif";
  const olive = "#4b5634", ink = "#2c3124", muted = "#7b7f70", gold = "#a8935a";

  // Blocs : [texte, font, couleur, interligne, espace avant, rtl]
  const blocks = [
    [fullName(guest), `600 ${W * 0.06}px ${NAME_FONT}`, olive, 1.15, 0],
    [`Vous êtes ${isF ? "invitée" : "invité"} au déjeuner de mariage de`, `400 ${W * 0.03}px ${INTER}`, muted, 1.3, W * 0.02],
    [settings.bride ? `${settings.groom} & ${settings.bride}` : settings.groom, `700 ${W * 0.045}px ${NAME_FONT}`, ink, 1.2, W * 0.005],
    [cap(formatDate(settings.event_date)), `600 ${W * 0.034}px ${INTER}`, ink, 1.3, W * 0.03],
    [timesLine(settings), `600 ${W * 0.034}px ${INTER}`, olive, 1.3, W * 0.008],
  ];
  if (settings.venue) blocks.push([`Lieu : ${settings.venue}`, `400 ${W * 0.03}px ${INTER}`, ink, 1.3, W * 0.012]);
  blocks.push(
    [DOUA_1, `400 ${W * 0.042}px ${AR}`, olive, 1.55, W * 0.045, true],
    [DOUA_1_FR, `italic 500 ${W * 0.03}px ${NAME_FONT}`, muted, 1.3, W * 0.01],
    [DOUA_2, `400 ${W * 0.042}px ${AR}`, olive, 1.55, W * 0.03, true],
    [DOUA_2_FR, `italic 500 ${W * 0.03}px ${NAME_FONT}`, muted, 1.3, W * 0.01],
    ["Merci de présenter ce QR code à l'entrée.", `700 ${W * 0.036}px ${INTER}`, gold, 1.3, W * 0.045],
    ["Il est personnel et valable pour une seule entrée.", `400 ${W * 0.026}px ${INTER}`, muted, 1.3, W * 0.006]
  );

  const m = document.createElement("canvas").getContext("2d");
  const laid = blocks.map(([t, font, color, lh, before, rtl]) => {
    m.font = font;
    const px = parseFloat(font.match(/([\d.]+)px/)[1]);
    return { lines: wrapLines(m, t, maxW), font, color, lh: px * lh, before, rtl };
  });
  const top = W * 0.07;
  let h = top;
  laid.forEach((b) => (h += b.before + b.lines.length * b.lh));
  h += W * 0.08;

  const c = document.createElement("canvas");
  c.width = W;
  c.height = card.height + h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f6f3ea";
  ctx.fillRect(0, 0, W, c.height);
  ctx.drawImage(card, 0, 0);
  // filet doré
  ctx.fillStyle = "#c9bc93";
  ctx.fillRect(W * 0.35, card.height + W * 0.03, W * 0.3, 3);

  let y = card.height + top;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  laid.forEach((b) => {
    y += b.before;
    ctx.font = b.font;
    ctx.fillStyle = b.color;
    ctx.direction = b.rtl ? "rtl" : "ltr";
    b.lines.forEach((l) => {
      ctx.fillText(l, W / 2, y + b.lh / 2);
      y += b.lh;
    });
  });
  ctx.direction = "ltr";
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
