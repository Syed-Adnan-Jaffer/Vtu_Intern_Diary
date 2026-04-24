import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/components/theme-provider";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  // Toggle this to true to re-enable email/password authentication later
  const EMAIL_AUTH_ENABLED = true;

  useEffect(() => {
    const hash = window.location.hash || "";
    if (hash.includes("type=recovery")) {
      setMode("reset");
    }
  }, []);

  if (!authLoading && user && mode !== "reset") {
    void navigate({ to: "/dashboard", replace: true });
    return null;
  }

  const handleGoogleLogin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      // Note: No finally block needed here as the page will redirect if successful
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        
        if (data.session) {
          toast.success("Account created! You're signed in.");
          void navigate({ to: "/dashboard", replace: true });
        } else {
          toast.success("Account created! Please check your email to confirm.");
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        void navigate({ to: "/dashboard", replace: true });
      } else if (mode === "forgot") {
        if (!email.trim()) throw new Error("Enter your email address.");
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast.success("Password reset email sent. Check your inbox.");
      } else {
        if (password.length < 6) throw new Error("Password must be at least 6 characters.");
        if (password !== confirmPassword) throw new Error("Passwords do not match.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        toast.success("Password updated. Please sign in.");
        setMode("signin");
        setPassword("");
        setConfirmPassword("");
        await supabase.auth.signOut();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Logo Section */}
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <img
            src="/Black Illustrated School Logo.gif"
            alt="VTU Internship Diary Logo"
            className="max-w-full h-auto max-h-96 mx-auto mb-6"
            style={{ filter: isDark ? 'invert(1) brightness(1.2)' : 'none' }}
          />
          <h1 className={`text-3xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>VTU Internship Diary</h1>
          <p className={isDark ? 'text-zinc-400' : 'text-gray-600'}>AI-assisted daily entries for VTU students</p>
        </div>
      </div>

      {/* Auth Section */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {EMAIL_AUTH_ENABLED
                  ? mode === "signin"
                    ? "Sign in"
                    : mode === "signup"
                      ? "Create your account"
                      : mode === "forgot"
                        ? "Reset your password"
                        : "Set a new password"
                  : "Sign in"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {EMAIL_AUTH_ENABLED && (
                <>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === "signup" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="name">Full name</Label>
                        <Input
                          id="name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                          placeholder="As it should appear in your diary"
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        disabled={mode === "reset"}
                      />
                    </div>
                    {mode !== "forgot" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="password">{mode === "reset" ? "New password" : "Password"}</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            autoComplete={mode === "signup" || mode === "reset" ? "new-password" : "current-password"}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                    {mode === "reset" && (
                      <div className="space-y-1.5">
                        <Label htmlFor="confirmPassword">Confirm new password</Label>
                        <Input
                          id="confirmPassword"
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={6}
                          autoComplete="new-password"
                        />
                      </div>
                    )}
                    <Button type="submit" className="w-full" disabled={busy}>
                      {busy
                        ? "Please wait…"
                        : mode === "signin"
                          ? "Sign in"
                          : mode === "signup"
                            ? "Create account"
                            : mode === "forgot"
                              ? "Send reset email"
                              : "Update password"}
                    </Button>
                    <div className="text-center text-sm text-muted-foreground">
                      {mode === "signin" ? (
                        <>
                          No account?{" "}
                          <button type="button" className="text-primary underline" onClick={() => setMode("signup")}>
                            Create one
                          </button>
                          <span className="mx-2">·</span>
                          <button type="button" className="text-primary underline" onClick={() => setMode("forgot")}>
                            Forgot password?
                          </button>
                        </>
                      ) : mode === "signup" ? (
                        <>
                          Already have an account?{" "}
                          <button type="button" className="text-primary underline" onClick={() => setMode("signin")}>
                            Sign in
                          </button>
                        </>
                      ) : mode === "forgot" ? (
                        <>
                          Remembered your password?{" "}
                          <button type="button" className="text-primary underline" onClick={() => setMode("signin")}>
                            Back to sign in
                          </button>
                        </>
                      ) : (
                        <>
                          Return to{" "}
                          <button type="button" className="text-primary underline" onClick={() => setMode("signin")}>
                            sign in
                          </button>
                        </>
                      )}
                    </div>
                  </form>

                  {mode !== "forgot" && mode !== "reset" && (
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          Or continue with
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {mode !== "forgot" && mode !== "reset" && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleLogin}
                  disabled={busy}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Google
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
