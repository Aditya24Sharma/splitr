import { Outlet, createRootRoute, createRoute, createRouter, useRouterState } from "@tanstack/react-router";
import AppNav, { BottomTabs } from "@/components/AppNav";
import Link from "@/components/Link";
import { Toasts } from "@/components/Toasts";
import { Button } from "@/components/ui/Button";
import MoneyPage from "./pages/money";
import SplitsPage from "./pages/splits";
import PeoplePage from "./pages/people";
import TagsPage from "./pages/tags";
import BanksPage from "./pages/banks";
import TransactionPage from "./pages/transaction";
import AddExpensePage from "./pages/add-expense";
import NewExpensePage from "./pages/new-chooser";
import NewSimplePage from "./pages/quick-split";
import NewItemizedPage from "./pages/receipt";
import ExpenseDetailPage from "./pages/expense";

function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      <AppNav />
      {/* Bottom space clears the phone tab bar and the iPhone home indicator */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-10 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6">
        {/* Keyed by path, so each page eases in when you open it */}
        <div key={pathname} className="page-in">
          <Outlet />
        </div>
      </main>
      <BottomTabs />
      <Toasts />
    </>
  );
}

function NotFound() {
  return (
    <div className="py-16 space-y-4 text-center">
      <p className="font-display text-4xl uppercase">Page not found</p>
      <Link href="/">
        <Button variant="secondary">Back to Money</Button>
      </Link>
    </div>
  );
}

const rootRoute = createRootRoute({ component: Layout, notFoundComponent: NotFound });

const page = (path: string, component: () => React.ReactNode) =>
  createRoute({ getParentRoute: () => rootRoute, path, component });

const routeTree = rootRoute.addChildren([
  page("/", MoneyPage),
  page("/splits", SplitsPage),
  page("/people", PeoplePage),
  page("/tags", TagsPage),
  page("/accounts", BanksPage),
  page("/transactions/new", AddExpensePage),
  page("/transactions/$id", TransactionPage),
  page("/expenses/new", NewExpensePage),
  page("/expenses/new/simple", NewSimplePage),
  page("/expenses/new/itemized", NewItemizedPage),
  page("/expenses/$id", ExpenseDetailPage),
]);

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  // Plain query strings (?fromTx=12), the same URLs the app has always used.
  // TanStack's default JSON-encodes values, which would turn them into ?fromTx=%2212%22.
  parseSearch: (search) => Object.fromEntries(new URLSearchParams(search)),
  stringifySearch: (values) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined && value !== null) params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `?${query}` : "";
  },
});
