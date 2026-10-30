"use client";
import { useEffect, useState } from "react";
import { rpc } from "@/lib/supabase";

const ROLES = {
  scan: { label: "Scanner", desc: "Scanne les QR à l'entrée uniquement" },
  team: { label: "Équipe", desc: "Invités (ajout, envoi WhatsApp) + scanner" },
};
const ERR = {
  PIN_INVALIDE: "Le PIN doit contenir 4 à 8 chiffres.",
  PIN_DEJA_UTILISE: "Ce PIN est déjà utilisé.",
  NOM_REQUIS: "Donne un nom à l'accès.",
};
const genPin = () => String(Math.floor(100000 + Math.random() * 900000));
const when = (iso) =>
  iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "jamais";

export default function Access({ pw }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: "", pin: genPin(), role: "scan" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  const load = async () => setList(await rpc("mariage_list_access", { p_pw: pw }));
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  const fail = (e) => setErr(ERR[e.message] || e.message);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await rpc("mariage_save_access", { p_pw: pw, p: form });
      setCreated({ ...form });
      setForm({ name: "", pin: genPin(), role: form.role });
      await load();
    } catch (e) { fail(e); }
    setBusy(false);
  }

  async function update(a, patch) {
    setErr("");
    try {
      await rpc("mariage_save_access", { p_pw: pw, p: { id: a.id, ...patch } });
      await load();
    } catch (e) { fail(e); }
  }

  async function newPin(a) {
    const pin = window.prompt(`Nouveau PIN pour ${a.name} (4 à 8 chiffres)`, genPin());
    if (!pin) return;
    await update(a, { pin });
    setCreated({ name: a.name, pin, role: a.role });
  }

  async function del(a) {
    if (!window.confirm(`Supprimer l'accès « ${a.name} » ?`)) return;
    await rpc("mariage_delete_access", { p_pw: pw, p_id: a.id });
    await load();
  }

  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/admin` : "/admin";

  return (
    <>
      <h2>Accès PIN</h2>

      <form className="panel" onSubmit={create}>
        <h3>Créer un accès</h3>
        <div className="grid2">
          <div>
            <label className="f">Nom</label>
            <input className="input" placeholder="Ex. Porte hommes, Cousin Ahmed" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="f">PIN (4 à 8 chiffres)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                className="input"
                inputMode="numeric"
                maxLength={8}
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })}
                style={{ fontFamily: "monospace", fontSize: 18, letterSpacing: 3 }}
              />
              <button type="button" className="btn" onClick={() => setForm({ ...form, pin: genPin() })} title="Générer">🎲</button>
            </div>
          </div>
        </div>
        <label className="f" style={{ marginTop: 14 }}>Rôle</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(ROLES).map(([k, r]) => (
            <button
              type="button"
              key={k}
              className={`btn ${form.role === k ? "primary" : ""}`}
              onClick={() => setForm({ ...form, role: k })}
              style={{ flexDirection: "column", alignItems: "flex-start", whiteSpace: "normal", textAlign: "left" }}
            >
              <b>{r.label}</b>
              <span style={{ fontSize: 12, opacity: 0.8, fontWeight: 400 }}>{r.desc}</span>
            </button>
          ))}
        </div>
        <button className="btn primary" style={{ marginTop: 14 }} disabled={busy || form.pin.length < 4 || !form.name.trim()}>
          + Créer l'accès
        </button>
        {err && <div className="err">{err}</div>}
      </form>

      {created && (
        <div className="panel" style={{ background: "#e9f8ee", borderColor: "#bfe3ca" }}>
          <h3>✓ Accès prêt : {created.name}</h3>
          <p style={{ margin: "0 0 6px" }}>
            PIN : <b style={{ fontFamily: "monospace", fontSize: 22, letterSpacing: 3 }}>{created.pin}</b> · {ROLES[created.role].label}
          </p>
          <p className="hint" style={{ margin: "0 0 10px" }}>Note-le maintenant : il ne sera plus affiché ensuite.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              className="btn wa"
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/?text=${encodeURIComponent(`Accès mariage (${ROLES[created.role].label})\n${loginUrl}\nPIN : ${created.pin}`)}`}
            >
              Partager par WhatsApp
            </a>
            <button className="btn" onClick={() => setCreated(null)}>Fermer</button>
          </div>
        </div>
      )}

      <div className="list">
        {list.length === 0 && <div className="empty">Aucun accès pour l'instant.</div>}
        {list.map((a) => (
          <div key={a.id} className="row" style={{ background: "var(--paper)", borderColor: "var(--line)", opacity: a.active ? 1 : 0.55 }}>
            <div className="who">
              <b>{a.name}</b>
              <span className="pill" style={{ background: a.role === "team" ? "var(--olive)" : "var(--gold)", color: "#fff" }}>{ROLES[a.role]?.label}</span>
              {!a.active && <span className="pill" style={{ background: "#eee", color: "#666" }}>Désactivé</span>}
              <div className="tel">Dernière connexion : {when(a.last_login)}</div>
            </div>
            <div className="actions">
              <select className="select" style={{ width: "auto", padding: "6px 8px" }} value={a.role} onChange={(e) => update(a, { role: e.target.value })}>
                {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
              </select>
              <button className="btn sm" onClick={() => newPin(a)}>Nouveau PIN</button>
              <button className="btn sm" onClick={() => update(a, { active: !a.active })}>{a.active ? "Désactiver" : "Activer"}</button>
              <button className="btn sm danger" onClick={() => del(a)}>🗑</button>
            </div>
          </div>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 14 }}>
        Les personnes se connectent sur <b>{loginUrl}</b> en tapant leur PIN. Ton mot de passe admin reste le seul à voir Paramètres et Accès.
      </p>
    </>
  );
}
