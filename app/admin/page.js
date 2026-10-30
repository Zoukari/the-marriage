"use client";
import { useEffect, useState } from "react";
import { rpc } from "@/lib/supabase";
import Guests from "@/components/Guests";
import Scanner from "@/components/Scanner";
import Settings from "@/components/Settings";
import Access from "@/components/Access";

const KEY = "mariage_admin_pw";
const NAV = [
  { id: "guests", label: "Invités", ic: "👥", roles: ["admin", "team", "invite"] },
  { id: "scan", label: "Scanner QR", ic: "📷", roles: ["admin", "team", "scan"] },
  { id: "access", label: "Accès PIN", ic: "🔑", roles: ["admin"] },
  { id: "settings", label: "Paramètres", ic: "⚙️", roles: ["admin"] },
];
const ROLE_LABEL = { admin: "Admin", team: "Équipe", scan: "Scanner", invite: "Inviteur" };

export default function Admin() {
  const [pw, setPw] = useState(null);
  const [input, setInput] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState("guests");
  const [settings, setSettings] = useState(null);
  const [me, setMe] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setPw(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (!pw) return;
    (async () => {
      try {
        const who = await rpc("mariage_whoami", { p_pw: pw });
        if (!who) return logout();
        setMe(who);
        setView(who.role === "scan" ? "scan" : "guests");
        setSettings(await rpc("mariage_get_settings", { p_pw: pw }));
      } catch {
        logout();
      }
    })();
  }, [pw]);

  async function login(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const ok = await rpc("mariage_whoami", { p_pw: input.trim() });
      if (!ok) {
        setErr("Mot de passe ou PIN incorrect");
      } else {
        try { localStorage.setItem(KEY, input.trim()); } catch {}
        setPw(input.trim());
      }
    } catch (e) {
      const m = String(e.message || e);
      setErr(
        /mariage_whoami|schema cache|does not exist|Could not find/i.test(m)
          ? "La base n'est pas à jour : relance supabase.sql dans Supabase (SQL Editor)."
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
    setMe(null);
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
            placeholder="Mot de passe ou PIN"
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

  if (!settings || !me) return <div className="loading">Chargement…</div>;

  const navBtns = NAV.filter((n) => n.roles.includes(me.role)).map((n) => (
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
          <small>{me.role === "admin" ? "Admin" : `${me.name} · ${ROLE_LABEL[me.role]}`}</small>
        </div>
        {navBtns}
        <div className="spacer" />
        <button className="nav" onClick={logout}>↩ Déconnexion</button>
      </aside>
      <main className="main">
        {view === "guests" && me.role !== "scan" && <Guests pw={pw} settings={settings} me={me} />}
        {view === "scan" && <Scanner pw={pw} />}
        {view === "access" && me.role === "admin" && <Access pw={pw} />}
        {view === "settings" && me.role === "admin" && <Settings pw={pw} settings={settings} onSaved={setSettings} onLogout={logout} />}
      </main>
      <nav className="mobilebar">
        {navBtns}
        <button className="nav" onClick={logout}><span className="ic">↩</span> Sortir</button>
      </nav>
    </div>
  );
}
