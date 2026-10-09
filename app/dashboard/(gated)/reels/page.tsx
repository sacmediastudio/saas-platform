import { requirePagePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import ReelsView from "./reels-view";

export default async function ReelsPage() {
  const session = await requirePagePermission("PROMOTIONS");
  const reels = await db.reel.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
  });
  return (
    <ReelsView
      initialReels={reels.map((r) => ({
        id: r.id,
        videoUrl: r.videoUrl,
        posterUrl: r.posterUrl,
        durationSec: r.durationSec,
        caption: r.caption,
        likesCount: r.likesCount,
      }))}
    />
  );
}
