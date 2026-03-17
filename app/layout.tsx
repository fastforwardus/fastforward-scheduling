import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "next-themes";
import "./globals.css";

export const metadata: Metadata = {
  title: "FastForward ® | FDA Experts",
  description: "Consulta gratuita con un experto en FDA compliance, LLC formation y entrada al mercado de EE.UU.",
  icons: {
    icon: "https://fastfwdus.com/wp-content/uploads/2025/03/fastforward-logo.png.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning className={GeistSans.variable}>
      <body className="font-sans antialiased bg-white dark:bg-navy-900 transition-colors duration-300">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
