import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { ChoiceRow, Field, Input } from '@/components/tools/FormBits';
import { Button, ProgressOverlay, Screen } from '@/components/ui';
import { createTextPdf, type TextStyle } from '@/services/tools/textToPdf';
import { useAppTheme } from '@/theme';
import { errorMessage } from '@/utils/errors';

export default function TextToPdfScreen() {
  const { spacing } = useAppTheme();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [style, setStyle] = useState<TextStyle>('document');
  const [size, setSize] = useState(12);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const doc = await createTextPdf(title, body, style, size);
      router.replace({ pathname: '/document/[id]', params: { id: doc.id } });
    } catch (error) {
      Alert.alert('Could not create PDF', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll edges={['left', 'right', 'bottom']} contentStyle={{ paddingTop: spacing.lg, gap: spacing.lg }}>
      <Stack.Screen options={{ title: 'Text to PDF' }} />
      <Field label="Title">
        <Input value={title} onChangeText={setTitle} placeholder="e.g. Leave application" accessibilityLabel="Title" />
      </Field>
      <Field label="Text">
        <Input
          value={body}
          onChangeText={setBody}
          placeholder="Write or paste your text — any language works."
          multiline
          textAlignVertical="top"
          accessibilityLabel="Text"
          style={{ minHeight: 220, paddingTop: 12 }}
        />
      </Field>
      <Field label="Style">
        <ChoiceRow options={[{ value: 'document', label: 'Document' }, { value: 'letter', label: 'Letter' }, { value: 'notes', label: 'Lined notes' }]} value={style} onChange={setStyle} />
      </Field>
      <Field label="Text size">
        <ChoiceRow options={[{ value: 11, label: 'Small' }, { value: 12, label: 'Normal' }, { value: 14, label: 'Large' }]} value={size} onChange={setSize} />
      </Field>
      <Button label="Create PDF" icon="document-text-outline" fullWidth disabled={!title.trim() && !body.trim()} onPress={() => void create()} />
      <ProgressOverlay visible={busy} title="Creating PDF" progress={null} />
    </Screen>
  );
}
