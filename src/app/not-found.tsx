import Link from "next/link";
import { Header } from "@/components/Header";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-paper">
      <Header />
      <p className="label text-muted">Page not found</p>
      <Link href="/" className="label mt-4 text-ink transition-opacity hover:opacity-60">
        Back home
      </Link>
    </main>
  );
}
