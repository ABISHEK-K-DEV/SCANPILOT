import { useState } from 'react';
import { View } from 'react-native';

import { ChoiceRow, Field, Input } from '@/components/tools/FormBits';
import { SimpleDocTool } from '@/components/tools/SimpleDocTool';
import { AppText } from '@/components/ui';
import { type RgbColor, unsupportedCharacters, type WatermarkOptions } from '@/services/pdf/pdfService';
import { watermarkDocument } from '@/services/tools/basicTools';
import { useAppTheme } from '@/theme';

const COLORS: { value: string; label: string; color: RgbColor }[] = [
  { value: 'red', label: 'Red', color: { r: 0.85, g: 0.2, b: 0.2 } },
  { value: 'grey', label: 'Grey', color: { r: 0.45, g: 0.48, b: 0.55 } },
  { value: 'blue', label: 'Blue', color: { r: 0.18, g: 0.36, b: 1 } },
];

export default function WatermarkScreen() {
  const { colors, radius, spacing } = useAppTheme();
  const [text, setText] = useState('CONFIDENTIAL');
  const [layout, setLayout] = useState<NonNullable<WatermarkOptions['layout']>>('diagonal');
  const [color, setColor] = useState('red');
  const [opacity, setOpacity] = useState(0.25);
  const bad = unsupportedCharacters(text);
  const c = COLORS.find((x) => x.value === color)?.color ?? COLORS[0].color;

  return (
    <SimpleDocTool
      title="Add watermark"
      icon="water-outline"
      intro="Stamp text such as CONFIDENTIAL, DRAFT or your name across every page."
      actionLabel="Add watermark"
      resultTitle="Watermarked copy created"
      validate={() => (!text.trim() ? 'Enter watermark text' : bad.length ? 'Use Latin letters and numbers' : null)}
      run={(doc) => watermarkDocument(doc, { text, layout, color: c, opacity })}
    >
      {() => (
        <>
          <Field label="Text">
            <Input value={text} onChangeText={setText} maxLength={60} autoCapitalize="characters" accessibilityLabel="Watermark text" invalid={bad.length > 0} />
          </Field>
          {bad.length ? (
            <AppText variant="caption" tone="danger">
              Not supported yet: {bad.slice(0, 6).join(' ')}
            </AppText>
          ) : null}
          <Field label="Layout">
            <ChoiceRow options={[{ value: 'diagonal', label: 'Diagonal' }, { value: 'center', label: 'Centre' }, { value: 'tile', label: 'Tiled' }]} value={layout} onChange={setLayout} />
          </Field>
          <Field label="Colour">
            <ChoiceRow options={COLORS.map(({ value, label }) => ({ value, label }))} value={color} onChange={setColor} />
          </Field>
          <Field label="Transparency">
            <ChoiceRow options={[{ value: 0.15, label: 'Light' }, { value: 0.25, label: 'Medium' }, { value: 0.45, label: 'Strong' }]} value={opacity} onChange={setOpacity} />
          </Field>
          <View
            style={{ height: 150, borderRadius: radius.md, backgroundColor: '#FFFFFF', borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: spacing.md }}
            accessibilityLabel="Preview"
          >
            <AppText
              variant="title"
              color={`rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${Math.min(1, opacity * 2)})`}
              style={{ transform: [{ rotate: layout === 'center' ? '0deg' : '-35deg' }] }}
              numberOfLines={1}
            >
              {text || ' '}
            </AppText>
          </View>
        </>
      )}
    </SimpleDocTool>
  );
}
