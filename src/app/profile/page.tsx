import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { ProfileForm } from "./ProfileForm";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <>
      <Navbar user={session} />
      <main className="max-w-lg mx-auto px-4 py-8 w-full">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">
            ← Hem
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <h1 className="text-xl font-bold">Min profil</h1>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <ProfileForm displayName={session.displayName} email={session.email} />
        </div>
      </main>
    </>
  );
}
