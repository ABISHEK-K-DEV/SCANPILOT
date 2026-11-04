/**
 * Third-party notices shown in Settings → Open-source licences.
 * Keep in sync with THIRD_PARTY_NOTICES.md. `npm run licenses:check` audits the
 * JavaScript dependency tree for copyleft licences.
 */
export interface LicenseEntry {
  name: string;
  license: string;
  url: string;
  usage: string;
}

export const LICENSES: readonly LicenseEntry[] = [
  { name: 'React Native', license: 'MIT', url: 'https://github.com/facebook/react-native', usage: 'App framework' },
  { name: 'React', license: 'MIT', url: 'https://github.com/facebook/react', usage: 'UI library' },
  { name: 'Expo SDK & Expo Router', license: 'MIT', url: 'https://github.com/expo/expo', usage: 'Native modules, navigation, build tooling' },
  { name: 'pdf-lib', license: 'MIT', url: 'https://github.com/Hopding/pdf-lib', usage: 'Creating and modifying PDFs' },
  { name: 'react-native-pdf', license: 'MIT', url: 'https://github.com/wonday/react-native-pdf', usage: 'PDF viewer' },
  { name: 'AndroidPdfViewer (zacharee fork)', license: 'Apache-2.0', url: 'https://github.com/zacharee/AndroidPdfViewer', usage: 'Android PDF viewer widget' },
  { name: 'PdfiumAndroidKt', license: 'Apache-2.0', url: 'https://github.com/johngray1965/PdfiumAndroidKt', usage: 'Android bindings for PDFium' },
  { name: 'PDFium', license: 'BSD-3-Clause / Apache-2.0', url: 'https://pdfium.googlesource.com/pdfium/', usage: 'Android PDF rendering engine' },
  { name: 'Gson', license: 'Apache-2.0', url: 'https://github.com/google/gson', usage: 'Used by the Android PDF viewer' },
  { name: 'react-native-blob-util', license: 'MIT', url: 'https://github.com/RonRadtke/react-native-blob-util', usage: 'File access for the PDF viewer' },
  { name: 'react-native-pdf-thumbnail', license: 'MIT', url: 'https://github.com/songsterq/react-native-pdf-thumbnail', usage: 'Document thumbnails' },
  { name: 'react-native-document-scanner-plugin', license: 'MIT', url: 'https://github.com/websitebeaver/react-native-document-scanner-plugin', usage: 'iOS document scanner bridge' },
  { name: 'Google ML Kit Document Scanner', license: 'Google APIs Terms of Service (free)', url: 'https://developers.google.com/ml-kit/vision/doc-scanner', usage: 'Android scanning UI via Google Play services' },
  { name: 'Apple VisionKit', license: 'Apple SDK (system framework)', url: 'https://developer.apple.com/documentation/visionkit', usage: 'iOS scanning UI' },
  { name: 'jpeg-js', license: 'BSD-3-Clause', url: 'https://github.com/jpeg-js/jpeg-js', usage: 'Decoding pages for perspective correction' },
  { name: 'Zustand', license: 'MIT', url: 'https://github.com/pmndrs/zustand', usage: 'App state' },
  { name: 'Ionicons (@expo/vector-icons)', license: 'MIT', url: 'https://github.com/ionic-team/ionicons', usage: 'Icons' },
  { name: 'SQLite', license: 'Public domain', url: 'https://sqlite.org/copyright.html', usage: 'Local metadata database' },
  { name: 'react-native-screens, safe-area-context, gesture-handler, reanimated', license: 'MIT', url: 'https://github.com/software-mansion', usage: 'Navigation and layout primitives' },
];
