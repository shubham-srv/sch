import { Suspense } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { CurrentUserMenu, UserMenuSkeleton } from "@/features/auth";

// The app shell for signed-in pages. The proxy has already sent signed-out
// users to the login page.
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <AppTopbar
        userMenu={
          <Suspense fallback={<UserMenuSkeleton />}>
            <CurrentUserMenu />
          </Suspense>
        }
      />
      <div className="flex flex-1">
        <AppSidebar />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 focus:outline-none"
        >
          {children}
        </main>
      </div>
    </>
  );
}
