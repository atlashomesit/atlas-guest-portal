import { ReactNode } from "react";
import { getApiBaseUrlSafe } from "@/config/api";

interface ApiConfigGuardProps {
  children: ReactNode;
}

export const ApiConfigGuard = ({ children }: ApiConfigGuardProps) => {
  const apiBaseUrl = getApiBaseUrlSafe();
  if (!apiBaseUrl) {
    // eslint-disable-next-line no-console
    console.warn(
      "[api] API base URL is missing; proceeding with relative requests until configuration is available.",
    );
  }
  return <>{children}</>;
};

export default ApiConfigGuard;
