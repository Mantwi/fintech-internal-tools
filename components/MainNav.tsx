"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/kyc", label: "KYC Review Queue" },
  { href: "/audit", label: "Audit Log" },
];

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav className="main-nav">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={pathname.startsWith(l.href) ? "active" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
