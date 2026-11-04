// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/**
 * Web fix: pdf-lib's ES build imports `tslib`, whose "import" export is a
 * wrapper that default-imports a CommonJS file — Metro's web interop then
 * fails with "Cannot destructure property '__extends' of … undefined".
 * Point web at tslib's pure-ESM build. Native already resolves the CJS build.
 */
const baseResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'tslib') {
    return { type: 'sourceFile', filePath: path.join(path.dirname(require.resolve('tslib')), 'tslib.es6.js') };
  }
  return (baseResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

/**
 * Screenshot/demo build only (SCANPILOT_DEMO=1, see scripts/screenshots/):
 * swaps the storage, database and native-only modules for in-memory demo
 * versions so the real screens can render in a desktop browser. Normal
 * builds never include anything from src/demo/.
 */
if (process.env.SCANPILOT_DEMO === '1') {
  const src = path.join(__dirname, 'src');
  const replacements = {
    'db/database': 'demo/database.ts',
    'db/documentsRepository': 'demo/documentsRepository.ts',
    'db/foldersRepository': 'demo/foldersRepository.ts',
    'db/settingsRepository': 'demo/settingsRepository.ts',
    'services/storage/fileStore': 'demo/fileStore.ts',
    'services/storage/paths': 'demo/paths.ts',
    'services/thumbnails/thumbnailService': 'demo/thumbnailService.ts',
    'services/scan/pageProcessing': 'demo/pageProcessing.ts',
    'components/pdf/PdfViewer': 'demo/PdfViewer.tsx',
    'services/tools/compressService': 'demo/compressService.ts',
    'services/tools/organizeService': 'demo/organizeService.ts',
    'native/pdfRenderer/index': 'demo/pdfRenderer.ts',
    'services/ocr/ocrService': 'demo/ocrService.ts',
  };
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolve = upstream ?? context.resolveRequest;
    const result = resolve(context, moduleName, platform);
    if (result.type === 'sourceFile' && result.filePath.startsWith(src)) {
      const key = path.relative(src, result.filePath).replace(/\\/g, '/').replace(/(\.web)?\.(tsx?|jsx?)$/, '');
      const target = replacements[key];
      if (target) return { type: 'sourceFile', filePath: path.join(src, target) };
    }
    return result;
  };
}

module.exports = config;
