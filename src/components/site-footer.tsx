import { Link } from "@tanstack/react-router";
import { CONTACT_EMAIL } from "@/lib/legal";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 text-xs text-muted-foreground">
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link to="/terms" className="transition-colors hover:text-foreground">
            Terms &amp; Conditions
          </Link>
          <Link to="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <Link to="/cookies" className="transition-colors hover:text-foreground">
            Cookie Policy
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className="transition-colors hover:text-foreground">
            Contact
          </a>
        </nav>
        <p>© {new Date().getFullYear()} Aria — by Kamran (Zaid Shaik)</p>
      </div>
    </footer>
  );
}
