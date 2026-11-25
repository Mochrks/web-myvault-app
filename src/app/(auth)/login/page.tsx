import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import GradientASCII from "@/components/ui/GradientASCII";
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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-75">
        <GradientASCII
          colors={["#171717", "#525252", "#a3a3a3", "#fafafa"]}
          shape="horizon"
          gradientOpacity={0.65}
          glyphOpacity={0.75}
          glow={0.15}
        />
      </div>
      <div className="relative z-10 w-full max-w-[380px]">
        <LoginForm nextPath={nextPath} />
      </div>
    </main>
  );
}
