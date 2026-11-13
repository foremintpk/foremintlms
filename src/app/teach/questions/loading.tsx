import { ListSkeleton } from "@/components/communication/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <ListSkeleton rows={4} />
    </div>
  );
}
