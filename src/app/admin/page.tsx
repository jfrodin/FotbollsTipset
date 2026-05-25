import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { AdminPanel } from "@/components/AdminPanel";
import { db } from "@/db";
import { tournaments, users, syncLogs } from "@/db/schema";
import { desc } from "drizzle-orm";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");

  const [allTournaments, allUsers, recentLogs] = await Promise.all([
    db.select().from(tournaments).orderBy(desc(tournaments.createdAt)),
    db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt)),
    db.select().from(syncLogs).orderBy(desc(syncLogs.startedAt)).limit(20),
  ]);

  return (
    <>
      <Navbar user={session} />
      <main className="max-w-4xl mx-auto px-4 py-8 w-full flex-1">
        <h1 className="text-2xl font-bold mb-8">Adminpanel</h1>
        <AdminPanel
          tournaments={allTournaments}
          users={allUsers}
          syncLogs={recentLogs}
        />
      </main>
    </>
  );
}
