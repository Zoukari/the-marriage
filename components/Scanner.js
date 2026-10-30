"use client";
import { useEffect, useRef, useState } from "react";
import { rpc } from "@/lib/supabase";
import { fullName } from "@/lib/card";

function extractToken(text) {
  const t = String(text).trim();
  const m = t.match(/\/i\/([a-zA-Z0-9]+)/);
  return m ? m[1] : t;
}
const hhmm = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function Scanner({ pw }) {
  const scannerRef = useRef(null);
  const busyRef = useRef(false);
  const [state, setState] = useState({ kind: "idle" }); // idle | found | already | done | unknown | error
  const [camErr, setCamErr] = useState("");
  const [entry, setEntry] = useState("all");
  const [confirming, setConfirming] = useState(false);
  const [q, setQ] = useState("");
  const [all, setAll] = useState(null);

  async function handle(text) {
    if (busyRef.current) return;
    busyRef.current = true;
    try { scannerRef.current?.pause(true); } catch {}
    if (navigator.vibrate) navigator.vibrate(80);
    try {
      const g = await rpc("mariage_scan_lookup", { p_pw: pw, p_token: extractToken(text) });
      if (!g) setState({ kind: "unknown" });
      else if (g.checked_in_at) setState({ kind: "already", guest: g });
      else setState({ kind: "found", guest: g });
    } catch (e) {
      setState({ kind: "error", msg: e.message });
    }
  }

  async function confirm() {
    setConfirming(true);
    try {
      const r = await rpc("mariage_scan_confirm", { p_pw: pw, p_token: state.guest.token });
      if (r.status === "ok") setState({ kind: "done", guest: r.guest });
      else if (r.status === "already") setState({ kind: "already", guest: r.guest });
      else setState({ kind: "unknown" });
      setAll(null);
    } catch (e) {
      setState({ kind: "error", msg: e.message });
    }
    setConfirming(false);
  }

  function next() {
    setState({ kind: "idle" });
    busyRef.current = false;
    try { scannerRef.current?.resume(); } catch {}
  }

  useEffect(() => {
    let stopped = false;
    let inst;
    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (stopped) return;
      inst = new Html5Qrcode("reader", { verbose: false });
      scannerRef.current = inst;
      try {
        await inst.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s }; } },
          (text) => handle(text),
          () => {}
        );
      } catch (e) {
        setCamErr("Caméra inaccessible. Autorise l'accès à la caméra (le site doit être en https).");
      }
    })();
    return () => {
      stopped = true;
      try { inst?.stop().then(() => inst.clear()).catch(() => {}); } catch {}
    };
  }, []);

  async function searchFocus() {
    if (!all) setAll(await rpc("mariage_list_guests", { p_pw: pw }));
  }
  const matches =
    all && q.trim().length >= 2
      ? all.filter((g) => fullName(g).toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
      : [];

  const g = state.guest;
  const wrongDoor = g && entry !== "all" && g.gender !== entry;

  return (
    <div className="scanwrap">
      <h2>Scanner les QR codes</h2>

      <div className="tabs" style={{ marginBottom: 12 }}>
        {[["all", "Toutes entrées"], ["H", "Entrée hommes"], ["F", "Entrée femmes"]].map(([k, l]) => (
          <button key={k} className={`btn sm ${entry === k ? "primary" : ""}`} onClick={() => setEntry(k)}>{l}</button>
        ))}
      </div>

      <div id="reader" />
      {camErr && <div className="err">{camErr}</div>}

      {state.kind !== "idle" && (
        <div
          className={`result ${
            state.kind === "already" ? "already" : state.kind === "done" ? "done" : state.kind === "found" ? g.gender : "unknown"
          }`}
        >
          {state.kind === "found" && (
            <>
              <div className="tag">{g.gender === "H" ? "Invité · Homme" : "Invitée · Femme"}</div>
              <div className="big">{fullName(g)}</div>
              {wrongDoor && <p style={{ color: "var(--bad)", fontWeight: 700 }}>⚠️ Mauvaise entrée : {g.gender === "H" ? "homme" : "femme"}</p>}
              <button className="btn primary big" style={{ marginTop: 10 }} onClick={confirm} disabled={confirming}>
                {confirming ? "…" : "✓ Confirmer l'entrée"}
              </button>
              <button className="btn" style={{ marginTop: 8, width: "100%" }} onClick={next}>Annuler</button>
            </>
          )}
          {state.kind === "done" && (
            <>
              <div className="icon">✅</div>
              <div className="big">{fullName(g)}</div>
              <div className="tag">Entrée confirmée · {hhmm(g.checked_in_at)}</div>
            </>
          )}
          {state.kind === "already" && (
            <>
              <div className="icon">⛔</div>
              <div className="tag">{g.gender === "F" ? "Déjà entrée" : "Déjà entré"}</div>
              <div className="big">{fullName(g)}</div>
              <div>Cette personne est déjà rentrée à <b>{hhmm(g.checked_in_at)}</b>{g.checked_in_by ? <> · scanné par <b>{g.checked_in_by}</b></> : null}</div>
            </>
          )}
          {state.kind === "unknown" && (
            <>
              <div className="icon">❓</div>
              <div className="big">QR code inconnu</div>
              <div>Ce QR ne correspond à aucun invité.</div>
            </>
          )}
          {state.kind === "error" && <div>Erreur : {state.msg}</div>}
          {state.kind !== "found" && (
            <button className="btn big" style={{ marginTop: 14, background: "#fff" }} onClick={next}>
              📷 Scanner le suivant
            </button>
          )}
        </div>
      )}

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Recherche manuelle</h3>
        <input className="input" placeholder="Nom de l'invité (si le QR ne passe pas)" value={q} onFocus={searchFocus} onChange={(e) => setQ(e.target.value)} />
        <div className="list" style={{ marginTop: 8 }}>
          {matches.map((m) => (
            <button
              key={m.id}
              className={`row ${m.gender}`}
              style={{ textAlign: "left", gridTemplateColumns: "1fr auto" }}
              onClick={() => { busyRef.current = false; setQ(""); handle(m.token); }}
            >
              <b>{fullName(m)}</b>
              <span>{m.checked_in_at ? `Entré${m.gender === "F" ? "e" : ""} ${hhmm(m.checked_in_at)}` : "→"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
