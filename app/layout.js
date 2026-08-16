import "./globals.css";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

const display = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--fonte-display",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fonte-mono",
});

export const metadata = {
  title: "CHASSI244 — Catálogo de peças",
  description: "Consulta de peças, aplicações e valores da oficina.",
};

export const viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${mono.variable}`}>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
