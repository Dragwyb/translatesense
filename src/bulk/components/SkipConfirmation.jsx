/**
 * SkipConfirmation Component
 */

import { ConfirmDialog } from '../../components/ConfirmDialog';

export function SkipConfirmation({
  isOpen,
  postId,
  onClose,
  onConfirm,
  loading = false,
}) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Skip remaining translations?"
      message="This will skip the remaining pending translations for this post in the selected batch. Completed translations will not be affected."
      confirmLabel="Skip Remaining Translations"
      cancelLabel="Keep Translating"
      isDanger={true}
      loading={loading}
    />
  );
}

