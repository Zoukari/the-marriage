"use client";
import { useEffect, useMemo, useState } from "react";
import { rpc } from "@/lib/supabase";
import { PREFIXES } from "@/lib/prefixes";
import { renderFullPage, qrDataUrl, downloadDataUrl, fullName, slug } from "@/lib/card";
import { whatsappLink } from "@/lib/message";

const EMPTY = { first_name: "", last_name: "", phone_prefix: "+253", phone: "" };

export default function Guests({ pw, settings }) {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("H");
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState(null); // { guest, url }
  const [err, setErr] = useState("");

  async function load() {
    try {
      setGuests(await rpc("mariage_list_guests", { p_pw: pw }));
    } catch (e) {
      setErr(e.message);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const byTab = useMemo(() => guests.filter((g) => g.gender === tab), [guests, tab]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return byTab;
    return byTab.filter((g) => `${fullName(g)} ${g.phone}`.toLowerCase().includes(s));
  }, [byTab, q]);
  const count = (gd) => guests.filter((g) => g.gender === gd).length;

  async function save(e) {
    e.preventDefault();
    if (!form.first_name.trim()) return;
    setSaving(true);
    setErr("");
    try {
      const payload = { ...form, phone: form.phone.replace(/\D/g, ""), gender: tab };
      if (editId) payload.id = editId;
      const r = await rpc("mariage_upsert_guest", { p_pw: pw, p: payload });
      setGuests((gs) => (editId ? gs.map((g) => (g.id === r.id ? r : g)) : [r, ...gs]));
      setForm({ ...EMPTY, phone_prefix: form.phone_prefix });
      setEditId(null);
    } catch (e) {
      setErr(e.message);
    }
    setSaving(false);
  }

  function edit(g) {
    setTab(g.gender);
    setEditId(g.id);
    setForm({ first_name: g.first_name, last_name: g.last_name, phone_prefix: g.phone_prefix, phone: g.phone });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function del(g) {
    if (!window.confirm(`Supprimer ${fullName(g)} ?`)) return;
    await rpc("mariage_delete_guest", { p_pw: pw, p_id: g.id });
    setGuests((gs) => gs.filter((x) => x.id !== g.id));
  }

  async function share(g) {
    if (!g.phone) {
      alert("Ajoute un numéro de téléphone pour cet invité.");
      return;
    }
    window.open(whatsappLink(settings, g), "_blank");
    try {
      await rpc("mariage_mark_sent", { p_pw: pw, p_id: g.id });
      setGuests((gs) => gs.map((x) => (x.id === g.id ? { ...x, sent_at: new Date().toISOString() } : x)));
    } catch {}
  }

  async function openCard(g) {
    setPreview({ guest: g, url: null });
    const c = await renderFullPage(settings, g);
    setPreview({ guest: g, url: c.toDataURL("image/png") });
  }

  async function dlQR(g) {
    downloadDataUrl(await qrDataUrl(g.token), `qr-${slug(fullName(g))}.png`);
  }

  async function resetIn(g) {
    if (!window.confirm(`Annuler l'entrée de ${fullName(g)} ?`)) return;
    await rpc("mariage_reset_checkin", { p_pw: pw, p_id: g.id });
    setGuests((gs) => gs.map((x) => (x.id === g.id ? { ...x, checked_in_at: null } : x)));
  }

  const sent = byTab.filter((g) => g.sent_at).length;
  const present = byTab.filter((g) => g.checked_in_at).length;

  return (
    <>
      <h2>Liste des invités</h2>

      <div className="tabs">
        <button className={`tab H ${tab === "H" ? "on" : ""}`} onClick={() => { setTab("H"); setEditId(null); setForm(EMPTY); }}>
          Hommes <span className="n">{count("H")}</span>
        </button>
        <button className={`tab F ${tab === "F" ? "on" : ""}`} onClick={() => { setTab("F"); setEditId(null); setForm(EMPTY); }}>
          Femmes <span className="n">{count("F")}</span>
        </button>
      </div>

      <div className="stats">
        <div className="stat"><b>{byTab.length}</b><span>Invité{tab === "F" ? "e" : ""}s</span></div>
        <div className="stat"><b>{sent}</b><span>Envoyés</span></div>
        <div className="stat"><b>{present}</b><span>Présent{tab === "F" ? "e" : ""}s</span></div>
      </div>

      <form className={`form ${tab}`} onSubmit={save}>
        <div>
          <label className="f">Prénom</label>
          <input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
        </div>
        <div>
          <label className="f">Nom</label>
          <input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        </div>
        <div>
          <label className="f">Préfixe</label>
          <select className="select" value={form.phone_prefix} onChange={(e) => setForm({ ...form, phone_prefix: e.target.value })}>
            {PREFIXES.map((p) => (
              <option key={p.code} value={p.code}>{p.code} {p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="f">Numéro WhatsApp</label>
          <input className="input" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="77 12 34 56" />
        </div>
        <div className="wide" style={{ display: "flex", gap: 6 }}>
          <button className="btn primary" disabled={saving} style={{ flex: 1 }}>
            {editId ? "Enregistrer" : "+ Ajouter"}
          </button>
          {editId && (
            <button type="button" className="btn" onClick={() => { setEditId(null); setForm(EMPTY); }}>✕</button>
          )}
        </div>
      </form>
      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}

      <div className="toolbar">
        <input className="input" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <div className="empty">Chargement…</div>
      ) : shown.length === 0 ? (
        <div className="empty">Aucun{tab === "F" ? "e" : ""} invité{tab === "F" ? "e" : ""} pour l'instant.</div>
      ) : (
        <div className="list">
          {shown.map((g) => (
            <div key={g.id} className={`row ${g.gender}`}>
              <div className="who">
                <b>{fullName(g)}</b>
                {g.sent_at && <span className="pill sent">✓ Envoyé</span>}
                {g.checked_in_at && <span className="pill in">Entré{g.gender === "F" ? "e" : ""} {new Date(g.checked_in_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
                <div className="tel">{g.phone ? `${g.phone_prefix} ${g.phone}` : "Pas de numéro"}</div>
              </div>
              <div className="actions">
                <button className="btn wa sm" onClick={() => share(g)}>WhatsApp</button>
                <button className="btn sm" onClick={() => openCard(g)}>Carte</button>
                <button className="btn sm" onClick={() => dlQR(g)}>⬇ QR</button>
                <button className="btn sm" onClick={() => edit(g)}>✎</button>
                {g.checked_in_at && <button className="btn sm" onClick={() => resetIn(g)} title="Annuler l'entrée">↺</button>}
                <button className="btn sm danger" onClick={() => del(g)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="overlay" onClick={() => setPreview(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {preview.url ? <img src={preview.url} alt="Carte" /> : <div className="empty">Génération…</div>}
            <div className="btns">
              <button className="btn primary" disabled={!preview.url} onClick={() => downloadDataUrl(preview.url, `invitation-${slug(fullName(preview.guest))}.png`)}>
                ⬇ Télécharger (image)
              </button>
              <button className="btn" onClick={() => dlQR(preview.guest)}>⬇ QR seul</button>
              <button className="btn" onClick={() => setPreview(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
