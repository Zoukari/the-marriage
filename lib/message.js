import { fullName, inviteUrl } from "./card";
import { formatDate } from "./format";
export { formatDate };

export function couple(s) {
  return s.bride ? `${s.groom} & ${s.bride}` : s.groom;
}

export function buildMessage(s, g) {
  const isF = g.gender === "F";
  const time = isF ? s.women_time : s.men_time;
  const lines = [
    `Assalamou alaykoum *${fullName(g)}* 🤍`,
    ``,
    `C'est avec une immense joie que tu es ${isF ? "invitée" : "invité"} au mariage de *${couple(s)}*, le *${formatDate(s.event_date)}* à *${time}*${isF ? " (réception des femmes)" : " (réception des hommes)"}.`,
  ];
  if (s.venue) lines.push(``, `📍 ${s.venue}`);
  if (s.maps_url) lines.push(s.maps_url);
  lines.push(
    ``,
    `اللَّهُمَّ اجْعَلْ زَوَاجَهُمَا مَوَدَّةً وَرَحْمَةً وَسَكِينَةً، وَارْزُقْهُمَا سَعَادَةً لَا تَزُولُ`,
    `_Ô Allah, fais de leur union une source d'affection, de miséricorde et de sérénité, et accorde-leur un bonheur qui ne s'éteint jamais._`,
    ``,
    `بَارَكَ اللَّهُ لَهُمَا، وَبَارَكَ عَلَيْهِمَا، وَجَمَعَ بَيْنَهُمَا فِي خَيْرٍ`,
    ``,
    `🎟️ Ta carte d'invitation personnelle :`,
    inviteUrl(g.token),
    ``,
    `📲 *Merci de présenter ce QR code à l'entrée.* Il est personnel et valable pour une seule entrée.`,
    ``,
    `Ta présence sera notre plus beau cadeau. 🤍`
  );
  return lines.join("\n");
}

export function whatsappLink(s, g) {
  const num = `${g.phone_prefix}${g.phone}`.replace(/\D/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(buildMessage(s, g))}`;
}
