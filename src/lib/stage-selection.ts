import type { ReadingStage } from "./types";

type SelectableStage = Pick<ReadingStage, "id" | "status">;

export function preferredStageId(stages: readonly SelectableStage[] | undefined): string | undefined {
  if (!stages?.length) return undefined;
  return (
    stages.find((stage) => stage.status === "active" || stage.status === "awaiting_note")?.id ??
    stages.find((stage) => stage.status === "pending")?.id ??
    stages.at(-1)?.id
  );
}
