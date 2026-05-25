import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "../styles/tables.css"

import { ProyectosProvider } from "@/context/ProyectosContext";
import { CablesProvider } from "@/context/CablesContext";
import Navbar from "@/components/Navbar";
import LoadingGate from "@/components/LoadingGate";

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

        <ProyectosProvider>
          <LoadingGate>
            <Navbar />
            <CablesProvider>
              {children}
            </CablesProvider>
          </LoadingGate>
        </ProyectosProvider>

      </body>
    </html>
  );
}