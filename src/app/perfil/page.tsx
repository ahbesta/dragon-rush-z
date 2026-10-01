import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountProfile } from "@/components/account-profile";
import { currentSession } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import { readSnapshot } from "@/server/game-service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Perfil • Dragon Rush Z" };

export default async function Profile() {
  const session = await currentSession();
  if (!session) redirect("/login");
  const { db } = getDatabase();
  const snapshot = await readSnapshot(db, session.user.id);
  return (
    <AccountProfile
      account={{ name: session.user.name, email: session.user.email }}
      initial={snapshot}
    />
  );
}
