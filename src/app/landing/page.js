import { redirect } from "next/navigation";

// The upstream marketing page is not part of this product; the dashboard is the start screen.
export default function LandingPage() {
  redirect("/dashboard");
}
