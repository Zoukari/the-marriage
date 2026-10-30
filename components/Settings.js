"use client";
import { useEffect, useRef, useState } from "react";
import { rpc } from "@/lib/supabase";
import { renderCard, compressImage } from "@/lib/card";
import { buildMessage } from "@/lib/message";

const DEMO = { first_name: "Prénom", last_name: "Nom", gender: "H", token: "demo123", phone_prefix: "+253", phone: "" };

const SLIDERS = [
  ["qr_x", "QR — position horizontale", 0, 100],
  ["qr_y", "QR — position verticale", 0, 100],
  ["qr_size", "QR — taille", 5, 80],
  ["groom_y", "Nom du marié — position verticale", 0, 100],
  ["bride_y", "Nom de la mariée — position verticale", 0, 100],
  ["couple_size", "Noms des mariés — taille", 3, 20],
  ["couple_w", "Noms des mariés — largeur max", 20, 95],
  ["name_x", "Ovale infos — position horizontale", 0, 100],
  ["name_y", "Ovale infos — position verticale", 0, 100],
  ["name_w", "Ovale infos — largeur max", 10, 95],
];
const COLORS = [
  ["groom_color", "Couleur marié"],
  ["bride_color", "Couleur mariée"],
  ["name_color", "Couleur infos (lieu/date/heure)"],
];

export default function Settings({ pw, settings, onSaved, onLogout }) {
  const [s, setS] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState(null);
  const [newPw, setNewPw] = useState("");
  const timer = useRef();

  const set = (k, v) => setS((o) => ({ ...o, [k]: v }));

  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const c = await renderCard(s, DEMO);
      setPreview(c.toDataURL("image/jpeg", 0.8));
    }, 250);
  }, [s]);

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const p = { ...s };
      delete p.id;
      p.card_bg = s.card_bg || "";
      SLIDERS.forEach(([k]) => (p[k] = Number(s[k])));
      await rpc("mariage_save_settings", { p_pw: pw, p });
      onSaved(s);
      setMsg("✓ Enregistré");
    } catch (e) {
      setMsg(e.message);
    }
    setSaving(false);
  }

  async function upload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    set("card_bg", await compressImage(f));
  }

  async function changePw() {
    try {
      await rpc("mariage_change_password", { p_pw: pw, p_new: newPw });
      alert("Mot de passe changé. Reconnecte-toi.");
      onLogout();
    } catch (e) {
      alert(e.message === "MOT_DE_PASSE_TROP_COURT" ? "6 caractères minimum" : e.message);
    }
  }

  const field = (k, label, type = "text", ph = "") => (
    <div>
      <label className="f">{label}</label>
      <input className="input" type={type} value={s[k] ?? ""} placeholder={ph} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  return (
    <>
      <h2>Paramètres</h2>

      <div className="panel">
        <h3>Le mariage</h3>
        <div className="grid2">
          {field("groom", "Marié")}
          {field("bride", "Mariée", "text", "À compléter")}
          {field("event_date", "Date", "date")}
          <div />
          {field("men_time", "Heure hommes", "text", "13h00")}
          {field("women_time", "Heure femmes", "text", "15h00")}
          {field("venue", "Lieu (optionnel)", "text", "Nom de la salle, quartier")}
          {field("maps_url", "Lien Google Maps (optionnel)", "url", "https://maps.app.goo.gl/…")}
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? "…" : "Enregistrer"}</button>
          <span className="hint">{msg}</span>
        </div>
      </div>

      <div className="panel">
        <h3>Carte d'invitation</h3>
        <div className="grid2">
          <div className="preview">
            {preview ? <img src={preview} alt="Aperçu" /> : <div className="empty">…</div>}
          </div>
          <div>
            <label className="f">Image de fond (design)</label>
            <input type="file" accept="image/*" onChange={upload} />
            <div className="hint">Par défaut : le design fourni. Remplace-le si tu modifies la carte sur Canva (même format A5 vertical).</div>
            {s.card_bg && (
              <button className="btn sm" style={{ marginTop: 8 }} onClick={() => set("card_bg", null)}>Revenir au design par défaut</button>
            )}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {SLIDERS.map(([k, l, min, max]) => (
                <div key={k}>
                  <label className="f">{l} · {Number(s[k]).toFixed(1)}%</label>
                  <input type="range" min={min} max={max} step="0.1" value={s[k]} onChange={(e) => set(k, e.target.value)} style={{ width: "100%" }} />
                </div>
              ))}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {COLORS.map(([k, l]) => (
                  <div key={k}>
                    <label className="f">{l}</label>
                    <input type="color" value={s[k] || "#4b5634"} onChange={(e) => set(k, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
            <button className="btn primary" style={{ marginTop: 14 }} onClick={save} disabled={saving}>Enregistrer la carte</button>
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>Aperçu du message WhatsApp</h3>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14, background: "#e7f6dc", padding: 14, borderRadius: 12, margin: 0 }}>
          {typeof window !== "undefined" ? buildMessage(s, DEMO) : ""}
        </pre>
      </div>

      <div className="panel">
        <h3>Mot de passe admin</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="input" type="password" placeholder="Nouveau mot de passe" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <button className="btn" onClick={changePw} disabled={newPw.length < 6}>Changer</button>
        </div>
      </div>
    </>
  );
}
