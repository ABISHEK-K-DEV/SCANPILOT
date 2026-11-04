import { router } from 'expo-router';
import { useState } from 'react';

import { ChoiceRow, Field } from '@/components/tools/FormBits';
import { SimpleDocTool } from '@/components/tools/SimpleDocTool';
import { Button } from '@/components/ui';
import type { RotationDelta } from '@/services/pdf/types';
import { rotateDocument } from '@/services/tools/basicTools';

export default function RotateScreen() {
  const [delta, setDelta] = useState<RotationDelta>(90);
  return (
    <SimpleDocTool
      title="Rotate PDF"
      icon="refresh-outline"
      intro="Turn all pages at once. To rotate single pages, use Organise pages."
      actionLabel="Rotate pages"
      resultTitle="Rotated copy created"
      run={(doc) => rotateDocument(doc, delta)}
    >
      {(doc) => (
        <>
          <Field label="Direction">
            <ChoiceRow
              options={[
                { value: 90, label: '↻ 90° right' },
                { value: -90, label: '↺ 90° left' },
                { value: 180, label: '180°' },
              ]}
              value={delta}
              onChange={setDelta}
            />
          </Field>
          <Button label="Rotate individual pages instead" variant="ghost" icon="albums-outline" onPress={() => router.push({ pathname: '/tool/organize', params: { id: doc.id } })} />
        </>
      )}
    </SimpleDocTool>
  );
}
