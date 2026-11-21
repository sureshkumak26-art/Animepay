import { ArrowRight, ArrowUpRight, ShieldCheck, Zap, Globe2, Code2, Wallet, CheckCircle2, Menu, X } from "lucide-react";
import { useState } from "react";

const features = [
  { icon: Zap, title: "Fast crypto checkout", text: "Give customers a simple flow to choose a supported asset and complete a payment." },
  { icon: ShieldCheck, title: "Verified payment updates", text: "Use server-side provider callbacks and status checks before treating an invoice as paid." },
  { icon: Globe2, title: "Built for the web", text: "A merchant-focused payment experience designed for websites, apps and online services." },
  { icon: Code2, title: "Developer friendly", text: "A clean integration path with API-first workflows and webhook-based updates." }
];

export default function Landing() {
  const [menu, setMenu] = useState(false);
  return <div className="landing">
    <div className="landing-glow landing-glow-one" /><div className="landing-glow landing-glow-two" />
    <header className="landing-nav">
      <a className="landing-logo" href="/"><span>A</span> animepay</a>
      <button className="landing-menu-toggle" onClick={() => setMenu(!menu)} aria-label="Toggle navigation">{menu ? <X/> : <Menu/>}</button>
      <nav className={menu ? "landing-links show" : "landing-links"}>
        <a href="#features" onClick={() => setMenu(false)}>Features</a><a href="#how-it-works" onClick={() => setMenu(false)}>How it works</a><a href="#security" onClick={() => setMenu(false)}>Security</a>
        <a className="landing-login" href="/dashboard">Merchant dashboard <ArrowUpRight size={15}/></a>
      </nav>
    </header>
    <main>
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-pill"><span/> CRYPTO PAYMENTS, MADE CLEAR</div>
          <h1>Move money<br/><em>at the speed</em> of the internet.</h1>
          <p className="landing-lead">A modern crypto payment experience for businesses building what's next. Simple checkout for customers. Clear payment operations for merchants.</p>
          <div className="landing-actions"><a className="landing-primary" href="/dashboard">Open merchant dashboard <ArrowRight size={17}/></a><a className="landing-secondary" href="#how-it-works">Explore how it works <span>↓</span></a></div>
          <div className="landing-proof"><div className="proof-avatars"><i>A</i><i>₿</i><i>Ξ</i></div><span>Designed for modern digital businesses</span></div>
        </div>
        <div className="landing-visual" aria-label="Illustration of a crypto payment dashboard">
          <div className="visual-orbit orbit-a"/><div className="visual-orbit orbit-b"/>
          <div className="visual-card">
            <div className="visual-card-top"><span className="visual-mark">A</span><span>PAYMENT OVERVIEW</span><b>•••</b></div>
            <div className="visual-balance-label">Payment activity</div><div className="visual-balance">Your business, connected<span>↗</span></div>
            <div className="visual-chart"><div className="visual-chart-grid"/><svg viewBox="0 0 440 130" preserveAspectRatio="none"><defs><linearGradient id="landingFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#a18aff" stopOpacity=".32"/><stop offset="100%" stopColor="#a18aff" stopOpacity="0"/></linearGradient></defs><path d="M0 104 C38 93 52 101 85 75 S132 90 165 64 S211 79 246 49 S294 68 330 38 S383 52 440 13 L440 130 L0 130Z" fill="url(#landingFill)"/><path d="M0 104 C38 93 52 101 85 75 S132 90 165 64 S211 79 246 49 S294 68 330 38 S383 52 440 13" fill="none" stroke="#b3a2ff" strokeWidth="3"/></svg></div>
            <div className="visual-assets"><div><i className="asset-coin coin-usdt">₮</i><span><b>USDT</b><small>Tether USD</small></span><strong>Stablecoin</strong></div><div><i className="asset-coin coin-eth">Ξ</i><span><b>ETH</b><small>Ethereum</small></span><strong>Network asset</strong></div></div>
          </div>
          <div className="visual-float float-top"><span><CheckCircle2 size={16}/></span><div><b>Payment verified</b><small>Server-confirmed status</small></div></div>
          <div className="visual-float float-bottom"><span><ShieldCheck size={17}/></span><div><b>Security first</b><small>Protected payment flow</small></div></div>
        </div>
      </section>
      <section className="landing-strip"><span>BUILT FOR DIGITAL COMMERCE</span><div><b>Online services</b><i/> <b>Subscriptions</b><i/> <b>Digital products</b><i/> <b>Global customers</b></div></section>
      <section className="landing-section" id="features"><div className="landing-section-head"><div className="landing-eyebrow">WHY ANIMEPAY</div><h2>Payments should feel<br/><em>effortless.</em></h2><p>Bring the essential parts of a crypto payment journey into one focused experience.</p></div><div className="landing-feature-grid">{features.map(({icon:Icon,title,text},i)=><article className="landing-feature" key={title}><div className="feature-icon"><Icon size={20}/><small>0{i+1}</small></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section className="landing-how" id="how-it-works"><div className="how-copy"><div className="landing-eyebrow">A CLEARER FLOW</div><h2>From checkout<br/>to <em>confirmation.</em></h2><p>Keep the customer journey straightforward and let your backend handle the important verification work.</p><a href="/dashboard">Explore the dashboard <ArrowRight size={16}/></a></div><div className="how-steps"><div><span>01</span><section><b>Create an invoice</b><p>Your app starts a payment request with the amount and order reference.</p></section></div><div><span>02</span><section><b>Customer chooses crypto</b><p>Show the available currency and network options for that invoice.</p></section></div><div><span>03</span><section><b>Verify before fulfilment</b><p>Confirm the provider's signed update and payment status on your server.</p></section></div></div></section>
      <section className="landing-security" id="security"><div className="security-icon"><ShieldCheck size={26}/></div><div><div className="landing-eyebrow">SECURITY IS NOT AN AFTERTHOUGHT</div><h2>Trust every status.<br/><em>Verify every payment.</em></h2><p>Never rely on a browser redirect alone. Keep provider secrets server-side, verify webhook signatures, and reconcile payment events before fulfilling orders.</p></div><div className="security-note"><ShieldCheck size={17}/><span><b>Server-side verification</b><small>Payment status should be confirmed by your backend.</small></span></div></section>
      <section className="landing-cta"><div className="landing-eyebrow">READY WHEN YOU ARE</div><h2>Make your next payment<br/>experience <em>feel simpler.</em></h2><p>Explore the AnimePay merchant workspace.</p><a className="landing-primary" href="/dashboard">Go to merchant dashboard <ArrowRight size={17}/></a></section>
    </main>
    <footer className="landing-footer"><a className="landing-logo" href="/"><span>A</span> animepay</a><span>Crypto payment infrastructure for digital businesses.</span><small>© {new Date().getFullYear()} AnimePay. Availability depends on provider and account configuration.</small></footer>
  </div>;
}
