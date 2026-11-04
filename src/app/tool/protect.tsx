import { useState } from 'react';

import { Field, Input, SwitchRow } from '@/components/tools/FormBits';
import { SimpleDocTool } from '@/components/tools/SimpleDocTool';
import { AppText } from '@/components/ui';
import { protectDocument } from '@/services/tools/basicTools';

export default function ProtectScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(false);
  return (
    <SimpleDocTool
      title="Protect PDF"
      icon="lock-closed-outline"
      intro="Add a password (AES-256 encryption). Anyone opening the PDF will need it."
      actionLabel="Protect PDF"
      resultTitle="Protected copy created"
      validate={() => (password.length < 4 ? 'Password: at least 4 characters' : password !== confirm ? 'Passwords do not match' : null)}
      run={(doc) => protectDocument(doc, { password, allowPrinting, allowCopying })}
    >
      {() => (
        <>
          <Field label="Password">
            <Input value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} accessibilityLabel="Password" />
          </Field>
          <Field label="Repeat password">
            <Input value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoCorrect={false} accessibilityLabel="Repeat password" invalid={confirm.length > 0 && confirm !== password} />
          </Field>
          <SwitchRow label="Allow printing" value={allowPrinting} onChange={setAllowPrinting} />
          <SwitchRow label="Allow copying text" value={allowCopying} onChange={setAllowCopying} />
          <AppText variant="caption" tone="muted">
            Keep the password safe — if it is lost, the protected copy cannot be opened. Your original stays unprotected in ScanPilot.
          </AppText>
        </>
      )}
    </SimpleDocTool>
  );
}
