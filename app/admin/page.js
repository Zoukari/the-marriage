"use client";
import { useEffect, useState } from "react";
import { rpc } from "@/lib/supabase";
import Guests from "@/components/Guests";
import Scanner from "@/components/Scanner";
import Settings from "@/components/Settings";

const KEY = "mariage_admin_pw";
const NAV = [
  { id: "guests", label: "Invités", ic: "👥" },
  { id: "scan", label: "Scanner QR", ic: "📷" },
  { id: "settings", label: "Paramètres", ic: "⚙️" },
];

export default function Admin() {
  const [pw, setPw] = useState(null);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("guests");
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setPw(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (!pw) return;
    rpc("mariage_get_settings", { p_pw: pw })
      .then(setSettings)
      .catch(() => logout());
  }, [pw]);

  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const ok = await rpc("mariage_login", { p_pw: input.trim() });
      if (!ok) {
        setErr("Mot de passe incorrect");
      } else {
        try { localStorage.setItem(KEY, input.trim()); } catch {}
        setPw(input.trim());
      }
    } catch (e) {
      const m = String(e.message || e);
      setErr(
        /mariage_login|schema cache|does not exist|Could not find/i.test(m)
          ? "Le SQL n'est pas installé dans ce projet Supabase (celui des variables Vercel). Lance supabase.sql dedans."
          : /Invalid API key|JWT|apikey/i.test(m)
          ? "Clé Supabase invalide : vérifie NEXT_PUBLIC_SUPABASE_ANON_KEY sur Vercel puis Redeploy."
          : `Erreur : ${m}`
      );
    }
    setBusy(false);
  }

  function logout() {
    try { localStorage.removeItem(KEY); } catch {}
    setPw(null);
    setSettings(null);
  }

  if (!pw) {
    return (
      <div className="login">
        <form className="card" onSubmit={login}>
          <h1>Espace mariage</h1>
          <p>Administration des invitations</p>
          <input
            className="input"
            type="password"
            placeholder="Mot de passe"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
          />
          <button className="btn primary big" style={{ marginTop: 12 }} disabled={busy || !input}>
            {busy ? "…" : "Entrer"}
          </button>
          {err && <div className="err">{err}</div>}
        </form>
      </div>
    );
  }

  if (!settings) return <div className="loading">Chargement…</div>;

  const navBtns = NAV.map((n) => (
    <button key={n.id} className={`nav ${view === n.id ? "on" : ""}`} onClick={() => setView(n.id)}>
      <span className="ic">{n.ic}</span> {n.label}
    </button>
  ));

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          {settings.groom}
          {settings.bride ? ` & ${settings.bride}` : ""}
          <small>Admin mariage</small>
        </div>
        {navBtns}
        <div className="spacer" />
        <button className="nav" onClick={logout}>↩ Déconnexion</button>
      </aside>
      <main className="main">
        {view === "guests" && <Guests pw={pw} settings={settings} />}
        {view === "scan" && <Scanner pw={pw} />}
        {view === "settings" && <Settings pw={pw} settings={settings} onSaved={setSettings} onLogout={logout} />}
      </main>
      <nav className="mobilebar">{navBtns}</nav>
    </div>
  );
}
