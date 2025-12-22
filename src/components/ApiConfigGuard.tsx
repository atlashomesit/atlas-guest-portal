import { ReactNode } from "react";
import { API_BASE_URL } from "@/config/api";

interface ApiConfigGuardProps {
  children: ReactNode;
}

const MissingApiConfigNotice = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-bg-muted text-center p-6 gap-4">
    <h1 className="text-2xl font-semibold text-text-primary">We&rsquo;re setting things up</h1>
    <p className="text-text-muted max-w-xl">
      The guest portal can&rsquo;t reach its API right now. Please refresh the page or contact support if this problem
      continues.
    </p>
  </div>
);

export const ApiConfigGuard = ({ children }: ApiConfigGuardProps) => {
  if (!API_BASE_URL) return <MissingApiConfigNotice />;
  return <>{children}</>;
};

export default ApiConfigGuard;
