import { useEffect, useState } from "react";
import { Activity, ArrowDownLeft, ArrowUpRight, BarChart3, Bell, BookOpen, CheckCircle2, ChevronDown, CircleHelp, Code2, CreditCard, Download, Eye, FileKey2, Globe2, LayoutDashboard, LifeBuoy, Menu, Plus, Search, Settings, ShieldCheck, Wallet, Webhook, X } from "lucide-react";

type Payment = { id: string; customer: string; asset: string; amount: string; status: string; date: string };
type Summary = { mode: string; availableBalance: string; pendingBalance: string; totalPayments: number; successfulPayments: number; volumeUsd: string; recentPayments: Payment[] };
const nav = [
  { label: "Overview", icon: LayoutDashboard }, { label: "Payments", icon: CreditCard }, { label: "Balances", icon: Wallet },
  { label: "Withdrawals", icon: ArrowUpRight }, { label: "API Keys", icon: FileKey2 }, { label: "Webhooks", icon: Webhook },
  { label: "Analytics", icon: BarChart3 }, { label: "API Docs", icon: BookOpen }, { label: "Settings", icon: Settings }, { label: "Support", icon: LifeBuoy }
];
const fallback: Summary = { mode:"demo", availableBalance:"0.00", pendingBalance:"0.00", totalPayments:1284, successfulPayments:1198, volumeUsd:"24850.00", recentPayments:[
  {id:"AP-2048",customer:"Customer A",asset:"USDT TRC20",amount:"125.00",status:"confirmed",date:"Today, 10:42"},
  {id:"AP-2047",customer:"Customer B",asset:"ETH",amount:"0.042",status:"pending",date:"Today, 09:18"},
  {id:"AP-2046",customer:"Customer C",asset:"BTC",amount:"0.0018",status:"confirmed",date:"Yesterday"}
]};
function App() {
  if (window.location.pathname.startsWith("/checkout")) return <CheckoutPage />;
  const [page,setPage] = useState("Overview");
  const [summary,setSummary] = useState<Summary>(fallback);
  const [menu,setMenu] = useState(false);
  const [notice,setNotice] = useState("");
  useEffect(()=>{ fetch("/api/merchant/summary").then(r=>r.ok?r.json():null).then(d=>d&&setSummary(d)).catch(()=>{}); },[]);
  const action = (name:string) => setNotice(name + " is a preview in this starter. Live financial actions are disabled.");
  const title = page === "Overview" ? "Good morning, Merchant" : page;
  return <div className="app-shell">
    <aside className={menu?"sidebar open":"sidebar"}>
      <div className="brand"><div className="brand-mark">A</div><div><b>AnimePay</b><small>PAYMENT GATEWAY</small></div><button className="mobile-close" onClick={()=>setMenu(false)}><X size={18}/></button></div>
      <div className="workspace"><span className="avatar">AC</span><div><b>Anime Cloud</b><small>Merchant workspace</small></div><ChevronDown size={15}/></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav>{nav.map(n=><button key={n.label} className={page===n.label?"nav-item active":"nav-item"} onClick={()=>{setPage(n.label);setMenu(false);setNotice("");}}><n.icon size={17}/><span>{n.label}</span>{n.label==="Payments"&&<i>12</i>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="secure"><ShieldCheck size={18}/><div><b>Protected workspace</b><small>Demo environment</small></div></div><div className="user"><div className="avatar user-avatar">DK</div><div><b>Demo Merchant</b><small>admin@animecloud.in</small></div><ChevronDown size={15}/></div></div>
    </aside>
    <main className="main">
      <header className="topbar"><button className="mobile-menu" onClick={()=>setMenu(true)}><Menu/></button><div className="crumb">Workspace <span>/</span> <b>{page}</b></div><div className="top-actions"><span className="environment"><span/> DEMO MODE</span><button className="icon-btn" onClick={()=>action("Notifications")}><Bell size={18}/></button><div className="top-avatar">DK</div></div></header>
      <div className="content"><div className="page-head"><div><div className="eyebrow">MERCHANT CONSOLE <span>•</span> {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</div><h1>{title}</h1><p>{page==="Overview"?"Here’s what’s happening with your payments today.":"Manage your AnimePay merchant account and payment operations."}</p></div><button className="primary" onClick={()=>action("Create payment")}><Plus size={17}/> Create payment</button></div>
      {notice&&<div className="notice"><ShieldCheck size={17}/>{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}
      {page==="Overview"?<><div className="banner"><div className="banner-icon"><ShieldCheck size={22}/></div><div><b>You’re viewing a demo workspace</b><p>Sample activity is shown for preview. No cryptocurrency is being received, held, or transferred.</p></div><span>DEMO</span></div>
      <section className="stats"><Stat label="Available balance" value="$0.00" sub="No real funds connected" icon={Wallet}/><Stat label="Pending balance" value="$0.00" sub="Awaiting confirmation" icon={Activity}/><Stat label="Total payment volume" value="$24,850.00" sub="Illustrative demo data" icon={ArrowDownLeft}/><Stat label="Successful payments" value="1,198" sub="Of 1,284 sample payments" icon={CheckCircle2}/></section>
      <div className="two-col"><section className="panel chart-panel"><div className="panel-head"><div><h2>Payment activity</h2><p>Volume overview · demo data</p></div><button className="select-btn">Last 7 days <ChevronDown size={14}/></button></div><div className="chart"><div className="chart-y"><span>$5k</span><span>$3k</span><span>$1k</span><span>$0</span></div><div className="chart-main"><div className="grid-lines"><i/><i/><i/><i/></div><svg viewBox="0 0 600 180" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8b72ff" stopOpacity=".28"/><stop offset="100%" stopColor="#8b72ff" stopOpacity="0"/></linearGradient></defs><path d="M0 142 C35 128 40 135 80 110 S140 124 170 88 S220 104 260 75 S310 92 350 62 S400 82 430 49 S490 78 520 36 S565 52 600 18 L600 180 L0 180Z" fill="url(#fill)"/><path d="M0 142 C35 128 40 135 80 110 S140 124 170 88 S220 104 260 75 S310 92 350 62 S400 82 430 49 S490 78 520 36 S565 52 600 18" fill="none" stroke="#9a86ff" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg><div className="chart-x"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div></div></section>
      <section className="panel quick-panel"><div className="panel-head"><div><h2>Quick actions</h2><p>Common merchant tasks</p></div></div><Quick icon={Plus} title="Create payment" desc="Generate a checkout invoice" onClick={()=>action("Create payment")}/><Quick icon={ArrowUpRight} title="Request withdrawal" desc="Preview a payout request" onClick={()=>setPage("Withdrawals")}/><Quick icon={Code2} title="View API docs" desc="Explore integration endpoints" onClick={()=>setPage("API Docs")}/><Quick icon={Webhook} title="Configure webhook" desc="Set event notification URL" onClick={()=>setPage("Webhooks")}/></section></div>
      <section className="panel table-panel"><div className="panel-head"><div><h2>Recent payments</h2><p>Your latest payment activity</p></div><button className="text-btn" onClick={()=>setPage("Payments")}>View all <ArrowUpRight size={14}/></button></div><PaymentTable rows={summary.recentPayments}/></section></>:<GenericPage page={page} onAction={action}/>}
      <footer>© 2026 AnimePay <span>•</span> Secure crypto payments, simplified <span className="footer-right"><ShieldCheck size={13}/> Demo build · Not for live funds</span></footer>
      </div>
    </main>
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