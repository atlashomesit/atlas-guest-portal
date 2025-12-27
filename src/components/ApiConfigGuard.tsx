import { ReactNode } from "react";
import { API_BASE_URL } from "@/config/api";
import ErrorLayout from "./ErrorLayout";

interface ApiConfigGuardProps {
  children: ReactNode;
}

export const ApiConfigGuard = ({ children }: ApiConfigGuardProps) => {
  if (!API_BASE_URL)
    return (
      <ErrorLayout
        title="We couldn’t load this page"
        description="We’re still connecting to the API for this environment. Refresh to try again, or head back to the home page while we sort things out."
        primaryAction={{ label: "Try again", onClick: () => window.location.reload() }}
        secondaryAction={{ label: "Back to home", href: "/" }}
      />
    );
  return <>{children}</>;
};

export default ApiConfigGuard;
