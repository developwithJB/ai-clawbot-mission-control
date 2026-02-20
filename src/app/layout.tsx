import type { ReactNode } from "react";
import { SidebarNav } from "@/components/hq/SidebarNav";
import "./globals.css";

export const metadata = {
  title: "Mission Control",
  description: "AI Team Headquarters",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100">
        <div className="min-h-screen md:flex">
          <SidebarNav />
          <main className="w-full p-4 md:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
