import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Campusly — Your campus. Your people. Your space.", description: "A social space made for verified college students." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
