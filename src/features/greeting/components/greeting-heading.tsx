export interface GreetingHeadingProps {
  message: string;
}

export function GreetingHeading({ message }: GreetingHeadingProps) {
  return <h1 className="text-4xl font-semibold tracking-tight">{message}</h1>;
}
