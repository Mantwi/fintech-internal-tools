import type { Metadata } from "next";
import Link from "next/link";
import { DemoIdentitySwitcher } from "@/components/DemoIdentitySwitcher";
import { MainNav } from "@/components/MainNav";
import { getDemoUserIdFromCookies } from "@/lib/session";
import { listDemoUsers } from "@/lib/users";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internal Tools — KYC Review",
  description: "Prototype internal tools (synthetic data only)",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [users, currentUserId] = await Promise.all([listDemoUsers(), getDemoUserIdFromCookies()]);
  const validUserId = users.some((u) => u.id === currentUserId) ? currentUserId : null;

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbar-left">
            <Link href="/kyc" className="brand">
              Internal Tools
            </Link>
            <MainNav />
          </div>
          <DemoIdentitySwitcher users={users} currentUserId={validUserId} />
        </header>
        <div className="demo-banner">Prototype — all customer data is synthetic. Authentication is simulated.</div>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
