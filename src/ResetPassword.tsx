import { useState, type FormEvent } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import "./auth.css";

export default function ResetPassword() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const accessToken = hash.get("access_token") || query.get("access_token") || "";
  const recoveryType = hash.get("type") || query.get("type") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(!accessToken || (recoveryType && recoveryType !== "recovery") ? "This password reset link is invalid or expired. Request a new reset link." : "");
  const [success, setSuccess] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!accessToken) { setError("This reset link is invalid or expired. Request a new one."); return; }
    if (password.length < 10) { setError("Use a password with at least 10 characters."); return; }
    if (password !== confirmPassword) { setError("The passwords do not match."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/merchant/reset-password", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update your password.");
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
      window.history.replaceState({}, "", "/reset-password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update your password. Please try again.");
    } finally { setLoading(false); }
  }

  return <main className="auth-page">
    <div className="auth-glow auth-glow-a"/><div className="auth-glow auth-glow-b"/>
    <a className="auth-brand" href="/"><span>A</span> AnimePay</a>
    <section className="auth-card">
      <div className="auth-icon"><ShieldCheck size={22}/></div>
      <div className="auth-eyebrow">SECURE ACCOUNT RECOVERY</div>
      <h1>{success ? "Password updated" : "Create a new password"}</h1>
      <p className="auth-subtitle">{success ? "Your AnimePay password has been changed. Sign in using your new password." : "Choose a strong password to secure your merchant workspace."}</p>
      {success ? <div className="auth-success">Password updated successfully.</div> : <form onSubmit={submit}>
        <label htmlFor="reset-password">New password <span>10–128 characters</span></label>
        <input id="reset-password" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter a new password" minLength={10} maxLength={128} required disabled={!accessToken}/>
        <label htmlFor="reset-confirm">Confirm new password</label>
        <input id="reset-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="Re-enter your new password" minLength={10} maxLength={128} required disabled={!accessToken}/>
        {error && <div className="auth-error">{error}</div>}
        <button className="auth-submit" disabled={loading || !accessToken}>{loading ? "Updating password…" : "Update password"} <ArrowRight size={17}/></button>
      </form>}
      <div className="auth-switch"><a href="/login">Back to sign in</a>{!success && <> · <a href="/login">Request another reset link</a></>}</div>
      <div className="auth-security"><ShieldCheck size={14}/> Passwords are securely managed by Supabase Auth.</div>
    </section>
    <footer className="auth-footer">© {new Date().getFullYear()} AnimePay · Secure crypto payments</footer>
  </main>;
}
