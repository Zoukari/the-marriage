"use client";
import { use, useEffect, useState } from "react";
import { rpc } from "@/lib/supabase";
import { renderCard, renderFullPage, downloadDataUrl, fullName, slug, DOUA_1, DOUA_1_FR, DOUA_2, DOUA_2_FR } from "@/lib/card";
import { formatDate, couple } from "@/lib/message";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Invitation({ params }) {
  const { token } = use(params);
  const [data, setData] = useState(undefined);
  const [img, setImg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    rpc("mariage_get_invitation", { p_token: token })
      .then(async (d) => {
        setData(d);
        if (d) {
          const c = await renderCard(d.settings, d.guest);
          setImg(c.toDataURL("image/png"));
        }
      })
      .catch(() => setData(null));
  }, [token]);

  if (data === undefined) return <div className="loading">Chargement de ton invitation…</div>;
  if (data === null) return <div className="loading">Invitation introuvable.</div>;

  const { guest: g, settings: s } = data;
  const isF = g.gender === "F";

  async function save() {
    setSaving(true);
    try {
      const c = await renderFullPage(s, g);
      const url = c.toDataURL("image/png");
      const name = `invitation-${slug(fullName(g))}.png`;
      // Sur mobile : partage natif (permet "Enregistrer l'image" dans Photos)
      try {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], name, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Invitation" });
          setSaving(false);
          return;
        }
      } catch (e) {
        if (e && e.name === "AbortError") { setSaving(false); return; }
      }
      downloadDataUrl(url, name);
    } catch {}
    setSaving(false);
  }

  return (
    <div className="invite">
      {img ? <img className="cardimg" src={img} alt="Carte d'invitation" /> : <div className="loading" style={{ minHeight: 400 }}>…</div>}
      <div className="info">
        <div className="t">{fullName(g)}</div>
        <p>Tu es {isF ? "invitée" : "invité"} au mariage de</p>
        <p className="serif" style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", margin: "2px 0 10px" }}>{couple(s)}</p>
        <p style={{ color: "var(--ink)", fontWeight: 600 }}>{cap(formatDate(s.event_date))}</p>
        <p style={{ color: "var(--olive)", fontWeight: 600 }}>
          {isF ? "Réception des femmes" : "Réception des hommes"} · {isF ? s.women_time : s.men_time}
        </p>
        {s.venue && <p style={{ color: "var(--ink)" }}>📍 {s.venue}</p>}
        {s.maps_url && (
          <p><a href={s.maps_url} target="_blank" rel="noreferrer" style={{ color: "var(--olive)", fontWeight: 600 }}>Voir l'itinéraire →</a></p>
        )}
        <p className="ar" style={{ fontSize: 22, color: "var(--olive)", margin: "18px 0 4px", lineHeight: 1.7 }}>{DOUA_1}</p>
        <p className="serif" style={{ fontStyle: "italic", fontSize: 17 }}>{DOUA_1_FR}</p>
        <p className="ar" style={{ fontSize: 22, color: "var(--olive)", margin: "14px 0 4px", lineHeight: 1.7 }}>{DOUA_2}</p>
        <p className="serif" style={{ fontStyle: "italic", fontSize: 17 }}>{DOUA_2_FR}</p>
        <p style={{ color: "var(--ink)", fontWeight: 700, marginTop: 18 }}>📲 Présente ce QR code à l'entrée.</p>
        <p style={{ fontSize: 13 }}>Il est personnel et valable pour une seule entrée.</p>
        <button className="btn primary big" style={{ marginTop: 12 }} disabled={!img || saving} onClick={save}>
          {saving ? "…" : "⬇ Enregistrer l'invitation (image)"}
        </button>
      </div>
    </div>
  );
}
