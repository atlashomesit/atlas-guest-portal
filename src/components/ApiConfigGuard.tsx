import { ReactNode } from "react";

interface ApiConfigGuardProps {
  children: ReactNode;
}

export const ApiConfigGuard = ({ children }: ApiConfigGuardProps) => <>{children}</>;

export default ApiConfigGuard;
