import { redirect } from "next/navigation";
import { SignedOutShell } from "@/components/schedule-app";
import { resolveScheduleIdentity } from "@/lib/auth/schedule-identity";

export default async function Home() {
  const identity = await resolveScheduleIdentity();
  if (identity && !identity.preview) {
    redirect(
      identity.role === "admin" || identity.role === "direccion"
        ? "/direction"
        : "/teacher",
    );
  }
  return <SignedOutShell />;
}
