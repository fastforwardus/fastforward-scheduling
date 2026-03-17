import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
         style={{ background: "#1A1C3E" }}>
      <Image
        src="https://fastfwdus.com/wp-content/uploads/2025/04/logorwhitehorizontal.png"
        alt="FastForward ® | FDA Experts"
        width={160} height={36}
        className="object-contain mb-10"
        unoptimized
      />
      <h1 className="text-4xl font-bold text-white mb-3">404</h1>
      <p className="text-white/50 text-sm mb-8">Este link no existe o ya no está disponible.</p>
      <a href="/book"
         className="px-6 py-3 rounded-xl font-semibold text-sm transition-all"
         style={{ background: "#C9A84C", color: "#1A1C3E" }}>
        Ir al agendamiento general
      </a>
    </div>
  );
}
