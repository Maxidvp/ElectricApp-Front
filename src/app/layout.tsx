import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "../styles/tables.css"

// Contexto global — provee los tableros y circuitos a toda la app
import { TablerosProvider } from "@/context/TablerosContext";

// Fuentes de Google cargadas con el sistema de Next.js
// se inyectan como variables CSS y se aplican en el <html>
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadatos de la app — aparecen en el título del navegador y SEO
export const metadata: Metadata = {
  title: "Electric App",
  description: "Aplicación para calculos eléctricos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>

        {/* TablerosProvider envuelve toda la app para que cualquier
            componente pueda acceder a los tableros y circuitos
            usando el hook useTableros() sin necesidad de props */}
        <TablerosProvider>
          {children}
        </TablerosProvider>

      </body>
    </html>
  );
}