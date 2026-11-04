import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText, Button, Icon, type IconName } from '@/components/ui';
import { isOcrSupported, recogniseImages } from '@/services/ocr/ocrService';
import { type CardContact, hasContactDetails, parseBusinessCard, toVCard } from '@/services/scan/businessCard';
import { shareBytes } from '@/services/share/shareService';
import { appAlert, toast } from '@/stores/dialogStore';
import { useAppTheme } from '@/theme';
import { errorMessage } from '@/utils/errors';
import { exportFileName } from '@/utils/filename';

const encoder = new TextEncoder();

function Row({ icon, value }: { icon: IconName; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={15} color={colors.textMuted} />
      <AppText variant="caption" numberOfLines={2} style={styles.flex}>
        {value}
      </AppText>
    </View>
  );
}

/** Reads the business card on the phone and offers it as a contact (.vcf). */
export function BusinessCardPanel({ imageUri }: { imageUri: string }) {
  const { colors, radius, spacing } = useAppTheme();
  const [state, setState] = useState<{ uri: string; contact: CardContact | null; error?: string } | null>(null);
  const supported = isOcrSupported();

  useEffect(() => {
    if (!supported) return;
    let alive = true;
    recogniseImages([imageUri], 'en')
      .then((run) => alive && setState({ uri: imageUri, contact: parseBusinessCard(run.pages[0]?.text ?? '') }))
      .catch((e: unknown) => alive && setState({ uri: imageUri, contact: null, error: errorMessage(e) }));
    return () => {
      alive = false;
    };
  }, [imageUri, supported]);

  if (!supported) {
    return (
      <AppText variant="caption" tone="muted" style={{ paddingHorizontal: spacing.lg }}>
        Reading business cards uses on-device text recognition, available on Android.
      </AppText>
    );
  }
  const current = state?.uri === imageUri ? state : null;
  if (!current) {
    return (
      <View style={[styles.loading, { gap: spacing.sm }]}>
        <ActivityIndicator color={colors.primary} />
        <AppText variant="caption" tone="muted">
          Reading the card…
        </AppText>
      </View>
    );
  }
  const c = current.contact;
  if (!c || !hasContactDetails(c)) {
    return (
      <AppText variant="caption" tone="muted" style={{ paddingHorizontal: spacing.lg }}>
        {current.error ?? 'No contact details found. Try a sharper photo with the card filling the frame.'}
      </AppText>
    );
  }
  const name = c.name ?? c.company ?? 'Business card';
  const summary = [c.name, c.title, c.company, ...c.phones, ...c.emails, ...c.websites, c.address].filter(Boolean).join('\n');
  return (
    <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: 6 }]}>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
            <Icon name="person" size={18} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {name}
            </AppText>
            {c.title || c.company ? (
              <AppText variant="caption" tone="muted" numberOfLines={1}>
                {[c.title, c.name ? c.company : null].filter(Boolean).join(' · ')}
              </AppText>
            ) : null}
          </View>
        </View>
        {c.phones.map((p) => (
          <Row key={p} icon="phone" value={p} />
        ))}
        {c.emails.map((e) => (
          <Row key={e} icon="mail" value={e} />
        ))}
        {c.websites.map((w) => (
          <Row key={w} icon="globe" value={w} />
        ))}
      </View>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Button
          label="Save contact"
          icon="contact"
          compact
          style={styles.flex}
          onPress={() =>
            void shareBytes(exportFileName(name, 'vcf'), encoder.encode(toVCard(c)), 'text/x-vcard', 'public.vcard').catch((e) =>
              appAlert('Could not share the contact', errorMessage(e)),
            )
          }
        />
        <Button label="Copy" icon="copy-outline" variant="secondary" compact onPress={() => void Clipboard.setStringAsync(summary).then(() => toast('Contact details copied'))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loading: { alignItems: 'center', paddingVertical: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
