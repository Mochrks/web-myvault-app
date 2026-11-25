import { redirect } from "next/navigation";
import { VaultAppError } from "@/lib/api/response";
import { getServerSession, type SessionPayload } from "@/lib/auth/session";

export async function requireApiSession(): Promise<SessionPayload> {
  const session = await getServerSession();
  if (!session) {
    throw new VaultAppError("UNAUTHORIZED", "Authentication required.", 401);
  }
  return session;
}

export async function requirePageSession(): Promise<SessionPayload> {
  const session = await getServerSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}
