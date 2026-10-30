import { fullName, inviteUrl } from "./card";
import { formatDate } from "./format";
export { formatDate };

export function couple(s) {
  return s.bride ? `${s.groom} & ${s.bride}` : s.groom;
}

export function buildMessage(s, g) {
  const isF = g.gender === "F";
  return [
    `Assalamou alaykoum *${fullName(g)}* 🤍`,
    ``,
    `Tu es ${isF ? "invitée" : "invité"} au mariage de *${couple(s)}*.`,
    ``,
    `🎟️ Ton invitation :`,
    inviteUrl(g.token),
  ].join("\n");
}

export function whatsappLink(s, g) {
  const num = `${g.phone_prefix}${g.phone}`.replace(/\D/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(buildMessage(s, g))}`;
}
