import { redirect } from "next/navigation";

export default function HomePage() {
  // Redirect to landing page (auth check happens on individual pages)
  redirect("/landing");
}