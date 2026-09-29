import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/toast";
import { currentUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

export const metadata: Metadata = {
  title: "Inkline — Manga Production Studio",
  description: "AI-powered manga & manhwa production studio: story → characters → storyboards → panels → pages → export.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  ensureSeeded();
  const user = currentUser();
  return (
    <html lang="en" data-accent={user?.prefs.accent ?? "rose"}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
