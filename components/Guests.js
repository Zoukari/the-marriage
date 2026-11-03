"use client";
import { useEffect, useMemo, useState } from "react";
import { rpc } from "@/lib/supabase";
import { PREFIXES } from "@/lib/prefixes";
import { renderCard, qrDataUrl, downloadDataUrl, fullName, slug } from "@/lib/card";
import { shareText, whatsappTextLink } from "@/lib/message";

const EMPTY = { first_name: "", last_name: "", phone_prefix: "+253", phone: "", entries: 1 };

const ERRORS = {
  QUOTA_ATTEINT: "Quota atteint : tu ne peux plus ajouter d'invités. Demande à l'admin d'augmenter ton quota.",
  ACCES_REFUSE: "Action non autorisée.",
  PRENOM_REQUIS: "Le prénom est obligatoire.",
};

export default function Guests({ pw, settings, me = { role: "admin" } }) {
  const isInviter = me.role === "invite";
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
      const payload = { ...form, phone: form.phone.replace(/\D/g, ""), gender: tab, entries: Math.max(1, Number(form.entries) || 1) };
      if (editId) payload.id = editId;
      const r = await rpc("mariage_upsert_guest", { p_pw: pw, p: payload });
      setGuests((gs) => (editId ? gs.map((g) => (g.id === r.id ? r : g)) : [r, ...gs]));
      setForm({ ...EMPTY, phone_prefix: form.phone_prefix });
      setEditId(null);
    } catch (e) {
      setErr(ERRORS[e.message] || e.message);
    }
    setSaving(false);
  }

  function edit(g) {
    setTab(g.gender);
    setEditId(g.id);
    setForm({ first_name: g.first_name, last_name: g.last_name, phone_prefix: g.phone_prefix, phone: g.phone, entries: g.entries || 1 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function del(g) {
    if (!window.confirm(`Supprimer ${fullName(g)} ?`)) return;
    await rpc("mariage_delete_guest", { p_pw: pw, p_id: g.id });
    setGuests((gs) => gs.filter((x) => x.id !== g.id));
  }

  async function markSent(g) {
    try {
      await rpc("mariage_mark_sent", { p_pw: pw, p_id: g.id });
      setGuests((gs) => gs.map((x) => (x.id === g.id ? { ...x, sent_at: new Date().toISOString() } : x)));
    } catch {}
  }

  // Prépare l'image (le partage doit ensuite partir d'un clic direct)
  async function openCard(g, forShare = false) {
    setPreview({ guest: g, url: null, file: null, png: null, forShare });
    const c = await renderCard(settings, g);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92));
    const png = await new Promise((r) => c.toBlob(r, "image/png"));
    const file = new File([blob], `invitation-${slug(fullName(g))}.jpg`, { type: "image/jpeg" });
    setPreview({ guest: g, url: URL.createObjectURL(blob), file, png, forShare, copied: false });
  }

  const share = (g) => openCard(g, true);

  // Ouvre directement la discussion WhatsApp de l'invité (message pré-rempli),
  // l'image est copiée : dans WhatsApp, appui long → Coller → Envoyer.
  async function sendDirect() {
    const { guest: g, png } = preview;
    if (!g.phone) {
      alert("Pas de numéro pour cet invité : utilise « Choisir le contact ».");
      return;
    }
    let copied = false;
    try {
      if (navigator.clipboard && window.ClipboardItem && png) {
        await Promise.race([
          navigator.clipboard.write([new window.ClipboardItem({ "image/png": png })]),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 1500)),
        ]);
        copied = true;
      }
    } catch {}
    const link = whatsappTextLink(settings, g);
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) window.location.href = link;
    else window.open(link, "_blank");
    setPreview((p) => (p ? { ...p, copied } : p));
    await markSent(g);
  }

  async function sendImage() {
    const { guest: g, file, url } = preview;
    const text = shareText(settings, g);
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text });
        await markSent(g);
        setPreview(null);
      } catch (e) {
        if (e.name !== "AbortError") alert("Partage impossible : " + e.message);
      }
      return;
    }
    // Ordinateur : on télécharge l'image et on ouvre la discussion WhatsApp
    downloadDataUrl(url, file.name);
    if (g.phone) window.open(whatsappTextLink(settings, g), "_blank");
    alert("Image téléchargée : glisse-la dans la discussion WhatsApp qui vient de s'ouvrir.");
    await markSent(g);
  }

  async function copyNumber(g) {
    try { await navigator.clipboard.writeText(`${g.phone_prefix}${g.phone}`); } catch {}
  }

  async function dlQR(g) {
    downloadDataUrl(await qrDataUrl(g.token), `qr-${slug(fullName(g))}.png`);
  }

  async function resetIn(g) {
    if (!window.confirm(`Annuler l'entrée de ${fullName(g)} ?`)) return;
    await rpc("mariage_reset_checkin", { p_pw: pw, p_id: g.id });
    setGuests((gs) => gs.map((x) => (x.id === g.id ? { ...x, checked_in_at: null } : x)));
  }

  const quota = me.quota || 0;
  const used = guests.reduce((t, g) => t + (g.entries || 1), 0);
  const full = isInviter && used >= quota;
  const left = Math.max(quota - used, 0);
  const sent = byTab.filter((g) => g.sent_at).length;
  const present = byTab.filter((g) => g.checked_in_at).length;

  return (
    <>
      <h2>{isInviter ? "Mes invités" : "Liste des invités"}</h2>

      {isInviter && (
        <div className="panel" style={{ background: full ? "var(--bad-bg)" : "var(--paper)", borderColor: full ? "var(--bad)" : "var(--line)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
            <b style={{ fontSize: 16 }}>{full ? "Quota atteint" : "Entrées restantes"}</b>
            <b style={{ fontSize: 26, color: full ? "var(--bad)" : "var(--olive)" }}>{Math.max(quota - used, 0)}</b>
          </div>
          <div style={{ height: 8, background: "var(--line)", borderRadius: 99, marginTop: 10, overflow: "hidden" }}>
            <div style={{ width: `${quota ? Math.min((used / quota) * 100, 100) : 100}%`, height: "100%", background: full ? "var(--bad)" : "var(--olive)" }} />
          </div>
          <div className="hint">{used} / {quota} entrées utilisées (une invitation peut compter plusieurs entrées)</div>
        </div>
      )}

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
        <div>
          <label className="f">Entrées</label>
          <input className="input" type="number" min="1" inputMode="numeric" value={form.entries}
            onChange={(e) => setForm({ ...form, entries: e.target.value.replace(/\D/g, "") })} style={{ fontWeight: 700 }} />
        </div>
        <div className="wide" style={{ display: "flex", gap: 6 }}>
          <button className="btn primary" disabled={saving || (full && !editId)} style={{ flex: 1 }}>
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
                {(g.entries || 1) > 1 && <span className="pill" style={{ background: "#fff3d6", color: "#8a6410" }}>🎟️ {g.entries} entrées</span>}
                {g.sent_at && <span className="pill sent">✓ Envoyé</span>}
                {!isInviter && g.invited_by_name && <span className="pill" style={{ background: "#efe9f7", color: "#6b4f96" }}>par {g.invited_by_name}</span>}
                {g.checked_in_at && <span className="pill in">{(g.entries || 1) > 1 ? `Entrées ${g.entries_used || 1}/${g.entries}` : `Entré${g.gender === "F" ? "e" : ""}`} {new Date(g.checked_in_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}{g.checked_in_by ? ` · ${g.checked_in_by}` : ""}</span>}
                <div className="tel">{g.phone ? `${g.phone_prefix} ${g.phone}` : "Pas de numéro"}</div>
              </div>
              <div className="actions">
                <button className="btn wa sm" onClick={() => share(g)}>WhatsApp</button>
                <button className="btn sm" onClick={() => openCard(g)}>Carte</button>
                <button className="btn sm" onClick={() => dlQR(g)}>⬇ QR</button>
                <button className="btn sm" onClick={() => edit(g)}>✎</button>
                {g.checked_in_at && !isInviter && <button className="btn sm" onClick={() => resetIn(g)} title="Annuler l'entrée">↺</button>}
                <button className="btn sm danger" onClick={() => del(g)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div className="overlay" onClick={() => setPreview(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {preview.url ? <img src={preview.url} alt="Carte" style={{ maxHeight: "55vh", objectFit: "contain" }} /> : <div className="empty">Génération…</div>}
            {preview.guest.phone ? (
              <>
                <button className="btn wa big" style={{ marginTop: 12 }} disabled={!preview.png} onClick={sendDirect}>
                  {preview.png ? `Envoyer à ${fullName(preview.guest)}` : "Préparation…"}
                </button>
                <div className="hint" style={{ textAlign: "center", marginTop: 8 }}>
                  La discussion s'ouvre directement avec le message prêt.<br />
                  Pour joindre la carte : <b>appui long dans la zone de texte → Coller</b>, puis <b>Envoyer</b>.
                </div>
                <button className="btn" style={{ marginTop: 8, width: "100%" }} disabled={!preview.file} onClick={sendImage}>
                  Partager l'image (choisir le contact)
                </button>
              </>
            ) : (
              <button className="btn wa big" style={{ marginTop: 12 }} disabled={!preview.file} onClick={sendImage}>
                {preview.file ? "Partager l'image sur WhatsApp" : "Préparation…"}
              </button>
            )}
            <div className="btns">
              <button className="btn primary" disabled={!preview.url} onClick={() => downloadDataUrl(preview.url, preview.file.name)}>
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
