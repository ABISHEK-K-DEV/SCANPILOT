import { useState } from 'react';

import { Field, Input } from '@/components/tools/FormBits';
import { SimpleDocTool } from '@/components/tools/SimpleDocTool';
import { AppText } from '@/components/ui';
import { unlockDocument } from '@/services/tools/basicTools';

export default function UnlockScreen() {
  const [password, setPassword] = useState('');
  return (
    <SimpleDocTool
      title="Unlock PDF"
      icon="lock-open-outline"
      intro="Remove the password from a PDF you are allowed to open. You need to know the password."
      actionLabel="Unlock PDF"
      resultTitle="Unlocked copy created"
      validate={() => (password.length === 0 ? 'Enter the PDF password' : null)}
      run={(doc) => unlockDocument(doc, password)}
    >
      {() => (
        <>
          <Field label="Current password">
            <Input value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} accessibilityLabel="PDF password" />
          </Field>
          <AppText variant="caption" tone="muted">
            The password is used only on this device to decrypt the file.
          </AppText>
        </>
      )}
    </SimpleDocTool>
  );
}
