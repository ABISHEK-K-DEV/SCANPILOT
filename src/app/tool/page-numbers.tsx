import { useState } from 'react';

import { ChoiceRow, Field, SwitchRow } from '@/components/tools/FormBits';
import { SimpleDocTool } from '@/components/tools/SimpleDocTool';
import { AppText } from '@/components/ui';
import { formatPageNumber, type NumberFormat, type NumberPosition } from '@/services/pdf/pdfService';
import { numberDocument } from '@/services/tools/basicTools';

export default function PageNumbersScreen() {
  const [position, setPosition] = useState<NumberPosition>('bottom-center');
  const [format, setFormat] = useState<NumberFormat>('n');
  const [skipFirst, setSkipFirst] = useState(false);
  return (
    <SimpleDocTool
      title="Page numbers"
      icon="list-outline"
      intro="Add page numbers to every page, in the position and style you choose."
      actionLabel="Add page numbers"
      resultTitle="Numbered copy created"
      run={(doc) => numberDocument(doc, { position, format, skipFirst })}
    >
      {(doc) => (
        <>
          <Field label="Position">
            <ChoiceRow
              options={[
                { value: 'bottom-center', label: 'Bottom centre' },
                { value: 'bottom-right', label: 'Bottom right' },
                { value: 'bottom-left', label: 'Bottom left' },
                { value: 'top-center', label: 'Top centre' },
                { value: 'top-right', label: 'Top right' },
                { value: 'top-left', label: 'Top left' },
              ]}
              value={position}
              onChange={setPosition}
            />
          </Field>
          <Field label="Style">
            <ChoiceRow
              options={[
                { value: 'n', label: '1' },
                { value: 'n-of-total', label: '1 / 10' },
                { value: 'page-n', label: 'Page 1' },
                { value: 'page-n-of-total', label: 'Page 1 of 10' },
              ]}
              value={format}
              onChange={setFormat}
            />
          </Field>
          <SwitchRow label="Skip the first page" hint="Useful for a cover page" value={skipFirst} onChange={setSkipFirst} />
          <AppText variant="caption" tone="muted">
            Example: “{formatPageNumber(format, 1, doc.pageCount ?? 10)}”
          </AppText>
        </>
      )}
    </SimpleDocTool>
  );
}
