import { useState } from "react";
import { Link } from "wouter";
import { ShieldCheck, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen grid place-items-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4"><Card className="w-full max-w-md border-t-4 border-t-primary"><CardHeader className="text-center"><ShieldCheck className="mx-auto h-12 w-12 text-primary" />{children}</CardHeader></Card></main>;
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState(""); const [loading, setLoading] = useState(false); const [sent, setSent] = useState(false); const { toast } = useToast();
  const submit = async () => { setLoading(true); try { await post("/api/password/forgot", { email }); setSent(true); } catch (e: any) { toast({ variant: "destructive", title: "Unable to continue", description: e.message }); } finally { setLoading(false); } };
  return <Shell><CardTitle>Reset your password</CardTitle><CardDescription>Enter your registered email. We’ll send a secure reset link.</CardDescription><CardContent className="space-y-4 text-left">{sent ? <p className="text-sm text-center">If the address is registered, check its inbox for the reset link.</p> : <><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /><Button className="w-full" disabled={!email || loading} onClick={submit}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send reset link</Button></>}<Link href="/" className="block text-center text-sm text-primary hover:underline">Back to login</Link></CardContent></Shell>;
}

export function ResendVerificationPage() {
  const [email, setEmail] = useState(""); const [loading, setLoading] = useState(false); const [sent, setSent] = useState(false); const { toast } = useToast();
  const submit = async () => { setLoading(true); try { await post("/api/email/resend-verification", { email }); setSent(true); } catch (e: any) { toast({ variant: "destructive", title: "Unable to continue", description: e.message }); } finally { setLoading(false); } };
  return <Shell><CardTitle>Resend verification</CardTitle><CardDescription>Request a fresh email-verification link.</CardDescription><CardContent className="space-y-4 text-left">{sent ? <p className="text-sm text-center">If the address is registered and unverified, check its inbox.</p> : <><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /><Button className="w-full" disabled={!email || loading} onClick={submit}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send verification link</Button></>}<Link href="/" className="block text-center text-sm text-primary hover:underline">Back to login</Link></CardContent></Shell>;
}

export function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token") || ""; const [password, setPassword] = useState(""); const [loading, setLoading] = useState(false); const [done, setDone] = useState(false); const { toast } = useToast();
  const submit = async () => { setLoading(true); try { await post("/api/password/reset", { token, newPassword: password }); setDone(true); } catch (e: any) { toast({ variant: "destructive", title: "Reset failed", description: e.message }); } finally { setLoading(false); } };
  return <Shell><CardTitle>Choose a new password</CardTitle><CardDescription>Use at least 10 characters with uppercase, lowercase and a number.</CardDescription><CardContent className="space-y-4 text-left">{done ? <p className="text-center text-sm">Your password has been reset successfully.</p> : <><Label>New password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} /><Button className="w-full" disabled={!token || password.length < 10 || loading} onClick={submit}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Reset password</Button></>}<Link href="/" className="block text-center text-sm text-primary hover:underline">Back to login</Link></CardContent></Shell>;
}

export function VerifyEmailPage() {
  const token = new URLSearchParams(window.location.search).get("token") || ""; const [state, setState] = useState<"idle"|"loading"|"done"|"error">("idle"); const [message, setMessage] = useState("");
  const verify = async () => { setState("loading"); try { const data = await post("/api/email/verify", { token }); setMessage(data.message); setState("done"); } catch (e: any) { setMessage(e.message); setState("error"); } };
  return <Shell><CardTitle>Verify your email</CardTitle><CardDescription>Confirm this email address before signing in.</CardDescription><CardContent className="space-y-4 text-center">{message && <p className={state === "error" ? "text-sm text-destructive" : "text-sm text-green-700"}>{message}</p>}{state !== "done" && <Button className="w-full" disabled={!token || state === "loading"} onClick={verify}>{state === "loading" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Verify email</Button>}<Link href="/" className="block text-sm text-primary hover:underline">Go to login</Link></CardContent></Shell>;
}
