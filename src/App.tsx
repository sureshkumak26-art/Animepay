import { useEffect, useState, type FormEvent } from "react";
import { Activity, ArrowDownLeft, ArrowUpRight, BarChart3, Bell, BookOpen, CheckCircle2, ChevronDown, CircleHelp, Code2, CreditCard, Download, Eye, FileKey2, Globe2, LayoutDashboard, LifeBuoy, Menu, Plus, Search, Settings, ShieldCheck, Wallet, Webhook, X } from "lucide-react";
import Landing from "./Landing";
import MerchantAuth from "./MerchantAuth";
import type { ReactNode } from "react";

type Payment = { id: string; customer: string; asset: string; amount: string; status: string; date: string };
type Summary = { mode: string; availableBalance: string; pendingBalance: string; totalPayments: number; successfulPayments: number; volumeUsd: string; recentPayments: Payment[] };
const nav = [
  { label: "Overview", icon: LayoutDashboard }, { label: "Payments", icon: CreditCard }, { label: "Balances", icon: Wallet },
  { label: "Withdrawals", icon: ArrowUpRight }, { label: "API Keys", icon: FileKey2 }, { label: "Webhooks", icon: Webhook },
  { label: "Analytics", icon: BarChart3 }, { label: "API Docs", icon: BookOpen }, { label: "Settings", icon: Settings }, { label: "Support", icon: LifeBuoy }
];
const emptySummary: Summary = { mode:"live", availableBalance:"0.00", pendingBalance:"0.00", totalPayments:0, successfulPayments:0, volumeUsd:"0.00", recentPayments:[] };
function App() {
  const path = window.location.pathname;
  if (path.startsWith("/admin")) return <AdminPage />;
  if (path.startsWith("/checkout")) return <CheckoutPage />;
  if (path === "/login" || path === "/signup") return <MerchantAuth mode={path === "/signup" ? "signup" : "login"} />;
  if (path !== "/dashboard") return <Landing />;
  return <MerchantGate><DashboardApp /></MerchantGate>;
}
function MerchantGate({children}:{children:ReactNode}) {
  const [checking,setChecking] = useState(true);
  useEffect(() => {
    fetch("/api/merchant/me",{credentials:"same-origin"}).then(r=>{
      if(!r.ok) { window.location.replace("/login"); return; }
      setChecking(false);
    }).catch(()=>window.location.replace("/login"));
  },[]);
  return checking ? <div className="admin-loading">AnimePay · Verifying your merchant account…</div> : <>{children}</>;
}
function DashboardApp() {
function App() {
  if (window.location.pathname.startsWith("/admin")) return <AdminPage />;
  if (window.location.pathname.startsWith("/checkout")) return <CheckoutPage />;
  if (window.location.pathname !== "/dashboard") return <Landing />;
  const [page,setPage] = useState("Overview");
  const [summary,setSummary] = useState<Summary>(emptySummary);
  const [merchant,setMerchant] = useState<{name:string;slug:string;email:string}|null>(null);
  const [menu,setMenu] = useState(false);
  const [notice,setNotice] = useState("");
  useEffect(()=>{
    fetch("/api/merchant/summary",{credentials:"same-origin"}).then(async r=>{if(r.status===401){window.location.replace("/login");return null;}if(!r.ok)throw new Error("Payment data is temporarily unavailable.");return r.json();}).then(d=>d&&setSummary(d)).catch(e=>setNotice(e.message));
    fetch("/api/merchant/me",{credentials:"same-origin"}).then(r=>r.ok?r.json():null).then(d=>d&&setMerchant({name:d.merchant.name,slug:d.merchant.slug,email:d.user.email})).catch(()=>{});
  },[]);
  const action = (name:string) => setNotice(name === "Create payment" ? "Payment creation is not enabled in the merchant dashboard yet." : name === "Withdrawal request" ? "Crypto withdrawals are currently disabled." : name + " is not available yet.");
  async function logout(){ await fetch("/api/merchant/logout",{method:"POST",credentials:"same-origin"}); window.location.assign("/login"); }
  const title = page === "Overview" ? "Welcome, " + (merchant?.name || "Merchant") : page;
  return <div className="app-shell">
    <aside className={menu?"sidebar open":"sidebar"}>
      <div className="brand"><div className="brand-mark">A</div><div><b>AnimePay</b><small>PAYMENT GATEWAY</small></div><button className="mobile-close" onClick={()=>setMenu(false)}><X size={18}/></button></div>
      <div className="workspace"><span className="avatar">MP</span><div><b>{merchant?.name || "Merchant workspace"}</b><small>Merchant workspace</small></div></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav>{nav.map(n=><button key={n.label} className={page===n.label?"nav-item active":"nav-item"} onClick={()=>{setPage(n.label);setMenu(false);setNotice("");}}><n.icon size={17}/><span>{n.label}</span>{n.label==="Payments"&&<i>12</i>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="secure"><ShieldCheck size={18}/><div><b>Protected workspace</b><small>Authenticated account</small></div></div><div className="user"><div className="avatar user-avatar">MP</div><div><b>{merchant?.name || "Merchant"}</b><small>{merchant?.email || ""}</small></div></div><button className="merchant-logout" onClick={logout}>Sign out ↗</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="mobile-menu" onClick={()=>setMenu(true)}><Menu/></button><div className="crumb">Workspace <span>/</span> <b>{page}</b></div><div className="top-actions"><span className="environment"><span/> LIVE ACCOUNT</span><button className="icon-btn" onClick={()=>action("Notifications")}><Bell size={18}/></button><div className="top-avatar">MP</div></div></header>
      <div className="content"><div className="page-head"><div><div className="eyebrow">MERCHANT CONSOLE <span>•</span> {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</div><h1>{title}</h1><p>{page==="Overview"?"Here’s what’s happening with your payments today.":"Manage your AnimePay merchant account and payment operations."}</p></div><button className="primary" onClick={()=>action("Create payment")}><Plus size={17}/> Create payment</button></div>
      {notice&&<div className="notice"><ShieldCheck size={17}/>{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}
      {page==="Overview"?<>
      <section className="stats"><Stat label="Successful payment volume" value={"$"+summary.volumeUsd} sub="Verified completed payments" icon={Wallet}/><Stat label="Pending payment volume" value={"$"+summary.pendingBalance} sub="Payments awaiting confirmation" icon={Activity}/><Stat label="Payment records" value={String(summary.totalPayments)} sub="Most recent 100 records" icon={ArrowDownLeft}/><Stat label="Successful payments" value={String(summary.successfulPayments)} sub="Provider-verified completions" icon={CheckCircle2}/></section>
      <div className="two-col"><section className="panel chart-panel"><div className="panel-head"><div><h2>Payment activity</h2><p>Verified activity from your merchant account</p></div></div>{summary.recentPayments.length===0?<div className="chart-empty">No payment activity yet. Your verified payments will appear here.</div>:<PaymentTable rows={summary.recentPayments.slice(0,5)}/>}</section>
      <section className="panel quick-panel"><div className="panel-head"><div><h2>Quick actions</h2><p>Merchant tools</p></div></div><Quick icon={Plus} title="Create payment" desc="Create a customer checkout invoice" onClick={()=>action("Create payment")}/><Quick icon={ArrowUpRight} title="Withdrawals" desc="Crypto withdrawals are disabled" onClick={()=>setPage("Withdrawals")}/><Quick icon={Code2} title="View API docs" desc="Explore integration endpoints" onClick={()=>setPage("API Docs")}/><Quick icon={Webhook} title="Configure webhook" desc="Webhook settings" onClick={()=>setPage("Webhooks")}/></section></div>
      <section className="panel table-panel"><div className="panel-head"><div><h2>Recent payments</h2><p>Latest verified payment activity</p></div><button className="text-btn" onClick={()=>setPage("Payments")}>View all <ArrowUpRight size={14}/></button></div><PaymentTable rows={summary.recentPayments}/></section></>:<GenericPage page={page} onAction={action}/>}
      <footer>© 2026 AnimePay <span>•</span> Secure merchant workspace <span className="footer-right"><ShieldCheck size={13}/> Authenticated session</span></footer>
      </div>
    </main>
  </div>;
}


function AdminPage() {
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [admin,setAdmin] = useState<{email:string;role:string}|null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const [section,setSection] = useState("Overview");
  const [readiness,setReadiness] = useState<{paymentDatabase:boolean;nowpayments:boolean;withdrawals:boolean}|null>(null);
  useEffect(()=>{ fetch("/api/admin/me",{credentials:"same-origin"}).then(r=>r.ok?r.json():null).then(d=>{if(d?.authenticated)setAdmin(d.admin);}).catch(()=>{}).finally(()=>setLoading(false)); },[]);
  useEffect(()=>{ if(admin) fetch("/api/admin/readiness",{credentials:"same-origin"}).then(r=>r.ok?r.json():null).then(d=>d&&setReadiness(d)).catch(()=>{}); },[admin]);
  async function login(e:FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const r=await fetch("/api/admin/login",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
      const raw=await r.text(); let d:{error?:string;admin?:{email:string;role:string}}; try { d=JSON.parse(raw); } catch { throw new Error("Vercel API returned a non-JSON page. Please wait for the latest deployment and try again."); } if(!r.ok) throw new Error(d.error||"Login failed");
      if(!d.admin) throw new Error("Login response is missing admin details. Please try again.");
      setAdmin(d.admin); setPassword("");
    } catch(err) { setError(err instanceof Error?err.message:"Unable to sign in."); }
    finally { setLoading(false); }
  }
  async function logout(){ await fetch("/api/admin/logout",{method:"POST",credentials:"same-origin"}); setAdmin(null); setSection("Overview"); }
  if(loading) return <div className="admin-loading">AnimePay · Checking admin session…</div>;
  if(!admin) return <div className="admin-login-shell"><div className="admin-login-card"><a className="admin-brand" href="/"><span>A</span> AnimePay <small>ADMIN</small></a><div className="admin-lock">⌑</div><h1>Admin sign in</h1><p>Sign in to manage the AnimePay platform.</p><form onSubmit={login}><label htmlFor="admin-email">Email address</label><input id="admin-email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/><button className="admin-login-button" disabled={loading}>{loading?"Signing in…":"Sign in securely"}</button>{error&&<div className="admin-error">{error}</div>}</form><small className="admin-login-foot">Restricted administrator access · No public registration</small></div></div>;
  const items=["Overview","Payments","Merchants","Withdrawals","Provider","Audit log","Settings"];
  return <div className="admin-shell"><aside className="admin-sidebar"><a className="admin-brand" href="/"><span>A</span> AnimePay <small>ADMIN</small></a><div className="admin-side-label">CONTROL CENTER</div>{items.map(x=><button key={x} className={section===x?"admin-nav active":"admin-nav"} onClick={()=>setSection(x)}>{x}</button>)}<div className="admin-side-bottom"><span>{admin.email}</span><button onClick={logout}>Sign out ↗</button></div></aside><main className="admin-main"><header className="admin-top"><div><small>ANIMEPAY / ADMIN</small><h1>{section}</h1></div><span className="admin-role">● ADMIN</span></header><div className="admin-content">{section==="Merchants"?<MerchantManagement/>:section==="Overview"? <><div className="admin-welcome"><div><b>Platform control center</b><p>Admin sections are accessible. Live data appears when the production database and provider configuration are ready; sensitive payout actions remain disabled.</p></div><span>SECURE SESSION</span></div><div className="admin-stat-grid">{[["Payments","—"],["Merchants","—"],["Pending withdrawals","—"],["Payment volume","—"]].map(x=><div className="admin-stat" key={x[0]}><small>{x[0]}</small><strong>{x[1]}</strong><span>{readiness?.paymentDatabase?"Live data loads in section":"Waiting for database connection"}</span></div>)}</div><section className="admin-panel"><h2>System readiness</h2><div className="admin-readiness"><span>Admin authentication</span><b className="ready">ACTIVE</b></div><div className="admin-readiness"><span>Payment database</span><b className={readiness?.paymentDatabase?"ready":"not-ready"}>{readiness?readiness.paymentDatabase?"CONNECTED":"NOT CONNECTED":"CHECKING…"}</b></div><div className="admin-readiness"><span>NOWPayments live processing</span><b className={readiness?.nowpayments?"ready":"not-ready"}>{readiness?readiness.nowpayments?"CONFIGURED":"NOT CONNECTED":"CHECKING…"}</b></div><div className="admin-readiness"><span>Withdrawal controls</span><b className="not-ready">DISABLED</b></div></section></>:section==="Provider"?<ProviderPanel readiness={readiness}/>:<AdminSectionPanel section={section} readiness={readiness}/>}</div></main></div>;
}


function AdminSectionPanel({section,readiness}:{section:string;readiness:{paymentDatabase:boolean;nowpayments:boolean;withdrawals:boolean}|null}) {
  const [data,setData]=useState<any>(null);
  const [error,setError]=useState("");
  useEffect(()=>{ if(section==="Payments"||section==="Audit log"||section==="Analytics") fetch("/api/admin/overview",{credentials:"same-origin"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load admin data.");setData(d);}).catch(e=>setError(e.message)); },[section]);
  const payments=Array.isArray(data?.payments)?data.payments:[];
  if(section==="Payments") return <section className="admin-panel"><h2>Payment operations</h2><p>Live records are loaded from the protected payment database. Only verified provider events update the ledger.</p>{error&&<p className="admin-error">{error}</p>}{data===null?<p>Loading payment records…</p>:!data.dataConnected?<p className="not-ready">Database is not connected. Configure Supabase server credentials and table access.</p>:payments.length===0?<p>No payment records found yet.</p>:<div className="table-wrap"><table><thead><tr><th>ORDER</th><th>PAYMENT ID</th><th>AMOUNT</th><th>STATUS</th><th>CREATED</th></tr></thead><tbody>{payments.map((p:any)=><tr key={p.id||p.order_id}><td>{p.order_id||"—"}</td><td>{p.payment_id||"—"}</td><td>{p.price_amount||"—"} {p.price_currency||""}</td><td>{p.payment_status||"—"}</td><td>{p.created_at?new Date(p.created_at).toLocaleString():"—"}</td></tr>)}</tbody></table></div>}</section>;
  if(section==="Withdrawals") return <section className="admin-panel"><h2>Withdrawal controls</h2><p>Admin access is available, but payouts remain deliberately disabled.</p><div className="admin-readiness"><span>Withdrawal API</span><b className="not-ready">DISABLED</b></div><p>Enable only after custody integration, identity/compliance checks, limits, ledger reconciliation, 2FA and an approval workflow are implemented and tested.</p></section>;
  if(section==="API Keys") return <section className="admin-panel"><h2>API key management</h2><p>Admin section is open. Merchant API key issuance and revocation are not implemented yet, so no keys can be generated here.</p><div className="admin-readiness"><span>Secret key storage</span><b className="not-ready">NOT IMPLEMENTED</b></div><p>Provider credentials remain server-side and are never exposed in this panel.</p></section>;
  if(section==="Webhooks") return <section className="admin-panel"><h2>Webhook activity</h2><p>NOWPayments IPN verification is handled by the server endpoint. Merchant-configurable webhook destinations, retry queue and delivery logs are not implemented yet.</p><div className="admin-readiness"><span>Provider IPN endpoint</span><b className={readiness?.nowpayments?"ready":"not-ready"}>{readiness?.nowpayments?"CONFIGURED":"CHECK CONFIGURATION"}</b></div></section>;
  if(section==="Analytics") return <section className="admin-panel"><h2>Platform analytics</h2><p>Analytics are based on stored payment records, not sample/demo totals.</p>{error&&<p className="admin-error">{error}</p>}{data===null?<p>Loading analytics…</p>:<><div className="admin-readiness"><span>Database</span><b className={data.dataConnected?"ready":"not-ready"}>{data.dataConnected?"CONNECTED":"NOT CONNECTED"}</b></div><div className="admin-readiness"><span>Records returned</span><b>{payments.length}</b></div><p>Showing up to 100 most recent records. Full date-range and conversion reporting is not implemented yet.</p></>}</section>;
  if(section==="Audit log") return <section className="admin-panel"><h2>Audit log</h2><p>Audit log page is accessible. Persistent admin action logging has not been implemented, so this page does not claim to show a complete activity history.</p><div className="admin-readiness"><span>Audit event storage</span><b className="not-ready">NOT IMPLEMENTED</b></div></section>;
  if(section==="Settings") return <section className="admin-panel"><h2>Platform settings</h2><p>Core environment settings are managed securely in Vercel. Secret values cannot be edited or displayed in this browser panel.</p><div className="admin-readiness"><span>Admin authentication</span><b className="ready">ACTIVE</b></div><div className="admin-readiness"><span>Payment database</span><b className={readiness?.paymentDatabase?"ready":"not-ready"}>{readiness===null?"CHECKING…":readiness.paymentDatabase?"CONNECTED":"NOT CONNECTED"}</b></div><div className="admin-readiness"><span>NOWPayments credentials</span><b className={readiness?.nowpayments?"ready":"not-ready"}>{readiness===null?"CHECKING…":readiness.nowpayments?"DETECTED":"NOT DETECTED"}</b></div><div className="admin-readiness"><span>Withdrawals</span><b className="not-ready">DISABLED</b></div></section>;
  return <section className="admin-panel"><h2>{section}</h2><p>This admin section is available.</p></section>;
}

function ProviderPanel({readiness}:{readiness:{paymentDatabase:boolean;nowpayments:boolean;withdrawals:boolean}|null}) {
  const configured = readiness?.nowpayments === true;
  const databaseReady = readiness?.paymentDatabase === true;
  return <section className="admin-panel">
    <h2>NOWPayments provider</h2>
    <p>Credentials are checked on the server. Secret values are never displayed in this dashboard.</p>
    <div className="admin-readiness"><span>API key + IPN secret</span><b className={configured?"ready":"not-ready"}>{readiness===null?"CHECKING…":configured?"ENVIRONMENT VARIABLES DETECTED":"NOT DETECTED"}</b></div>
    <div className="admin-readiness"><span>Payment database</span><b className={databaseReady?"ready":"not-ready"}>{readiness===null?"CHECKING…":databaseReady?"CONNECTED":"NOT CONNECTED"}</b></div>
    {configured&&databaseReady?<p className="merchant-notice">Both credentials are present and the payment database is reachable. This checks configuration presence only; it does not verify that the NOWPayments API key is valid.</p>:<p className="admin-error">Setup is incomplete. In Vercel → Project → Settings → Environment Variables, confirm NOWPAYMENTS_API_KEY and NOWPAYMENTS_IPN_SECRET are set for Production, then redeploy.</p>}
    <p>Withdrawals remain disabled.</p>
  </section>;
}

type MerchantMember = { id?: string; email: string; role: string; status: string };
type MerchantRecord = { id: string; name: string; slug: string; contact_email: string | null; status: string; created_at: string; members: MerchantMember[] };
function MerchantManagement() {
  const [merchants,setMerchants] = useState<MerchantRecord[]>([]);
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [memberEmail,setMemberEmail] = useState("");
  const [memberRole,setMemberRole] = useState("developer");
  const [selected,setSelected] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  async function load() {
    const response = await fetch("/api/admin/merchants",{credentials:"same-origin"});
    const data = await response.json();
    if(!response.ok) throw new Error(data.error||"Unable to load merchants.");
    setMerchants(data.merchants||[]);
  }
  useEffect(()=>{load().catch(e=>setError(e.message));},[]);
  async function createMerchant(e:FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const response=await fetch("/api/admin/merchants",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,contact_email:email})});
      const data=await response.json(); if(!response.ok) throw new Error(data.error||"Merchant creation failed.");
      setName("");setEmail("");setNotice("Merchant account created and saved.");await load();
    } catch(e){setError(e instanceof Error?e.message:"Merchant creation failed.");}
    finally{setBusy(false);}
  }
  async function updateMerchant(id:string,patch:Record<string,string>) {
    setError("");setNotice("");
    try { const response=await fetch("/api/admin/merchants/"+id,{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)});const data=await response.json();if(!response.ok)throw new Error(data.error||"Update failed.");setNotice("Merchant updated.");await load(); }
    catch(e){setError(e instanceof Error?e.message:"Update failed.");}
  }
  async function addMember(e:FormEvent) {
    e.preventDefault(); if(!selected)return;setBusy(true);setError("");setNotice("");
    try {const response=await fetch("/api/admin/merchants/"+selected+"/members",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:memberEmail,role:memberRole})});const data=await response.json();if(!response.ok)throw new Error(data.error||"Could not add member.");setMemberEmail("");setNotice("Role assignment saved as an invitation.");await load();}
    catch(e){setError(e instanceof Error?e.message:"Could not add member.");}
    finally{setBusy(false);}
  }
  async function updateMember(id:string,patch:Record<string,string>){try{const response=await fetch("/api/admin/merchant-members/"+id,{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)});const data=await response.json();if(!response.ok)throw new Error(data.error||"Member update failed.");setNotice("Member permissions updated.");await load();}catch(e){setError(e instanceof Error?e.message:"Member update failed.");}}
  return <div className="merchant-admin">
    <div className="merchant-intro"><div><b>Merchant accounts</b><p>Create persistent merchant workspaces and assign role records. Member invitations are stored as pending until merchant sign-in/email delivery is connected.</p></div><span>{merchants.length} ACCOUNTS</span></div>
    <form className="merchant-create" onSubmit={createMerchant}><h3>Create merchant</h3><div className="merchant-fields"><label>Business name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Example: Anime Cloud" minLength={2} required/></label><label>Owner email (optional)<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="owner@example.com"/></label><button className="admin-login-button" disabled={busy}>{busy?"Saving…":"Create account"}</button></div></form>
    {error&&<div className="admin-error merchant-message">{error}</div>}{notice&&<div className="merchant-notice">{notice}</div>}
    <section className="merchant-list"><h3>Saved merchants</h3>{merchants.length===0?<p className="merchant-empty">No merchant accounts yet. Create the first account above.</p>:merchants.map(m=><article className="merchant-card" key={m.id}><div className="merchant-card-top"><div><b>{m.name}</b><small>{m.slug} · {m.contact_email||"No contact email"}</small></div><span className={m.status==="active"?"merchant-active":"merchant-suspended"}>{m.status.toUpperCase()}</span></div><div className="merchant-card-meta"><span>{m.members?.length||0} members</span><span>Created {new Date(m.created_at).toLocaleDateString()}</span><button onClick={()=>updateMerchant(m.id,{status:m.status==="active"?"suspended":"active"})}>{m.status==="active"?"Suspend":"Reactivate"}</button></div>{m.members?.length>0&&<div className="merchant-members"><b>Team & roles</b>{m.members.map(member=><div className="merchant-member" key={member.id||member.email}><span>{member.email}<small>{member.status}</small></span><select aria-label={"Role for "+member.email} value={member.role} onChange={e=>member.id&&updateMember(member.id,{role:e.target.value})}><option value="owner">Owner</option><option value="admin">Admin</option><option value="developer">Developer</option><option value="viewer">Viewer</option></select></div>)}</div>}</article>)}</section>
    {merchants.length>0&&<form className="merchant-create merchant-member-form" onSubmit={addMember}><h3>Assign team role</h3><div className="merchant-fields"><label>Merchant<select value={selected} onChange={e=>setSelected(e.target.value)} required><option value="">Select merchant</option>{merchants.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><label>Member email<input type="email" value={memberEmail} onChange={e=>setMemberEmail(e.target.value)} placeholder="team@example.com" required/></label><label>Role<select value={memberRole} onChange={e=>setMemberRole(e.target.value)}><option value="owner">Owner</option><option value="admin">Admin</option><option value="developer">Developer</option><option value="viewer">Viewer</option></select></label><button className="admin-login-button" disabled={busy||!selected}>{busy?"Saving…":"Save role"}</button></div></form>}
    <p className="merchant-permission-note"><b>Role model:</b> Owner — full workspace control · Admin — workspace management · Developer — integration settings · Viewer — read-only access. These assignments are stored in Supabase; merchant login and email invitations are not active yet.</p>
  </div>;
}

function CheckoutPage() {
  const params = new URLSearchParams(window.location.search);
  const amount = params.get("amount") || "25.00";
  const currency = params.get("currency") || "USD";
  const invoice = params.get("invoice") || "AP-DEMO-001";
  const [asset,setAsset] = useState("usdttrc20");
  const [network,setNetwork] = useState("TRON");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const assets = [
    {id:"usdttrc20",name:"Tether USD",ticker:"USDT",network:"TRON",symbol:"₮"},
    {id:"usdterc20",name:"Tether USD",ticker:"USDT",network:"Ethereum",symbol:"₮"},
    {id:"btc",name:"Bitcoin",ticker:"BTC",network:"Bitcoin",symbol:"₿"},
    {id:"eth",name:"Ethereum",ticker:"ETH",network:"Ethereum",symbol:"Ξ"},
    {id:"usdc",name:"USD Coin",ticker:"USDC",network:"Ethereum",symbol:"＄"}
  ];
  const selected=assets.find(x=>x.id===asset)||assets[0];
  async function createPayment(){
    setBusy(true);setMessage("");
    try {
      const response=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({price_amount:Number(amount),price_currency:currency.toLowerCase(),pay_currency:asset,order_id:invoice})});
      const data=await response.json();
      setMessage(data.error||"Payment request could not be created.");
    } catch { setMessage("Checkout API is unavailable. Please try again later."); }
    finally { setBusy(false); }
  }
  return <div className="checkout-shell">
    <header className="checkout-top"><a className="checkout-brand" href="/"><span>A</span> AnimePay</a><div><ShieldCheck size={15}/> Secure checkout preview</div></header>
    <main className="checkout-main">
      <div className="checkout-intro"><span className="checkout-kicker">PAYMENT REQUEST</span><h1>Complete your payment</h1><p>Choose a cryptocurrency and network to continue.</p></div>
      <div className="checkout-layout">
        <section className="checkout-card">
          <div className="checkout-card-head"><div><span className="merchant-avatar">AC</span><div><b>Anime Cloud</b><small>Payment to merchant</small></div></div><span className="demo-pill">DEMO</span></div>
          <div className="checkout-amount"><small>YOU ARE PAYING</small><strong>{currency.toUpperCase()} {amount}</strong><span>Invoice {invoice}</span></div>
          <label className="checkout-label" htmlFor="pay-asset">Select payment currency</label>
          <div className="asset-options">{assets.map(item=><button key={item.id} className={asset===item.id?"asset-option selected":"asset-option"} onClick={()=>{setAsset(item.id);setNetwork(item.network);}}><span>{item.symbol}</span><div><b>{item.ticker}</b><small>{item.name}</small></div><i>{item.network}</i></button>)}</div>
          <div className="network-line"><span>Network</span><b>{network}</b></div>
          <button className="checkout-submit" onClick={createPayment} disabled={busy}>{busy?"Creating…":"Continue to payment"} <ArrowUpRight size={17}/></button>
          {message&&<div className="checkout-message">{message}</div>}
          <p className="checkout-disclaimer">This is a checkout UI preview. Payment creation is disabled until a verified payment provider is connected.</p>
        </section>
        <aside className="checkout-side">
          <div className="qr-placeholder"><div className="qr-icon">▦</div><b>Payment QR appears here</b><small>Generated securely after invoice creation</small></div>
          <div className="checkout-secure"><ShieldCheck size={17}/><div><b>Protected payment flow</b><small>Always verify the address, network and amount before sending crypto.</small></div></div>
          <div className="checkout-help"><CircleHelp size={16}/><span>Need help? Contact the merchant.</span></div>
        </aside>
      </div>
      <footer className="checkout-footer">Powered by <b>AnimePay</b> <span>•</span> Never send funds to an address shown outside this checkout.</footer>
    </main>
  </div>;
}

