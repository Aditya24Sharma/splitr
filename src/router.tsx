import { Outlet, createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import AppNav from "@/components/AppNav";
import Link from "@/components/Link";
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
  return (
    <>
      <AppNav />
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-10 pb-32 sm:px-6">
        <Outlet />
      </main>
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
