import { redirect } from "next/navigation";
import { currentSession } from "@/server/auth";
import { AuthScreen } from "@/components/auth-screen";
export const dynamic = "force-dynamic";
export default async function Login() {
  if (await currentSession()) redirect("/jogo");
  return <AuthScreen />;
}
