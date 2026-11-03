import { fullName, timesLine } from "./card";
import { formatDate } from "./format";
export { formatDate };

export function couple(s) {
  return s.bride ? `${s.groom} & ${s.bride}` : s.groom;
}

/** Message WhatsApp — sans aucun lien */
export function shareText(s, g) {
  const isF = g.gender === "F";
  const lines = [
    `Assalamou alaykoum *${fullName(g)}* 🤍`,
    ``,
    `Vous êtes ${isF ? "invitée" : "invité"} au mariage de *${couple(s)}* pour le déjeuner, le *${formatDate(s.event_date)}*.`,
    ``,
    `🕐 ${timesLine(s)}`,
  ];
  if (s.venue) lines.push(`📍 ${s.venue}`);
  lines.push(``, `📲 Merci de présenter le QR code à l'entrée.`);
  return lines.join("\n");
}

export const buildMessage = shareText;

export function whatsappTextLink(s, g) {
  const num = `${g.phone_prefix}${g.phone}`.replace(/\D/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(shareText(s, g))}`;
}

export const whatsappLink = whatsappTextLink;
