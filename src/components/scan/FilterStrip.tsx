import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { FILTERS, type FilterId } from '@/services/scan/filters';
import { filterPreviews } from '@/services/scan/pageProcessing';
import type { ScanPage } from '@/services/scan/types';
import { useAppTheme } from '@/theme';

interface FilterStripProps {
  page: ScanPage;
  onSelect: (filter: FilterId) => void;
  onApplyToAll: () => void;
  busy?: boolean;
}

/** Horizontal strip of live filter previews for the current page. */
export function FilterStrip({ page, onSelect, onApplyToAll, busy }: FilterStripProps) {
  const { colors, radius, spacing } = useAppTheme();
  const source = page.base?.uri ?? page.uri;
  const [previews, setPreviews] = useState<{ source: string; map: Partial<Record<FilterId, string>> } | null>(null);
  const current = page.filter ?? 'original';

  useEffect(() => {
    let alive = true;
    filterPreviews(
      source,
      FILTERS.map((f) => f.id),
    )
      .then((map) => alive && setPreviews({ source, map }))
      .catch(() => alive && setPreviews({ source, map: {} }));
    return () => {
      alive = false;
    };
  }, [source]);

  const map = previews?.source === source ? previews.map : null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.noGrow}
      contentContainerStyle={{ gap: spacing.sm + 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}
    >
      {FILTERS.map((f) => {
        const selected = current === f.id;
        const uri = map?.[f.id];
        return (
          <Pressable
            key={f.id}
            onPress={() => onSelect(f.id)}
            disabled={busy}
            accessibilityRole="radio"
            accessibilityLabel={`${f.label} filter`}
            accessibilityState={{ selected, disabled: !!busy }}
            style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.94 : selected ? 1.05 : 1 }] }]}
          >
            <View
              style={[
                styles.thumb,
                { borderRadius: radius.md, borderColor: selected ? colors.primary : colors.border, backgroundColor: colors.surfaceAlt },
              ]}
            >
              {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : <ActivityIndicator color={colors.textSubtle} size="small" />}
              {selected ? (
                <View style={[styles.check, { backgroundColor: colors.primary }]}>
                  <Icon name="checkmark" size={12} color={colors.onPrimary} strokeWidth={3} />
                </View>
              ) : null}
            </View>
            <AppText variant="caption" numberOfLines={1} color={selected ? colors.primary : colors.textMuted} style={styles.label}>
              {f.label}
            </AppText>
          </Pressable>
        );
      })}
      <Pressable
        onPress={onApplyToAll}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Apply this filter to all pages"
        style={({ pressed }) => [styles.item, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View style={[styles.thumb, styles.all, { borderRadius: radius.md, borderColor: colors.borderStrong }]}>
          <Icon name="copy-outline" size={20} color={colors.primary} />
        </View>
        <AppText variant="caption" color={colors.textMuted} style={styles.label}>
          Apply to all
        </AppText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  noGrow: { flexGrow: 0, flexShrink: 0 },
  item: { width: 80, alignItems: 'center', gap: 5 },
  thumb: { width: 66, height: 82, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  all: { borderStyle: 'dashed', borderWidth: 1.5 },
  check: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '500' },
});
