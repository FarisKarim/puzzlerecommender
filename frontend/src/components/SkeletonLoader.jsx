import { Skeleton } from "@/components/ui/skeleton";

function SkeletonLoader() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-[180px]" />
      <Skeleton className="h-4 w-[140px]" />
      <Skeleton className="h-4 w-[180px]" />
      <Skeleton className="h-4 w-[140px]" />
    </div>
  );
}

export default SkeletonLoader;
