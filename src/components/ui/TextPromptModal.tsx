import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { elevation, useAppTheme } from '@/theme';
import { errorMessage } from '@/utils/errors';
import { MAX_NAME_LENGTH, validateName } from '@/utils/filename';

import { AppText } from './AppText';
import { Button } from './Button';

interface TextPromptModalProps {
  visible: boolean;
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** Mask input (passwords). Disables name validation and length limits. */
  secureTextEntry?: boolean;
  /** Return an error message to block submission. Defaults to file-name validation. */
  validate?: (value: string) => string | null;
  onCancel: () => void;
  /** Throw to keep the dialog open and show the error inline. */
  onSubmit: (value: string) => Promise<void> | void;
}

/** Cross-platform text prompt (Alert.prompt is iOS-only). */
export function TextPromptModal(props: TextPromptModalProps) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onCancel} statusBarTranslucent>
      {/* Mounted only while visible so its state starts fresh every time the dialog opens. */}
      {props.visible ? <PromptBody {...props} /> : null}
    </Modal>
  );
}

function PromptBody({
  title,
  message,
  initialValue = '',
  placeholder,
  confirmLabel = 'Save',
  secureTextEntry = false,
  validate,
  onCancel,
  onSubmit,
}: TextPromptModalProps) {
  const { colors, radius, spacing, typography, dark } = useAppTheme();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const check = validate ?? (secureTextEntry ? (v: string) => (v.length === 0 ? 'Enter the password.' : null) : validateName);
    const problem = check(value);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      await onSubmit(secureTextEntry ? value : value.trim());
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onCancel} accessibilityLabel="Dismiss">
          <Pressable
            onPress={() => undefined}
            accessible={false}
            style={[
              styles.panel,
              { backgroundColor: colors.surfaceRaised, borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md, borderColor: colors.border, borderWidth: dark ? StyleSheet.hairlineWidth : 0 },
              !dark && elevation.raised,
            ]}
          >
            <AppText variant="heading" style={styles.title}>
              {title}
            </AppText>
            {message ? <AppText tone="muted">{message}</AppText> : null}
            <TextInput
              value={value}
              onChangeText={(text) => {
                setValue(text);
                if (error) setError(null);
              }}
              placeholder={placeholder}
              placeholderTextColor={colors.textSubtle}
              autoFocus
              selectTextOnFocus={!secureTextEntry}
              secureTextEntry={secureTextEntry}
              autoCapitalize={secureTextEntry ? 'none' : 'sentences'}
              autoCorrect={!secureTextEntry}
              maxLength={secureTextEntry ? undefined : MAX_NAME_LENGTH}
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel={title}
              style={[
                typography.body,
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.md,
                  borderColor: error ? colors.danger : colors.borderStrong,
                  paddingHorizontal: spacing.md,
                },
              ]}
            />
            {error ? (
              <AppText tone="danger" variant="caption" accessibilityRole="alert">
                {error}
              </AppText>
            ) : null}
            <View style={[styles.actions, { gap: spacing.sm, marginTop: spacing.xs }]}>
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={({ pressed }) => [styles.cancel, { borderRadius: radius.md + 2, backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.85 : 1 }]}
              >
                <AppText variant="bodyStrong">Cancel</AppText>
              </Pressable>
              <Button label={confirmLabel} onPress={submit} loading={busy} style={styles.flex} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  panel: { width: '100%', maxWidth: 380 },
  input: { minHeight: 50, borderWidth: 1 },
  actions: { flexDirection: 'row' },
  cancel: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, lineHeight: 24 },
});
