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
  const bg = await loadImage(settings.card_bg || "/carte-v4.jpg");
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

  // Texte d'invitation (« تتشرف » → ont l'honneur de vous inviter)
  // Positions figées sur le template (1240×1748) : ovale vide et cadre SCAN ME
  const px = W * 0.5145;
  const pw = W * 0.6;
  const p1y = H * 0.4153;
  const pInnerH = H * 0.0984;
  const tfs = W * 0.031;
  fit("ont l'honneur de vous inviter", W / 2, H * 0.318, tfs, W * 0.86, serif("italic 600"), "#5a5f4a");
  fit("au déjeuner de mariage de leurs enfants", W / 2, H * 0.343, tfs, W * 0.86, serif("italic 600"), "#5a5f4a");

  // Infos dans l'ovale : Date / Lieu / Heure avec icônes
  const GOLD = "#a8822f";
  const INK = settings.name_color || "#2f3524";
  const rows = [
    [iconCalendar, "Date :", cap(formatDate(settings.event_date))],
  ];
  if (settings.venue) rows.push([iconPin, "Lieu :", settings.venue]);
  rows.push([iconClock, "Heure :", `Hommes ${settings.men_time} · Femmes ${settings.women_time}`]);
  let ifs = W * (rows.length > 2 ? 0.028 : 0.032);
  const rowW = (fs) => {
    let m = 0;
    rows.forEach(([, l, v]) => {
      ctx.font = `700 ${fs}px ${NAME_FONT}`;
      const lw = ctx.measureText(l + " ").width;
      ctx.font = `600 ${fs}px ${NAME_FONT}`;
      m = Math.max(m, fs * 1.5 + lw + ctx.measureText(v).width);
    });
    return m;
  };
  while ((rowW(ifs) > pw || ifs * 1.38 * rows.length > pInnerH * 0.92) && ifs > 14) ifs -= 1;
  const ilh = ifs * 1.38;
  const blockW = rowW(ifs);
  const left = px - blockW / 2;
  ctx.textAlign = "left";
  rows.forEach(([icon, label, value], i) => {
    const cy = p1y + (i - (rows.length - 1) / 2) * ilh;
    icon(ctx, left + ifs * 0.55, cy, ifs * 1.05, GOLD);
    let xx = left + ifs * 1.5;
    ctx.font = `700 ${ifs}px ${NAME_FONT}`;
    ctx.fillStyle = GOLD;
    ctx.fillText(label + " ", xx, cy);
    xx += ctx.measureText(label + " ").width;
    ctx.font = `600 ${ifs}px ${NAME_FONT}`;
    ctx.fillStyle = INK;
    ctx.fillText(value, xx, cy);
  });
  ctx.textAlign = "center";

  // QR dans le cadre SCAN ME
  const size = Math.round(W * 0.36);
  const x = Math.round(W * 0.5161 - size / 2);
  const y = Math.round(H * 0.6395);
  const r = size * 0.06;
  ctx.save();
  ctx.shadowColor = "rgba(60,50,20,.22)";
  ctx.shadowBlur = size * 0.035;
  ctx.shadowOffsetY = size * 0.01;
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

  // Sous le cadre SCAN ME : consignes + interdictions
  const n = Math.max(1, Number(guest.entries) || 1);
  const cx = W / 2;
  const by0 = H * 0.9325, by1 = H * 0.995;
  ctx.save();
  ctx.fillStyle = "rgba(255,253,247,.88)";
  roundRect(ctx, W * 0.1, by0, W * 0.8, by1 - by0, W * 0.025);
  ctx.fill();
  ctx.restore();
  const l1 = by0 + (by1 - by0) * 0.27;
  const l2 = by0 + (by1 - by0) * 0.72;
  const fs1 = W * 0.021;
  // Ligne 1 : présenter + validité
  const t1 = "Merci de présenter ce QR code à l'entrée  ·  ";
  const t2 = n > 1 ? `Valable pour ${n} entrées` : "Valable pour une seule entrée";
  let f1 = fs1;
  const w1 = () => { ctx.font = `700 ${f1}px Inter, sans-serif`; return ctx.measureText(t1 + t2).width; };
  while (w1() > W * 0.76 && f1 > 12) f1 -= 1;
  let lx = cx - w1() / 2;
  ctx.textAlign = "left";
  ctx.font = `700 ${f1}px Inter, sans-serif`;
  ctx.fillStyle = "#2f3524";
  ctx.fillText(t1, lx, l1);
  lx += ctx.measureText(t1).width;
  ctx.fillStyle = GOLD;
  ctx.fillText(t2, lx, l1);
  // Ligne 2 : interdictions côte à côte
  const ic = W * 0.042;
  const items = [[iconNoPhoto, "Photos interdites"], [iconNoKids, "Enfants non admis"]];
  ctx.font = `700 ${f1 * 1.05}px Inter, sans-serif`;
  const gapI = W * 0.06;
  const ws = items.map(([, t]) => ic + W * 0.012 + ctx.measureText(t).width);
  let ix = cx - (ws[0] + gapI + ws[1]) / 2;
  items.forEach(([icon, t], i) => {
    icon(ctx, ix + ic / 2, l2, ic);
    ctx.font = `700 ${f1 * 1.05}px Inter, sans-serif`;
    ctx.fillStyle = "#2f3524";
    ctx.fillText(t, ix + ic + W * 0.012, l2);
    ix += ws[i] + gapI;
  });
  ctx.textAlign = "center";
  return c;
}

