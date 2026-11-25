import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getServerSession } from "@/lib/auth/session";

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getServerSession();
  if (session) {
    redirect("/dashboard");
  }

  const searchParams = await props.searchParams;
  const nextPath = searchParams.next || "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0d12] px-4 py-10">
      <LoginForm nextPath={nextPath} />
    </main>
  );
}
