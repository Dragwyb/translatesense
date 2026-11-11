/**
 * SkipConfirmation Component
 */

import { ConfirmDialog } from '../../components/ConfirmDialog';
import { getBulkItemLabels } from '../utils/bulkFormatters';

export function SkipConfirmation({
  isOpen,
  postId,
  onClose,
  onConfirm,
  loading = false,
  itemMeta = {},
}) {
  const { singular: itemSingular } = getBulkItemLabels(itemMeta);

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Skip remaining translations?"
      message={`This will skip the remaining pending translations for this ${itemSingular} in the selected batch. Completed translations will not be affected.`}
      confirmLabel="Skip Remaining Translations"
      cancelLabel="Keep Translating"
      isDanger={true}
      loading={loading}
    />
  );
}