/* ---------- Icônes vectorielles ---------- */
function iconCalendar(ctx, cx, cy, s, col) {
  const w = s * 0.86, h = s * 0.8, x = cx - w / 2, y = cy - h / 2 + s * 0.05;
  ctx.save();
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = s * 0.09;
  roundRect(ctx, x, y, w, h, s * 0.1); ctx.stroke();
  ctx.fillRect(x, y, w, h * 0.27);
  ctx.lineCap = "round";
  [0.3, 0.7].forEach((k) => { ctx.beginPath(); ctx.moveTo(x + w * k, y - s * 0.12); ctx.lineTo(x + w * k, y + s * 0.08); ctx.stroke(); });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ctx.fillRect(x + w * (0.2 + i * 0.24), y + h * (0.45 + j * 0.25), w * 0.13, h * 0.13);
  ctx.restore();
}
function iconPin(ctx, cx, cy, s, col) {
  const r = s * 0.33, top = cy - s * 0.12;
  ctx.save();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx, top, r, Math.PI * 0.85, Math.PI * 0.15);
  ctx.lineTo(cx, cy + s * 0.48);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#fffaf0";
  ctx.beginPath(); ctx.arc(cx, top, r * 0.42, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function iconClock(ctx, cx, cy, s, col) {
  const r = s * 0.42;
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = s * 0.09; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - r * 0.6); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.45, cy + r * 0.2); ctx.stroke();
  ctx.restore();
}
function forbid(ctx, cx, cy, s, draw) {
  const r = s / 2;
  ctx.save();
  ctx.fillStyle = "#fff8e8";
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  draw();
  ctx.strokeStyle = "#e0a21b"; ctx.lineWidth = s * 0.1;
  ctx.beginPath(); ctx.arc(cx, cy, r - s * 0.05, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - r * 0.66, cy - r * 0.66); ctx.lineTo(cx + r * 0.66, cy + r * 0.66); ctx.stroke();
  ctx.restore();
}
function iconNoPhoto(ctx, cx, cy, s) {
  forbid(ctx, cx, cy, s, () => {
    const w = s * 0.5, h = s * 0.34;
    ctx.fillStyle = "#141414";
    roundRect(ctx, cx - w / 2, cy - h / 2 + s * 0.03, w, h, s * 0.05); ctx.fill();
    ctx.fillRect(cx - w * 0.18, cy - h / 2 - s * 0.03, w * 0.36, s * 0.08);
    ctx.fillStyle = "#fff8e8";
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.03, s * 0.1, 0, Math.PI * 2); ctx.fill();
  });
}
function iconNoKids(ctx, cx, cy, s) {
  forbid(ctx, cx, cy, s, () => {
    ctx.fillStyle = "#141414";
    [[-0.12, 1], [0.12, 0.85]].forEach(([dx, k]) => {
      const x0 = cx + dx * s, hs = s * 0.09 * k;
      ctx.beginPath(); ctx.arc(x0, cy - s * 0.14 * k, hs, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x0, cy - s * 0.05 * k);
      ctx.lineTo(x0 - s * 0.1 * k, cy + s * 0.18);
      ctx.lineTo(x0 + s * 0.1 * k, cy + s * 0.18);
      ctx.closePath(); ctx.fill();
    });
  });
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
