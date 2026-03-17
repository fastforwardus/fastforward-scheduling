"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
    });

    setLoading(false);

    if (!res || res.error) {
      setError("Email o contraseña incorrectos.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
         style={{ background: "linear-gradient(135deg, #1A1C3E 0%, #27295C 100%)" }}>

      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Image
            src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
            alt="FastForward ® | FDA Experts"
            width={200}
            height={45}
            className="object-contain"
            priority
            unoptimized
          />
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8"
             style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>

          <h1 className="text-white font-bold text-xl mb-1">Acceso al sistema</h1>
          <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.35)" }}>
            FastForward ® | FDA Experts
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-widest"
                     style={{ color: "rgba(255,255,255,0.4)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@fastfwdus.com"
                required
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1.5px solid rgba(255,255,255,0.12)",
                  color: "white",
                }}
                onFocus={e => e.currentTarget.style.borderColor = "#C9A84C"}
                onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold mb-2 uppercase tracking-widest"
                     style={{ color: "rgba(255,255,255,0.4)" }}>
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1.5px solid rgba(255,255,255,0.12)",
                    color: "white",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "#C9A84C"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                  onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.7)"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-3 rounded-xl text-sm"
                   style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#fca5a5" }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold transition-all duration-200 active:scale-95 mt-2"
              style={{
                background: loading ? "#a68a3a" : "#C9A84C",
                color: "#1A1C3E",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <> Ingresar <ArrowRight className="w-4 h-4" /> </>
              }
            </button>

          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.2)" }}>
          © {new Date().getFullYear()} FastForward ® | FDA Experts · Miami, FL
        </p>
      </div>
    </div>
  );
}
