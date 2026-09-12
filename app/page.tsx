import Link from "next/link";
import { ArrowRight, Shirt, Sparkles, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/editorial/Button";
import { Eyebrow } from "@/components/editorial/Badge";

const EXPERIENCES = [
  {
    href: "/rescue",
    icon: Shirt,
    title: "Rescue My Closet",
    description: "Show us something you never wear. We'll build outfits around it from clothes you already own.",
  },
  {
    href: "/style-now",
    icon: Sparkles,
    title: "Style Me Now",
    description: "Tell us where you're going. We'll combine your style, sizes, closet, and today's trends.",
  },
  {
    href: "/trends",
    icon: TrendingUp,
    title: "Trend Radar",
    description: "About 50 current fashion signals — personalized to what already fits your style and closet.",
  },
  {
    href: "/style-like",
    icon: Users,
    title: "Style Like Someone",
    description: "Decode the fashion language of anyone — real or fictional — and translate it into your wardrobe.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      <section className="mx-auto max-w-6xl px-5 pt-20 pb-16 sm:px-8 sm:pt-28">
        <div className="animate-fade-up max-w-3xl">
          <Eyebrow>Runway to Reality — GDG Brooklyn × Vonage</Eyebrow>
          <h1 className="font-serif-display mt-4 text-5xl leading-[1.03] text-ink sm:text-7xl">
            The Jerry
          </h1>
          <p className="font-serif-display mt-5 text-2xl italic text-ink-soft sm:text-3xl">
            Your closet. Your style. Right now.
          </p>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            AI styling that starts with what you already own. Turn the clothes you forgot about into
            outfits you&apos;ll actually wear — powered by Gemini and a live Vonage Video stylist.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Button href="/onboarding" size="lg">
              Start Styling <ArrowRight size={16} />
            </Button>
            <Button href="/onboarding?demo=1" variant="outline" size="lg">
              Try Demo Mode
            </Button>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-paper-warm/50">
        <div className="mx-auto grid max-w-6xl gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {EXPERIENCES.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-4 bg-paper p-7 transition-colors hover:bg-card sm:p-8"
            >
              <Icon size={22} strokeWidth={1.5} className="text-rescue" />
              <div>
                <h2 className="font-serif-display text-xl text-ink">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p>
              </div>
              <span className="mt-auto flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-ink-faint group-hover:text-rescue">
                Explore <ArrowRight size={12} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-20 text-center sm:px-8">
        <p className="font-serif-display text-2xl italic leading-relaxed text-ink sm:text-3xl">
          &ldquo;Most fashion AI helps you buy more clothes. The Jerry does the opposite.&rdquo;
        </p>
        <p className="mt-6 text-ink-soft">
          Gemini understands your wardrobe and current fashion signals. Vonage turns styling into a
          live visual experience. Together, they help you rediscover what you own before ever
          suggesting what to buy.
        </p>
      </section>
    </main>
  );
}
