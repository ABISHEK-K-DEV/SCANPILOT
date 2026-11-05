import { guideForRoute, TOOL_GUIDES } from '../toolGuides';
import { TOOLS } from '../tools';

describe('tool guides', () => {
  it('has a guide with three steps for every tool', () => {
    for (const t of TOOLS) {
      const id = t.id === 'import-pdf' ? null : t.id; // importing needs no walkthrough
      if (!id) continue;
      expect(TOOL_GUIDES[id]).toBeDefined();
      expect(TOOL_GUIDES[id].steps).toHaveLength(3);
      expect(TOOL_GUIDES[id].id).toBe(id);
    }
  });

  it('maps routes (with their params) to the right guide', () => {
    expect(guideForRoute('/tool/merge', {})?.id).toBe('merge');
    expect(guideForRoute('/tool/ocr', { output: 'word' })?.id).toBe('pdf-to-word');
    expect(guideForRoute('/tool/ocr', {})?.id).toBe('ocr');
    expect(guideForRoute('/tool/pdf-to-office', { format: 'xlsx' })?.id).toBe('pdf-to-excel');
    expect(guideForRoute('/tool/pdf-to-office', { format: 'pptx' })?.id).toBe('pdf-to-ppt');
    expect(guideForRoute('/tool/split', { mode: 'extract' })?.id).toBe('extract-pages');
    expect(guideForRoute('/scan/camera', { scanMode: 'id-card' })?.id).toBe('scan-id-card');
    expect(guideForRoute('/scan/camera', {})?.id).toBe('camera');
    expect(guideForRoute('/scan/camera', { mode: 'replace' })).toBeNull();
    expect(guideForRoute('/settings', {})).toBeNull();
  });
});
