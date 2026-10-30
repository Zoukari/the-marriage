"use client";
import { use, useEffect, useState } from "react";
import { rpc } from "@/lib/supabase";
import { renderCard, downloadDataUrl, fullName, slug } from "@/lib/card";
import { formatDate, couple } from "@/lib/message";

export default function Invitation({ params }) {
  const { token } = use(params);
  const [data, setData] = useState(undefined);
  const [img, setImg] = useState(null);

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

  return (
    <div className="invite">
      {img ? <img className="cardimg" src={img} alt="Carte d'invitation" /> : <div className="loading" style={{ minHeight: 400 }}>…</div>}
      <div className="info">
        <div className="t">{fullName(g)}</div>
        <p>
          Tu es {isF ? "invitée" : "invité"} au mariage de <b>{couple(s)}</b>
        </p>
        <p>
          {formatDate(s.event_date)} · <b>{isF ? s.women_time : s.men_time}</b>
        </p>
        {s.venue && <p>📍 {s.venue}</p>}
        {s.maps_url && (
          <p><a href={s.maps_url} target="_blank" rel="noreferrer">Voir l'itinéraire</a></p>
        )}
        <p className="ar" style={{ fontSize: 20, color: "var(--olive)", margin: "12px 0" }}>
          اللَّهُمَّ اجْعَلْ زَوَاجَهُمَا مَوَدَّةً وَرَحْمَةً وَسَكِينَةً، وَارْزُقْهُمَا سَعَادَةً لَا تَزُولُ
        </p>
        <p style={{ color: "var(--ink)", fontWeight: 600 }}>📲 Présente ce QR code à l'entrée.</p>
        <button
          className="btn primary big"
          style={{ marginTop: 10 }}
          disabled={!img}
          onClick={() => downloadDataUrl(img, `invitation-${slug(fullName(g))}.png`)}
        >
          ⬇ Enregistrer ma carte
        </button>
      </div>
    </div>
  );
}
