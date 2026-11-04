import { SimpleDocTool } from '@/components/tools/SimpleDocTool';
import { AppText } from '@/components/ui';
import { repairDocument } from '@/services/tools/basicTools';

export default function RepairScreen() {
  return (
    <SimpleDocTool
      title="Repair PDF"
      icon="construct-outline"
      intro="Rebuilds a damaged PDF that won't open or shows errors, recovering every readable page."
      actionLabel="Repair PDF"
      resultTitle="Repaired copy created"
      run={(doc) => repairDocument(doc)}
    >
      {() => (
        <AppText variant="caption" tone="muted">
          ScanPilot copies every readable page into a fresh file with a new structure. Severely damaged files may not be recoverable.
        </AppText>
      )}
    </SimpleDocTool>
  );
}
