"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { DOCS_NAV, lessonHref } from "@/content/docs";
import { cn } from "@/lib/utils/cn";

export function DocsSidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Documentation" className="space-y-5 p-4">
      {DOCS_NAV.map((section) => (
        <div key={section.title}>
          <p className="text-subtle mb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.lessons.map((lesson) => {
              const href = lessonHref(lesson);
              const active = pathname === href;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-panel-hover text-foreground font-medium"
                        : "text-muted hover:bg-panel-hover hover:text-foreground",
                    )}
                  >
                    {lesson.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
