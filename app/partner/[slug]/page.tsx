"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function PartnerPage({ params }: { params: { slug: string } }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin() {
    setLoading(true); setError("");
    const res = await fetch("/api/auth/partner-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: params.slug, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.ok) router.push(`/partner/${params.slug}/dashboard`);
    else setError(data.error || "Credenciales incorrectas");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
         style={{ background: "#F8F9FB" }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Image src="https://fastfwdus.com/wp-content/uploads/2025/05/logoR.png"
            alt="FastForward" width={160} height={36} className="object-contain" unoptimized />
        </div>
        <div className="bg-white rounded-2xl p-8" style={{ border: "1px solid #E5E7EB", boxShadow: "0 4px 24px rgba(39,41,92,0.08)" }}>
          <h1 className="text-xl font-bold mb-2" style={{ color: "#27295C" }}>Portal de Partner</h1>
          <p className="text-sm mb-6" style={{ color: "#6B7280" }}>Ingresa tu contrasena para acceder</p>
          <div className="mb-4">
            <label className="block text-xs uppercase tracking-widest mb-1.5" style={{ color: "#9CA3AF" }}>Contrasena</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              className="w-full px-4 py-3 rounded-xl border text-sm outline-none"
              style={{ borderColor: "#E5E7EB", color: "#27295C" }}
              onFocus={e => e.currentTarget.style.borderColor = "#27295C"}
              onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"} />
          </div>
          {error && <p className="text-xs mb-4" style={{ color: "#EF4444" }}>{error}</p>}
          <button onClick={handleLogin} disabled={loading || !password}
            className="w-full py-3 rounded-xl font-semibold text-sm"
            style={{ background: password ? "#27295C" : "#E5E7EB", color: password ? "white" : "#9CA3AF" }}>
            {loading ? "Ingresando..." : "Ingresar →"}
          </button>
        </div>
        <p className="text-center text-xs mt-6" style={{ color: "#9CA3AF" }}>FastForward FDA Experts · Miami, FL</p>
      </div>
    </div>
  );
}
