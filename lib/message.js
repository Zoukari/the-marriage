import { fullName, timesLine } from "./card";
import { formatDate } from "./format";
export { formatDate };

export function couple(s) {
  return s.bride ? `${s.groom} & ${s.bride}` : s.groom;
}

/** Message WhatsApp — sans lien et sans emoji (les emojis s'affichent en « � » sur certains téléphones) */
export function shareText(s, g) {
  const n = Math.max(1, Number(g.entries) || 1);
  const lines = [
    `Assalamou alaykoum *${fullName(g)}*`,
    ``,
    `*${couple(s)}* ont l'honneur de vous inviter au déjeuner de mariage de leurs enfants.`,
    ``,
    `*Date :* ${formatDate(s.event_date)}`,
  ];
  if (s.venue) lines.push(`*Lieu :* ${s.venue}`);
  lines.push(
    `*Heure :* Hommes ${s.men_time} - Femmes ${s.women_time}`,
    ``,
    `Merci de présenter le QR code à l'entrée.`,
    n > 1 ? `Valable pour ${n} entrées.` : `Valable pour une seule entrée.`,
    `Photos interdites.`,
    `Enfants non admis.`,
    ``,
    `Votre présence nous honore et complète notre joie.`
  );
  return lines.join("\n");
}

export const buildMessage = shareText;

export function whatsappTextLink(s, g) {
  const num = `${g.phone_prefix}${g.phone}`.replace(/\D/g, "");
  return `https://api.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(shareText(s, g))}`;
}

export const whatsappLink = whatsappTextLink;
