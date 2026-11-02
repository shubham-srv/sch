import { Button } from "@/components/ui/button";
import { signInWithMicrosoft } from "@/features/auth/api/actions";

export interface LoginFormProps {
  /** Where to go after signing in. The server checks it again. */
  next?: string;
}

// A Server Action form, so it works before any JavaScript has loaded.
export function LoginForm({ next = "/" }: LoginFormProps) {
  return (
    <form action={signInWithMicrosoft} aria-label="Sign in">
      <input type="hidden" name="next" value={next} />
      <Button type="submit" size="lg">
        Sign in with Microsoft
      </Button>
    </form>
  );
}
