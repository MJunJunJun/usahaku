import { useEffect, useState, useRef } from "react";
import { Bot, BookUser, CheckCircle2, Download, LogOut, MessageCircle, Pencil, Plus, QrCode, Radio, RefreshCw, Search, Send, Trash2, User, XCircle } from "lucide-react";
import { api, errorText, formatDateTime } from "../lib/api";
import { Button, FormError, Loading, StatusBadge } from "../lib/shared";

const hhmm = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
};

/* ===== Picker kategori anti-dobel =====
   - Kolom teks di atas: ketik nama kategori baru (Enter utk tambah)
   - Dropdown di bawah: kategori yang SUDAH ada — klik utk memakai ejaan yang sama
   - Case-insensitive: "kuliner" vs "Kuliner" dianggap sama */
function CategoryPicker({ allCats, value, onChange, multiple = true, placeholder }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const norm = (s) => String(s || "").trim().toLowerCase();
  const selected = multiple ? (value || []) : (value ? [value] : []);

  const addCategory = async (raw) => {
    const t = String(raw || "").trim();
    if (!t) return;
    const canonical = allCats.find(c => norm(c) === norm(t)) || t;
    if (!(multiple ? (value || []).some(v => norm(v) === norm(canonical)) : (value ? norm(value) === norm(canonical) : false))) {
      try {
        await api.post("/admin/wa/categories", { name: canonical });
      } catch (e) {
        // ignore category creation error
      }
    }
    if (multiple) {
      if (!(value || []).some(v => norm(v) === norm(canonical))) onChange([...(value || []), canonical]);
    } else {
      onChange(canonical);
    }
    setText("");
    setOpen(false);
  };
  const removeCat = (c) => multiple
    ? onChange((value || []).filter(v => v !== c))
    : onChange("");

  const suggestions = (allCats || [])
    .filter(c => !selected.some(s => norm(s) === norm(c)))
    .filter(c => !norm(text) || norm(c).includes(norm(text)))
    .slice(0, 8);

  return (
    <div className="cat-picker">
      {selected.length > 0 && (
        <div className="wa-cat-cell" style={{ marginBottom: 8 }}>
          {selected.map(c => (
            <span key={c} className="wa-cat-chip has-x">
              {c}
              <button type="button" title="Hapus kategori dari kontak ini" onClick={() => removeCat(c)}>×</button>
            </span>
          ))}
        </div>
      )}
      <input
        className="wa-inline-input"
        data-testid="category-input"
        value={text}
        placeholder={placeholder || "Ketik kategori baru, lalu Enter..."}
        onChange={e => { setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCategory(text); } }}
      />
      {open && suggestions.length > 0 && (
        <div className="cat-suggestions" data-testid="category-suggestions">
          <small>Kategori yang sudah ada — klik untuk pakai:</small>
          {suggestions.map(c => (
            <button key={c} type="button"
              onMouseDown={(e) => { e.preventDefault(); addCategory(c); }}>
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
const shortTime = (iso) => {
  try {
    const d = new Date(iso);
    const today = new Date();
    const same = d.toDateString() === today.toDateString();
    return same ? hhmm(iso) : d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  } catch { return ""; }
};

/* ================= HALAMAN WHATSAPP CENTER ================= */
export function WaCenter() {
  const [st, setSt] = useState(null);
  const [qr, setQr] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [numbersText, setNumbersText] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [logsStatus, setLogsStatus] = useState("");
  const [logs, setLogs] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [bcTarget, setBcTarget] = useState("manual"); // manual | category
  const [cats, setCats] = useState([]);
  const [bcCategory, setBcCategory] = useState("");

  const loadAll = () => {
    api.get("/admin/wa/status").then(r => setSt(r.data)).catch(() => {});
    api.get("/admin/wa/logs", { params: logsStatus ? { status: logsStatus } : {} }).then(r => setLogs(r.data)).catch(() => {});
    api.get("/admin/wa/broadcasts").then(r => setBroadcasts(r.data)).catch(() => {});
    api.get("/admin/wa/contacts/categories").then(r => setCats(r.data)).catch(() => {});
  };
  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadAll(); }, [logsStatus]);
  useEffect(() => {
    const id = setInterval(loadAll, 5000);
    return () => clearInterval(id);
  }, [logsStatus]);

  const showQr = async () => {
    setQrLoading(true); setErr("");
    try {
      const r = await api.get("/admin/wa/qr");
      const d = r.data || {};
      // qr_b64 = gambar PNG yang diunduh backend (sudah dengan Basic Auth ke GoWA)
      if (d.qr_b64) setQr({ src: `data:image/png;base64,${d.qr_b64}` });
      else setQr({ none: true });
    } catch (e) { setErr(errorText(e)); }
    finally { setQrLoading(false); }
  };

  const doLogoutWa = async () => {
    if (!window.confirm("Putuskan sesuai WhatsApp saat ini?")) return;
    await api.post("/admin/wa/logout"); setQr(null); loadAll();
  };

  const toggleGlobalAuto = async () => {
    await api.put("/admin/wa/config", { globalAuto: !(st?.config?.globalAuto) });
    loadAll();
  };

  const sendBroadcast = async () => {
    setBusy(true); setErr(""); setMsg("");
    try {
      const payload = { message };
      if (bcTarget === "category") payload.category = bcCategory;
      else {
        const numbers = numbersText.split("\n").map(s => s.trim()).filter(Boolean);
        if (!numbers.length) { setErr("Isi daftar nomor terlebih dahulu."); setBusy(false); return; }
        payload.numbers = numbers;
      }
      if (!message.trim()) { setErr("Pesan tidak boleh kosong."); setBusy(false); return; }
      const r = await api.post("/admin/wa/broadcast", payload);
      setMsg(`Broadcast ke ${r.data.total} nomor sedang dikirim dengan jeda acak 3–8 detik (ID: ${r.data.broadcastId}).`);
      if (bcTarget === "manual") setNumbersText("");
      setMessage("");
      loadAll();
    } catch (e) { setErr(errorText(e)); }
    finally { setBusy(false); }
  };

  const resendLog = async (l) => {
    try { const r = await api.post(`/admin/wa/logs/${l.id}/resend`); alert(r.data.ok ? "Terkirim ulang ✓" : `Gagal: ${r.data.error}`); loadAll(); }
    catch (e) { alert(errorText(e)); }
  };

  if (!st) return <Loading text="Memuat status WhatsApp..." />;

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <div className="eyebrow">WHATSAPP</div>
          <h1>WhatsApp Gateway</h1>
          <p>Koneksi perangkat, broadcast massal, dan log pengiriman.</p>
        </div>
        <button className="icon-button" title="Refresh" onClick={loadAll}><RefreshCw size={17} /></button>
      </div>

      {/* Status koneksi */}
      <div className="wizard-card" data-testid="wa-status-card">
        <div className="wa-status-row">
          <div className="wa-status-main">
            <span className={`wa-dot ${st.connected ? "ok" : st.gowaReachable ? "wait" : "bad"}`} />
            <div>
              <b>{st.connected ? "Terhubung ke WhatsApp" : st.gowaReachable ? "Gateway jalan — belum scan QR" : "Gateway WhatsApp tidak terjangkau"}</b>
              <span>{st.connected ? "Pesan masuk & notifikasi aktif." : st.gowaReachable ? "Klik Tampilkan QR lalu scan dari aplikasi WhatsApp." : "Jalankan: docker compose -f docker-compose.gowa.yml --env-file backend/.env up -d"}</span>
            </div>
          </div>
          <div className="wa-status-actions">
            {!st.connected && (
              <Button variant="outline" onClick={showQr} disabled={qrLoading}>
                <QrCode size={15} /> {qrLoading ? "Mengambil..." : "Tampilkan QR"}
              </Button>
            )}
            {st.connected && (
              <Button variant="outline" onClick={doLogoutWa}><LogOut size={15} /> Logout device</Button>
            )}
            <Button variant={st.config.globalAuto ? "primary" : "outline"} onClick={toggleGlobalAuto}>
              <Bot size={15} /> Auto-reply global: {st.config.globalAuto ? "ON" : "OFF"}
            </Button>
          </div>
        </div>
        <div className="wa-mini-stats">
          <span><b>{st.totalUnread}</b> chat belum dibaca</span>
          <span><b>{st.failedCount}</b> pengiriman gagal</span>
        </div>
        {err && <FormError msg={err} />}
        {qr && !qr.none && (
          <div className="wa-qr-box" data-testid="wa-qr-image">
            <img src={qr.src} alt="QR WhatsApp" />
            <p>Buka WhatsApp &gt; Perangkat Tertaut &gt; Tautkan Perangkat.<br />QR menyegarkan otomatis di gateway; klik tombol lagi bila kedaluwarsa.</p>
          </div>
        )}
        {qr && qr.none && <div className="form-info">QR belum tersedia — gateway mungkin baru saja restart. Coba lagi beberapa detik.</div>}
      </div>

      {/* Broadcast */}
      <div className="wizard-card" style={{ marginTop: 22 }}>
        <div className="eyebrow">BROADCAST MASSAL</div>
        <h2>Kirim pesan ke banyak nomor</h2>
        <p className="form-intro">Pengiriman berurutan dengan jeda acak 3–8 detik agar aman dari banned.</p>

        <div className="wa-bc-target">
          <button className={bcTarget === "manual" ? "active" : ""} onClick={() => setBcTarget("manual")} data-testid="bc-target-manual">Nomor manual</button>
          <button className={bcTarget === "category" ? "active" : ""} onClick={() => setBcTarget("category")} data-testid="bc-target-category">Per kategori kontak</button>
        </div>

        {bcTarget === "manual" ? (
          <div className="form-grid" style={{ marginTop: 14 }}>
            <label>Nomor tujuan (satu per baris)<textarea data-testid="broadcast-numbers" value={numbersText} onChange={e => setNumbersText(e.target.value)} placeholder={"08123456789\n6281234567890"} /></label>
            <label>Pesan<textarea data-testid="broadcast-message" value={message} onChange={e => setMessage(e.target.value)} placeholder="Isi pesan broadcast..." /></label>
          </div>
        ) : (
          <div className="form-grid" style={{ marginTop: 14 }}>
            <label>Kategori kontak
              <select data-testid="broadcast-category" value={bcCategory} onChange={e => setBcCategory(e.target.value)}>
                <option value="">— Pilih kategori —</option>
                {cats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label>Pesan<textarea data-testid="broadcast-message-cat" value={message} onChange={e => setMessage(e.target.value)} placeholder="Isi pesan broadcast..." /></label>
          </div>
        )}
        {msg && <div className="form-info">{msg}</div>}
        <FormError msg={err} />
        <div className="wizard-actions">
          <Button data-testid="broadcast-send-button" onClick={sendBroadcast} disabled={busy || (bcTarget === "category" && !bcCategory)}>
            <Radio size={15} /> {busy ? "Mengantrekan..." : bcTarget === "category" ? `Blast ke kategori ${bcCategory || "..."}` : "Mulai broadcast"}
          </Button>
        </div>

        {broadcasts.length > 0 && (
          <div className="wa-broadcast-list">
            {broadcasts.slice(0, 5).map(b => (
              <div key={b.id} className="wa-broadcast-row" data-testid={`broadcast-${b.id}`}>
                <b>{b.message.slice(0, 40)}{b.message.length > 40 ? "..." : ""}</b>
                <span>{formatDateTime(b.createdAt)}</span>
                <div className="quota-track"><i className={`quota-fill${b.failCount > 0 && b.done ? " fail" : ""}`} style={{ width: `${b.total ? Math.round((b.sentCount / b.total) * 100) : 0}%` }} /></div>
                <small>{b.sentCount}/{b.total}{b.done ? (b.failCount ? ` · ${b.failCount} gagal` : " · selesai") : " · mengirim..."}</small>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log pengiriman */}
      <div className="dashboard-section" style={{ marginTop: 26 }}>
        <div className="section-row">
          <div><h2>Log pengiriman</h2><p>Semua percobaan kirim WA beserta statusnya.</p></div>
          <select value={logsStatus} onChange={e => setLogsStatus(e.target.value)} className="wa-filter-select">
            <option value="">Semua status</option>
            <option value="sent">Terkirim</option>
            <option value="failed">Gagal</option>
          </select>
        </div>
        <div className="admin-table">
          <div className="admin-thead"><span>Waktu</span><span>Event</span><span>Tujuan</span><span>Pesan</span><span>Status</span><span></span></div>
          {(logs || []).map(l => (
            <div key={l.id} className="admin-tr wa-log-row" data-testid={`wa-log-${l.id}`}>
              <span>{formatDateTime(l.createdAt)}</span>
              <span><b>{l.event}</b></span>
              <span>{l.target || "-"}</span>
              <span title={l.message}>{(l.message || "").slice(0, 42)}{(l.message || "").length > 42 ? "..." : ""}</span>
              <span><StatusBadge status={l.status === "sent" ? "APPROVED" : "REJECTED"} /></span>
              <span className="coupon-actions">
                <button className="icon-button" title="Kirim ulang" onClick={() => resendLog(l)}><RefreshCw size={14} /></button>
              </span>
            </div>
          ))}
          {(logs || []).length === 0 && <div className="empty-inline">Belum ada log pengiriman.</div>}
        </div>
      </div>
    </div>
  );
}

/* ================= HALAMAN CHAT WA (INBOX) ================= */
export function WaInbox() {
  const [convs, setConvs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const loadConvs = () => {
    const params = {};
    if (filter === "unread") params.filter = "unread";
    if (filter === "AUTO" || filter === "MANUAL") params.filter = filter;
    if (q.trim()) params.q = q.trim();
    api.get("/admin/wa/conversations", { params }).then(r => setConvs(r.data)).catch(() => {});
  };
  useEffect(() => { loadConvs(); }, [filter]);
  useEffect(() => {
    const t = setTimeout(loadConvs, 350); // debounce ketik pencarian
    return () => clearTimeout(t);
  }, [q]);

  // polling semi-realtime
  useEffect(() => {
    const id = setInterval(() => { loadConvs(); if (activeId) loadMessages(activeId, false); }, 5000);
    return () => clearInterval(id);
  }, [filter, q, activeId]);

  const activeConv = convs.find(c => c.id === activeId);

  const openConv = async (c) => {
    setActiveId(c.id);
    await api.post(`/admin/wa/conversations/${c.id}/read`).catch(() => {});
    c.unreadCount = 0;
    setConvs(prev => prev.map(x => x.id === c.id ? { ...x, unreadCount: 0 } : x));
    loadMessages(c.id, true);
  };

  const loadMessages = async (cid, scroll) => {
    try {
      const r = await api.get(`/admin/wa/conversations/${cid}/messages`);
      setMessages(r.data);
      if (scroll) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
    } catch {}
  };
  useEffect(() => { if (activeId) loadMessages(activeId, false); }, []);

  const toggleMode = async () => {
    if (!activeConv) return;
    const next = activeConv.mode === "AUTO" ? "MANUAL" : "AUTO";
    await api.put(`/admin/wa/conversations/${activeId}/mode`, { mode: next });
    setConvs(prev => prev.map(x => x.id === activeId ? { ...x, mode: next } : x));
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeId) return;
    setSending(true);
    try {
      await api.post(`/admin/wa/conversations/${activeId}/reply`, { text: reply });
      setReply("");
      loadMessages(activeId, true);
      loadConvs();
    } catch (e) { alert(errorText(e)); }
    finally { setSending(false); }
  };

  return (
    <div className="dashboard wa-inbox-page">
      <div className="page-head">
        <div>
          <div className="eyebrow">CHAT WA</div>
          <h1>Inbox WhatsApp</h1>
          <p>Balas pelanggan langsung. Mode tiap chat bisa AUTO atau MANUAL.</p>
        </div>
      </div>

      <div className="wa-layout">
        {/* Kolom kiri: daftar percakapan */}
        <div className="wa-list-col">
          <div className="wa-search-row">
            <Search size={15} />
            <input data-testid="wa-search-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama / nomor..." />
          </div>
          <div className="wa-filter-tabs">
            {[["all", "Semua"], ["unread", "Belum dibaca"], ["AUTO", "Auto"], ["MANUAL", "Manual"]].map(([k, label]) => (
              <button key={k} className={filter === k ? "active" : ""} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>
          <div className="wa-list" data-testid="wa-conversation-list">
            {convs.map(c => (
              <div key={c.id} className={`wa-item ${activeId === c.id ? "active" : ""}`} onClick={() => openConv(c)} data-testid={`wa-conv-${c.phone}`}>
                <div className="wa-avatar">{(c.name || "?")[0].toUpperCase()}</div>
                <div className="wa-item-mid">
                  <div className="wa-item-top"><b>{c.name}</b><small>{shortTime(c.lastMessageAt)}</small></div>
                  <div className="wa-item-preview">{c.lastMessagePreview || "…"}</div>
                  <span className={`wa-chip ${c.mode === "AUTO" ? "auto" : "manual"}`}>
                    {c.mode === "AUTO" ? <>🤖 Auto</> : <>👤 Manual</>}
                  </span>
                </div>
                {c.unreadCount > 0 && <span className="wa-unread">{c.unreadCount}</span>}
              </div>
            ))}
            {convs.length === 0 && <div className="empty-inline">Belum ada percakapan masuk.</div>}
          </div>
        </div>

        {/* Kolom kanan: detail percakapan */}
        <div className="wa-chat-col">
          {!activeConv && (
            <div className="wa-empty-chat"><MessageCircle size={34} /><p>Pilih percakapan di sebelah kiri untuk mulai membalas.</p></div>
          )}
          {activeConv && (
            <>
              <div className="wa-chat-head">
                <div className="wa-avatar big">{(activeConv.name || "?")[0].toUpperCase()}</div>
                <div className="wa-chat-head-info">
                  <b>{activeConv.name}</b>
                  <span>+{activeConv.phone}</span>
                </div>
                <button className={`btn ${activeConv.mode === "AUTO" ? "btn-outline" : "btn-primary"} wa-mode-btn`} onClick={toggleMode} data-testid="wa-toggle-mode">
                  {activeConv.mode === "AUTO" ? <><Bot size={15} /> Mode Auto — klik untuk Manual</> : <><User size={15} /> Mode Manual — klik untuk Auto</>}
                </button>
              </div>

              <div className="wa-msgs" data-testid="wa-message-area">
                {messages.map(m => (
                  <div key={m.id} className={`wa-bubble ${m.direction === "OUT" ? "out" : "in"} ${m.status === "failed" ? "failed" : ""}`} data-testid={`wa-bubble-${m.direction}`}>
                    <p>{m.body}</p>
                    <div className="wa-meta">
                      {m.isBot && <Bot size={11} />}
                      {hhmm(m.createdAt)}
                      {m.direction === "OUT" && m.status === "failed" && " · gagal"}
                      {m.type !== "text" && ` · ${m.type}`}
                      {m.type !== "text" && m.gowaMessageId && (
                        <a className="wa-dl" href={`/api/admin/wa/media/${m.gowaMessageId}`} target="_blank" rel="noreferrer"><Download size={12} /> unduh</a>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              <div className="wa-reply-row">
                <input
                  data-testid="wa-reply-input"
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }}}
                  placeholder={activeConv.mode === "AUTO" ? "Balas manual (otomatis mematikan mode Auto utk chat ini)..." : "Ketik balasan..."}
                  disabled={sending}
                />
                <button className="btn btn-primary" data-testid="wa-send-button" onClick={sendReply} disabled={sending || !reply.trim()}><Send size={16} /></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= HALAMAN KONTAK WA ================= */
export function WaContacts() {
  const [contacts, setContacts] = useState(null);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("ALL");
  const [importText, setImportText] = useState("");
  const [importCat, setImportCat] = useState("");
  const [panel, setPanel] = useState(null); // null | "import" | "add"  (saling gantian)
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null); // kontak yang sedang diedit
  const [editForm, setEditForm] = useState({ name: "", websiteName: "", categories: [], notes: "" });
  const [addForm, setAddForm] = useState({ phone: "", name: "", websiteName: "", categories: [] });
  const togglePanel = (name) => { setMsg(""); setErr(""); setPanel(p => (p === name ? null : name)); };

  const loadAll = () => {
    const params = {};
    if (q.trim()) params.q = q.trim();
    if (catFilter !== "ALL") params.category = catFilter;
    api.get("/admin/wa/contacts", { params }).then(r => setContacts(r.data)).catch(() => {});
    api.get("/admin/wa/contacts/categories").then(r => setCats(r.data)).catch(() => {});
  };
  useEffect(() => { loadAll(); }, []);
  useEffect(() => { const t = setTimeout(loadAll, 350); return () => clearTimeout(t); }, [q, catFilter]);

  const doImport = async () => {
    const numbers = importText.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
    if (!numbers.length) { setErr("Tempel daftar nomor dulu (satu per baris)."); return; }
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await api.post("/admin/wa/contacts/import", { numbers, category: importCat.trim() });
      setMsg(`Impor selesai: ${r.data.added} baru, ${r.data.updated} diperbarui${r.data.invalidCount ? `, ${r.data.invalidCount} nomor tidak valid` : ""}.`);
      setImportText(""); setPanel(null);
      loadAll();
    } catch (e) { setErr(errorText(e)); }
    finally { setBusy(false); }
  };

  const startEdit = (c) => {
    setEdit(c.id);
    setEditForm({ name: c.name || "", websiteName: c.websiteName || "", categories: c.categories || [], notes: c.notes || "" });
  };
  const saveEdit = async () => {
    setBusy(true); setErr("");
    try {
      await api.put(`/admin/wa/contacts/${edit}`, {
        name: editForm.name,
        websiteName: editForm.websiteName,
        categories: editForm.categories,
        notes: editForm.notes
      });
      setEdit(null);
      loadAll();
    } catch (e) { setErr(errorText(e)); }
    finally { setBusy(false); }
  };

  const removeContact = async (c) => {
    if (!window.confirm(`Hapus kontak ${c.phone}?`)) return;
    await api.delete(`/admin/wa/contacts/${c.id}`).catch(e => alert(errorText(e)));
    loadAll();
  };

  const addContact = async () => {
    if (!addForm.phone.trim()) { setErr("Nomor wajib diisi."); return; }
    setBusy(true); setErr("");
    try {
      await api.post("/admin/wa/contacts", {
        phone: addForm.phone,
        name: addForm.name,
        websiteName: addForm.websiteName,
        categories: addForm.categories
      });
      setMsg("Kontak ditambahkan.");
      setAddForm({ phone: "", name: "", websiteName: "", categories: [] });
      setPanel(null);
      loadAll();
    } catch (e) { setErr(errorText(e)); }
    finally { setBusy(false); }
  };

  if (!contacts) return <Loading text="Memuat kontak WA..." />;

  return (
    <div className="dashboard">
      <div className="page-head">
        <div>
          <div className="eyebrow">WHATSAPP</div>
          <h1>Kontak WA</h1>
          <p>Buku nomor otomatis: chat masuk & pesanan tercatat sendiri. Nama, web, dan kategori bisa dilengkapi.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="outline" data-testid="wa-import-toggle" onClick={() => togglePanel("import")}><Download size={15} /> Impor nomor</Button>
          <Button data-testid="wa-add-toggle" onClick={() => togglePanel("add")}><Plus size={15} /> Tambah</Button>
        </div>
      </div>

      {msg && <div className="form-info">{msg}</div>}
      <FormError msg={err} />

      {/* Impor massal (untuk hasil scraping grup) — muncul sendirian */}
      {panel === "import" && (
        <div className="wizard-card" data-testid="wa-import-card">
          <div className="eyebrow">IMPOR MASSAL</div>
          <h2>Tempel daftar nomor</h2>
          <p className="form-intro">Sesuai untuk hasil scraping grup WhatsApp. Satu nomor per baris � format bebas (08xx / 62xx / +62, dengan atau tanpa tanda baca). Nomor yang sudah ada hanya diperbarui kategorinya, tidak dobel.</p>
          <div className="form-grid">
            <label>Daftar nomor<textarea data-testid="wa-import-numbers" value={importText} onChange={e => setImportText(e.target.value)} placeholder={"0812xxxx\n62813xxx\n+62 812 xxx"} /></label>
            <label>Kategori (opsional)
              <CategoryPicker allCats={cats} value={importCat} onChange={v => setImportCat(v)} multiple={false} placeholder="Pilih kategori yang ada / ketik baru..." />
            </label>
          </div>
          <div className="wizard-actions">
            <Button variant="outline" onClick={() => setPanel(null)}>Batal</Button>
            <Button data-testid="wa-import-submit" onClick={doImport} disabled={busy}>{busy ? "Mengimpor..." : "Impor sekarang"}</Button>
          </div>
        </div>
      )}

      {/* Tambah manual — muncul sendirian */}
      {panel === "add" && (
        <div className="wizard-card">
          <div className="eyebrow">KONTAK BARU</div>
          <div className="form-grid">
            <label>Nomor<input data-testid="wa-add-phone" value={addForm.phone} onChange={e => setAddForm({ ...addForm, phone: e.target.value })} placeholder="08123456789" /></label>
            <label>Nama (opsional)<input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })} /></label>
            <label>Nama web (opsional)<input value={addForm.websiteName} onChange={e => setAddForm({ ...addForm, websiteName: e.target.value })} /></label>
            <label>Kategori
              <CategoryPicker allCats={cats} value={addForm.categories} onChange={v => setAddForm({ ...addForm, categories: v })} placeholder="Ketik kategori baru / pilih..." />
            </label>
          </div>
          <div className="wizard-actions">
            <Button variant="outline" onClick={() => setPanel(null)}>Batal</Button>
            <Button data-testid="wa-add-submit" onClick={addContact} disabled={busy}>Simpan kontak</Button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="wa-contact-filter">
        <div className="wa-search-row grow"><Search size={15} /><input data-testid="wa-contact-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama / nomor / web..." /></div>
        <select data-testid="wa-category-filter" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="ALL">Semua kategori</option>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span className="wa-contact-count">{contacts.length} kontak</span>
      </div>

      {/* Tabel */}
      <div className="admin-table">
        <div className="admin-thead wa-contact-thead"><span>Nomor</span><span>Nama</span><span>Website</span><span>Kategori</span><span>Sumber</span><span></span></div>
        {contacts.map(c => (
          <div key={c.id} className="admin-tr wa-contact-row" data-testid={`wa-contact-${c.phone}`}>
            {edit === c.id ? (
              <>
                <span><b>+{c.phone}</b></span>
                <span><input className="wa-inline-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></span>
                <span><input className="wa-inline-input" value={editForm.websiteName} onChange={e => setEditForm({ ...editForm, websiteName: e.target.value })} /></span>
                <span><CategoryPicker allCats={cats} value={editForm.categories} onChange={v => setEditForm({ ...editForm, categories: v })} placeholder="Ketik kategori baru / pilih..." /></span>
                <span>-</span>
                <span className="coupon-actions">
                  <button className="icon-button" title="Simpan" onClick={saveEdit}><CheckCircle2 size={15} /></button>
                  <button className="icon-button" title="Batal" onClick={() => setEdit(null)}><XCircle size={15} /></button>
                </span>
              </>
            ) : (
              <>
                <span><b>+{c.phone}</b>{c.userId && <small title="Terhubung ke akun user UsahaKu"> � user terdaftar</small>}</span>
                <span>{c.name || "-"}</span>
                <span>{c.websiteId
                  ? <b className="wa-web-link">{c.websiteName || "website"}</b>
                  : (c.websiteName || "-")}</span>
                <span className="wa-cat-cell">
                  {(c.categories || []).length ? c.categories.map(k => <span key={k} className="wa-cat-chip">{k}</span>) : "-"}
                </span>
                <span><StatusBadge status={c.source === "inbox" ? "PENDING" : c.source === "order" ? "APPROVED" : "DRAFT"} /></span>
                <span className="coupon-actions">
                  <button className="icon-button" title="Edit" onClick={() => startEdit(c)}><Pencil size={14} /></button>
                  <button className="icon-button danger" title="Hapus" onClick={() => removeContact(c)}><Trash2 size={14} /></button>
                </span>
              </>
            )}
          </div>
        ))}
        {contacts.length === 0 && <div className="empty-inline">Belum ada kontak. Impor nomor dari scraping grup, atau biarkan terisi otomatis dari chat masuk.</div>}
      </div>
    </div>
  );
}
