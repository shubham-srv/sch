// Pages for signed-out users: no app shell.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12 focus:outline-none"
    >
      {children}
    </main>
  );
}
