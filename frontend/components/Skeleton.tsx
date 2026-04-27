interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 ${className || ""}`} />;
}

export function SkeletonCard({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return <div className={`animate-pulse border border-black bg-white p-6 ${className || ""}`}>{children}</div>;
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === lines - 1 ? "w-3/4" : "w-full"}`} />
      ))}
    </div>
  );
}

export function ModuleCardSkeleton() {
  return (
    <SkeletonCard>
      <div className="mb-4 flex items-start justify-between">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-4 w-4" />
      </div>
      <Skeleton className="mb-2 h-5 w-24" />
      <Skeleton className="mb-4 h-3 w-32" />
      <div className="border-t border-black pt-4">
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center">
              <Skeleton className="mx-auto mb-1 h-6 w-8" />
              <Skeleton className="mx-auto h-2 w-10" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonCard>
  );
}

export function TableRowSkeleton({ cells = 5 }: { cells?: number }) {
  return (
    <div className="flex items-center gap-4 border-b border-black p-4">
      {Array.from({ length: cells }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === 0 ? "w-32" : i === cells - 1 ? "w-20" : "w-24"}`} />
      ))}
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex h-[calc(100vh-320px)]">
      <aside className="w-80 shrink-0 border-r border-black p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="mb-4 flex items-start gap-3 border-b border-gray-100 pb-4">
            <Skeleton className="h-10 w-10 shrink-0" />
            <div className="flex-1">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </aside>
      <div className="flex flex-1 flex-col">
        <div className="border-b border-black bg-gray-50 p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10" />
            <div>
              <Skeleton className="mb-1 h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
        <div className="flex-1 p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`mb-4 ${i % 2 === 0 ? "mr-auto" : "ml-auto"}`}>
              <Skeleton className={`h-16 ${i % 2 === 0 ? "w-48" : "w-36"}`} />
            </div>
          ))}
        </div>
        <div className="border-t border-black p-4">
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export function QrSkeleton() {
  return (
    <div className="mb-8 border border-black p-8 text-center">
      <Skeleton className="mx-auto mb-6 h-12 w-12" />
      <Skeleton className="mx-auto mb-4 h-6 w-32" />
      <Skeleton className="mx-auto mb-4 h-4 w-48" />
      <Skeleton className="mx-auto h-64 w-64" />
      <div className="mt-6 flex items-center justify-center gap-4">
        <Skeleton className="h-12 w-32" />
        <Skeleton className="h-12 w-32" />
      </div>
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <header className="mb-12 border-b border-black pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="mb-1 h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </header>
  );
}