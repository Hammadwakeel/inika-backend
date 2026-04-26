import { Suspense } from "react";
import LoginContent from "./LoginContent";

function LoadingFallback() {
  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-500"></div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginContent />
    </Suspense>
  );
}