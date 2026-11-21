import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";
import "./auth.css";

type Props = { mode: "login" | "signup" };
export default function MerchantAuth({ mode: initialMode }: Props) {
  const [mode, setMode] = useState(initialMode);
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const verified = mode === "login" && new URLSearchParams(window.location.search).get("verified") === "1";

  function switchMode(next: "login" | "signup") {
    setMode(next); setError(""); setMessage("");
    window.history.replaceState({}, "", next === "signup" ? "/signup" : "/login");
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(""); setMessage(""); setLoading(true);
    try {
      const endpoint = mode === "signup" ? "/api/merchant/signup" : "/api/merchant/login";
      const normalizedEmail = email.trim().toLowerCase();
      const body = mode === "signup" ? { full_name: fullName, company, email: normalizedEmail, password } : { email: normalizedEmail, password };
      const response = await fetch(endpoint, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Authentication failed. Please try again.");
      if (data.confirmationRequired) { setMessage(data.message || "Check your inbox and confirm your email before signing in."); setPassword(""); return; }
      window.location.assign("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect. Please try again.");
    } finally { setLoading(false); }
  }

  return <main className="auth-page">
    <div className="auth-glow auth-glow-a"/><div className="auth-glow auth-glow-b"/>
    <a className="auth-brand" href="/"><span>A</span> AnimePay</a>
    <section className="auth-card">
      <div className="auth-icon"><ShieldCheck size={22}/></div>
      <div className="auth-eyebrow">MERCHANT WORKSPACE</div>
      <h1>{mode === "signup" ? "Create your account" : "Welcome back"}</h1>
      <p className="auth-subtitle">{mode === "signup" ? "Set up your merchant workspace to start managing crypto payments." : "Sign in to access your secure merchant dashboard."}</p>
      {verified && <div className="auth-success">Email verified. You can now sign in.</div>}
      <form onSubmit={submit}>
        {mode === "signup" && <>
          <label htmlFor="auth-full-name">Full name</label>
          <input id="auth-full-name" autoComplete="name" value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Your full name" minLength={2} maxLength={100} required/>
          <label htmlFor="auth-company">Business name <span>Optional</span></label>
          <input id="auth-company" autoComplete="organization" value={company} onChange={e=>setCompany(e.target.value)} placeholder="Your business or brand" maxLength={100}/>
        </>}
        <label htmlFor="auth-email">Email address</label>
        <input id="auth-email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value.trim())} placeholder="you@example.com" autoCapitalize="none" spellCheck={false} required/>
        <label htmlFor="auth-password">Password {mode === "signup" && <span>10+ characters</span>}</label>
        <div className="auth-password-wrap"><input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" minLength={mode === "signup" ? 10 : 1} required/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}
        <button className="auth-submit" disabled={loading}>{loading ? "Please wait…" : mode === "signup" ? "Create merchant account" : "Sign in securely"} <ArrowRight size={17}/></button>
      </form>
      <div className="auth-switch">{mode === "signup" ? "Already have an account?" : "New to AnimePay?"} <button onClick={()=>switchMode(mode === "signup" ? "login" : "signup")}>{mode === "signup" ? "Sign in" : "Create account"}</button></div>
      <div className="auth-security"><ShieldCheck size={14}/> Passwords are securely managed by Supabase Auth.</div>
    </section>
    <footer className="auth-footer">© {new Date().getFullYear()} AnimePay · Secure crypto payments</footer>
  </main>;
}
