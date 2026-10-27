import type { PotRecord } from "../types/api";
import { PotCard } from "./PotCard";

interface PotListProps {
  pots: PotRecord[];
  editingId: string | null;
  confirmingDeleteId: string | null;
  deletingId: string | null;
  movement: { potId: string; direction: "deposit" | "withdraw" } | null;
  movementSubmitting: boolean;
  movementError: string | null;
  onEdit: (pot: PotRecord) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
  onStartMovement: (
    pot: PotRecord,
    direction: "deposit" | "withdraw",
  ) => void;
  onCancelMovement: () => void;
  onMovementSubmit: (amount: string) => void;
}

export function PotList({
  pots,
  editingId,
  confirmingDeleteId,
  deletingId,
  movement,
  movementSubmitting,
  movementError,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onStartMovement,
  onCancelMovement,
  onMovementSubmit,
}: PotListProps) {
  return (
    <div className="divide-y divide-stone-100">
      {pots.map((pot) => (
        <PotCard
          key={pot.id}
          pot={pot}
          isEditing={editingId === pot.id}
          confirmingDelete={confirmingDeleteId === pot.id}
          deleting={deletingId === pot.id}
          movementDirection={
            movement?.potId === pot.id ? movement.direction : null
          }
          movementSubmitting={movementSubmitting}
          movementError={
            movement?.potId === pot.id ? movementError : null
          }
          actionsDisabled={
            movementSubmitting ||
            deletingId !== null ||
            (movement !== null && movement.potId !== pot.id)
          }
          onEdit={onEdit}
          onRequestDelete={onRequestDelete}
          onCancelDelete={onCancelDelete}
          onConfirmDelete={onConfirmDelete}
          onStartMovement={onStartMovement}
          onCancelMovement={onCancelMovement}
          onMovementSubmit={onMovementSubmit}
        />
      ))}
    </div>
  );
}
