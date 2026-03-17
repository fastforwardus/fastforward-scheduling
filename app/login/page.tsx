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
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError("Email o contraseña incorrectos.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A1C3E] px-4">

      {/* Card */}
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Image
            src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
            alt="FastForward ® | FDA Experts"
            width={180}
            height={40}
            className="object-contain"
            priority
          />
        </div>

        {/* Form card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
          <h1 className="text-white font-bold text-xl mb-1">Acceso al sistema</h1>
          <p className="text-white/40 text-sm mb-8">FastForward ® | FDA Experts</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@fastfwdus.com"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/10
                           text-white placeholder-white/20 text-sm
                           focus:outline-none focus:border-[#C9A84C]/60 focus:bg-white/10
                           transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-4 py-3 pr-11 rounded-xl bg-white/8 border border-white/10
                             text-white placeholder-white/20 text-sm
                             focus:outline-none focus:border-[#C9A84C]/60 focus:bg-white/10
                             transition-all duration-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl
                         font-semibold text-[#27295C] bg-[#C9A84C] hover:bg-[#E5BA52]
                         transition-all duration-200 hover:shadow-lg hover:shadow-[#C9A84C]/25
                         disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 mt-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Ingresar <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          © {new Date().getFullYear()} FastForward ® | FDA Experts · Miami, FL
        </p>
      </div>
    </div>
  );
}