function Stat({label,value,sub,icon:Icon}:{label:string;value:string;sub:string;icon:any}){return <div className="stat-card"><div className="stat-top"><span>{label}</span><i><Icon size={17}/></i></div><strong>{value}</strong><small>{sub}</small></div>}
function Quick({icon:Icon,title,desc,onClick}:{icon:any;title:string;desc:string;onClick:()=>void}){return <button className="quick-row" onClick={onClick}><span><Icon size={17}/></span><div><b>{title}</b><small>{desc}</small></div><ArrowUpRight size={15}/></button>}
function PaymentTable({rows}:{rows:Payment[]}){return <div className="table-wrap"><table><thead><tr><th>PAYMENT ID</th><th>CUSTOMER</th><th>ASSET</th><th>AMOUNT</th><th>STATUS</th><th>DATE</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td className="id">{r.id}</td><td>{r.customer}</td><td>{r.asset}</td><td className="amount">{r.amount}</td><td><span className={"status "+r.status}>{r.status}</span></td><td className="muted">{r.date}</td></tr>)}</tbody></table></div>}
function GenericPage({page,onAction}:{page:string;onAction:(s:string)=>void}){
 const [search,setSearch]=useState("");
 const rows=["USDT · TRON","USDT · Ethereum","Bitcoin","Ethereum","USD Coin"];
 const descriptions:Record<string,string>={Payments:"Review invoices and incoming payment activity.",Balances:"View asset balances and settlement availability.",Withdrawals:"Review payout requests and withdrawal controls.", "API Keys":"Manage server-side API credentials for your integration.",Webhooks:"Configure event destinations and delivery retries.",Analytics:"Understand volume, conversion, and asset distribution.","API Docs":"Connect your store with the AnimePay merchant API.",Settings:"Manage workspace preferences and security.",Support:"Get help with your merchant integration."};
 return <section className="panel generic"><div className="panel-head"><div><h2>{page}</h2><p>{descriptions[page]||"Manage your merchant workspace."}</p></div>{["Payments","Withdrawals"].includes(page)&&<button className="primary" onClick={()=>onAction(page==="Payments"?"Create payment":"Request withdrawal")}><Plus size={16}/> {page==="Payments"?"New payment":"New request"}</button>}</div>
 {page==="Payments"?<><div className="toolbar"><div className="search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search payment ID or customer"/></div><button className="select-btn" onClick={()=>onAction("Export") }><Download size={15}/> Export</button></div><PaymentTable rows={fallback.recentPayments.filter(p=>(p.id+p.customer).toLowerCase().includes(search.toLowerCase()))}/></>:
 page==="Balances"?<div className="asset-grid">{rows.map((r,i)=><div className="asset-card" key={r}><span className="coin">{["₮","₮","₿","Ξ","＄"][i]}</span><b>{r}</b><strong>0.00</strong><small>$0.00 USD equivalent</small></div>)}</div>:
 page==="Withdrawals"?<div className="empty-state"><Wallet size={30}/><h3>Withdrawal requests are disabled</h3><p>Live payouts require an approved custody provider, verified merchant identity, ledger reconciliation, withdrawal limits, 2FA, and admin approval.</p><button className="primary" onClick={()=>onAction("Withdrawal request")}>Preview request form</button></div>:
 page==="API Keys"?<div className="empty-state"><FileKey2 size={30}/><h3>No API keys created</h3><p>Keys will be generated securely by the backend and shown only once. Never store secret keys in browser code.</p><button className="primary" onClick={()=>onAction("API key creation")}> <Plus size={16}/> Generate API key</button></div>:
 page==="Webhooks"?<div className="empty-state"><Webhook size={30}/><h3>No webhook endpoints</h3><p>Add a HTTPS endpoint to receive payment events after signature verification is implemented.</p><button className="primary" onClick={()=>onAction("Webhook configuration")}> <Plus size={16}/> Add endpoint</button></div>:
 page==="API Docs"?<div className="docs"><div><b>Base URL</b><code>https://api.your-domain.com/v1</code></div><div><b>Create an invoice</b><pre>{'POST /payments\nAuthorization: Bearer YOUR_SECRET_KEY\nContent-Type: application/json\n\n{ "price_amount": 25, "price_currency": "usd", "pay_currency": "usdttrc20" }'}</pre></div><p className="warning">Illustrative API shape only. The live provider adapter and authentication are not implemented.</p></div>:
 page==="Analytics"?<div className="empty-state"><BarChart3 size={30}/><h3>Analytics preview</h3><p>Connect a persistent transaction database to calculate real payment volume and conversion rates.</p></div>:
 page==="Settings"?<div className="settings-list"><div><b>Workspace name</b><span>Anime Cloud</span></div><div><b>Default settlement currency</b><span>USD · Not configured</span></div><div><b>Two-factor authentication</b><span className="status pending">Not enabled</span></div><div><b>Environment</b><span className="status pending">Demo</span></div></div>:
 <div className="empty-state"><CircleHelp size={30}/><h3>How can we help?</h3><p>Support ticketing will be connected after merchant authentication is implemented.</p><button className="primary" onClick={()=>onAction("Support ticket")}>Contact support</button></div>}
 </section>;
}
export default App;