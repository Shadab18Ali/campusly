import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Campusly — Campus feed", description: "A student community for your campus." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
