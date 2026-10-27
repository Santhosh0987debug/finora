import type { BillRecord } from "../types/api";
import { BillCard } from "./BillCard";

interface BillListProps {
  bills: BillRecord[];
  editingId: string | null;
  confirmingDeleteId: string | null;
  deletingId: string | null;
  statusUpdatingId: string | null;
  onEdit: (bill: BillRecord) => void;
  onTogglePaid: (bill: BillRecord) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
}

export function BillList({
  bills,
  editingId,
  confirmingDeleteId,
  deletingId,
  statusUpdatingId,
  onEdit,
  onTogglePaid,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: BillListProps) {
  return (
    <div className="divide-y divide-stone-100">
      {bills.map((bill) => (
        <BillCard
          key={bill.id}
          bill={bill}
          isEditing={editingId === bill.id}
          confirmingDelete={confirmingDeleteId === bill.id}
          deleting={deletingId === bill.id}
          statusUpdating={statusUpdatingId === bill.id}
          actionsDisabled={
            deletingId !== null ||
            (statusUpdatingId !== null && statusUpdatingId !== bill.id)
          }
          onEdit={onEdit}
          onTogglePaid={onTogglePaid}
          onRequestDelete={onRequestDelete}
          onCancelDelete={onCancelDelete}
          onConfirmDelete={onConfirmDelete}
        />
      ))}
    </div>
  );
}
