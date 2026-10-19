import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { useParams, useRouter, useSearch } from "@tanstack/react-router";

// Routing helpers over TanStack Router that take plain URLs, so pages can
// build links like `/transactions/${id}` or `/expenses/new?fromTx=${id}`.

/** An in-app link: a real <a> (so open-in-new-tab works) that navigates without a reload. */
export default function Link({
  href,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const goTo = useGoTo();

  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e);
    // Let the browser handle new-tab clicks and anything already handled
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (props.target && props.target !== "_self") return;
    e.preventDefault();
    goTo(href);
  }

  return <a href={href} onClick={handleClick} {...props} />;
}

/** Navigates to a URL inside the app, like router.push. */
export function useGoTo(): (href: string) => void {
  const router = useRouter();
  return (href) => {
    router.navigate({ href });
  };
}

/** The page's query string as plain strings, e.g. { edit: "abc" } for ?edit=abc. */
export function useQuery<T extends Record<string, string | undefined>>(): T {
  return useSearch({ strict: false }) as T;
}

/** A path parameter, e.g. "42" for /transactions/$id at /transactions/42. */
export function useRouteParam(name: string): string {
  return (useParams({ strict: false }) as Record<string, string>)[name];
}
