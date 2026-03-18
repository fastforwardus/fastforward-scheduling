"use client";

import { useState } from "react";
import Image from "next/image";

const STARS = [1, 2, 3, 4, 5];

export default function SurveyPage({ params }: { params: { token: string } }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ showGoogle: boolean; googleUrl: string } | null>(null);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!rating) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token, rating, feedback }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ showGoogle: data.showGoogleReview, googleUrl: data.googleReviewUrl });
      } else {
        setError("Error al enviar. Intenta de nuevo.");
      }
    } catch {
      setError("Error de conexion.");
    }
    setSubmitting(false);
  }

  const labels: Record<number, string> = {
    1: "Muy mala", 2: "Mala", 3: "Regular", 4: "Buena", 5: "Excelente!"
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
         style={{ background: "#F8F9FB" }}>
      <div className="w-full max-w-md">

        <div className="flex justify-center mb-8">
          <Image
            src="https://fastfwdus.com/wp-content/uploads/2025/05/logoR.png"
            alt="FastForward" width={160} height={36} className="object-contain" unoptimized
          />
        </div>

        {!result ? (
          <div className="bg-white rounded-2xl p-8"
               style={{ boxShadow: "0 4px 24px rgba(39,41,92,0.08)", border: "1px solid #E5E7EB" }}>
            <h1 className="text-xl font-bold mb-2 text-center" style={{ color: "#27295C" }}>
              Como fue tu experiencia?
            </h1>
            <p className="text-sm text-center mb-8" style={{ color: "#6B7280" }}>
              Tu opinion nos ayuda a mejorar nuestro servicio
            </p>

            <div className="flex justify-center gap-3 mb-4">
              {STARS.map(star => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                  className="text-4xl transition-transform hover:scale-110 active:scale-95"
                  style={{ filter: (hover || rating) >= star ? "none" : "grayscale(1) opacity(0.3)" }}>
                  &#11088;
                </button>
              ))}
            </div>

            {rating > 0 && (
              <p className="text-center text-sm font-semibold mb-6" style={{ color: "#C9A84C" }}>
                {labels[rating]}
              </p>
            )}

            <div className="mb-6">
              <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: "#9CA3AF" }}>
                Que fue lo mas valioso? (opcional)
              </label>
              <textarea
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                placeholder="Contanos tu experiencia..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ border: "1.5px solid #E5E7EB", color: "#111827" }}
                onFocus={e => e.currentTarget.style.borderColor = "#27295C"}
                onBlur={e => e.currentTarget.style.borderColor = "#E5E7EB"}
              />
            </div>

            {error && <p className="text-xs mb-4 text-center" style={{ color: "#EF4444" }}>{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={!rating || submitting}
              className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: !rating ? "#E5E7EB" : "#C9A84C",
                color: !rating ? "#9CA3AF" : "#1A1C3E",
                cursor: !rating ? "not-allowed" : "pointer",
              }}>
              {submitting ? "Enviando..." : "Enviar calificacion"}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center"
               style={{ boxShadow: "0 4px 24px rgba(39,41,92,0.08)", border: "1px solid #E5E7EB" }}>
            <div className="text-5xl mb-4">&#128591;</div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "#27295C" }}>Gracias por tu opinion!</h2>
            <p className="text-sm mb-6" style={{ color: "#6B7280" }}>
              Tu feedback nos ayuda a seguir mejorando.
            </p>

            {result.showGoogle && (
              <div>
                <p className="text-sm font-semibold mb-4" style={{ color: "#27295C" }}>
                  Te gustaria compartir tu experiencia en Google?
                </p>
                
                  href={result.googleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-semibold text-sm w-full transition-all"
                  style={{ background: "#4285F4", color: "white" }}>
                  Dejar resena en Google
                </a>
                <p className="text-xs mt-3" style={{ color: "#9CA3AF" }}>
                  Solo toma 1 minuto y ayuda a otras empresas a encontrarnos
                </p>
              </div>
            )}

            <a href="https://fastfwdus.com"
               className="inline-block mt-6 text-xs"
               style={{ color: "#9CA3AF" }}>
              Volver a fastfwdus.com
            </a>
          </div>
        )}

        <p className="text-center text-xs mt-6" style={{ color: "#9CA3AF" }}>
          FastForward FDA Experts · Miami, FL
        </p>
      </div>
    </div>
  );
}
