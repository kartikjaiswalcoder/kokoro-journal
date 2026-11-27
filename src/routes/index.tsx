import { createFileRoute } from "@tanstack/react-router";
import KokoroApp from "@/components/KokoroApp";
import SignIn from "@/components/SignIn";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Kokoro · 心" },
      { name: "description", content: "A gentle daily journal with moods, streaks, music and soft AI reflections." },
      { property: "og:title", content: "Kokoro · 心" },
      { property: "og:description", content: "A gentle daily journal with moods, streaks, music and soft AI reflections." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useSession();
  if (loading) return null;
  return session ? <KokoroApp /> : <SignIn />;
}
