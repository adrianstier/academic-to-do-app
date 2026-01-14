/**
 * File Content Validation
 *
 * Validates file uploads by checking magic bytes (file signatures)
 * to prevent MIME type spoofing attacks.
 */

/**
 * Magic byte signatures for common file types
 */
const FILE_SIGNATURES: Record<string, { signature: number[]; offset?: number }[]> = {
  // Images
  'image/jpeg': [{ signature: [0xFF, 0xD8, 0xFF] }],
  'image/png': [{ signature: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  'image/gif': [
    { signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
  'image/webp': [{ signature: [0x52, 0x49, 0x46, 0x46], offset: 0 }], // RIFF
  'image/bmp': [{ signature: [0x42, 0x4D] }], // BM
  'image/tiff': [
    { signature: [0x49, 0x49, 0x2A, 0x00] }, // Little endian
    { signature: [0x4D, 0x4D, 0x00, 0x2A] }, // Big endian
  ],

  // Documents
  'application/pdf': [{ signature: [0x25, 0x50, 0x44, 0x46] }], // %PDF

  // Microsoft Office (ZIP-based)
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    { signature: [0x50, 0x4B, 0x03, 0x04] }, // PK ZIP
  ],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    { signature: [0x50, 0x4B, 0x03, 0x04] },
  ],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': [
    { signature: [0x50, 0x4B, 0x03, 0x04] },
  ],

  // Legacy Microsoft Office
  'application/msword': [{ signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }],
  'application/vnd.ms-excel': [{ signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }],
  'application/vnd.ms-powerpoint': [{ signature: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }],

  // Archives
  'application/zip': [{ signature: [0x50, 0x4B, 0x03, 0x04] }],
  'application/x-rar-compressed': [{ signature: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07] }],
  'application/x-7z-compressed': [{ signature: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C] }],
  'application/gzip': [{ signature: [0x1F, 0x8B] }],

  // Audio
  'audio/mpeg': [
    { signature: [0xFF, 0xFB] }, // MP3
    { signature: [0xFF, 0xFA] },
    { signature: [0x49, 0x44, 0x33] }, // ID3
  ],
  'audio/wav': [{ signature: [0x52, 0x49, 0x46, 0x46] }], // RIFF
  'audio/ogg': [{ signature: [0x4F, 0x67, 0x67, 0x53] }], // OggS
  'audio/webm': [{ signature: [0x1A, 0x45, 0xDF, 0xA3] }],
  'audio/mp4': [{ signature: [0x00, 0x00, 0x00], offset: 4 }], // ftyp at offset 4

  // Video
  'video/mp4': [{ signature: [0x00, 0x00, 0x00], offset: 4 }],
  'video/webm': [{ signature: [0x1A, 0x45, 0xDF, 0xA3] }],
  'video/quicktime': [{ signature: [0x00, 0x00, 0x00], offset: 4 }],

  // Text-based (no magic bytes - use extension validation)
  'text/plain': [],
  'text/csv': [],
  'application/json': [],
  'text/html': [],
  'text/css': [],
  'application/javascript': [],
};

/**
 * Dangerous file types that should be blocked
 * Even if disguised with different extension/MIME
 */
const DANGEROUS_SIGNATURES = [
  // Executables
  { signature: [0x4D, 0x5A], name: 'Windows executable (MZ)' }, // .exe, .dll
  { signature: [0x7F, 0x45, 0x4C, 0x46], name: 'Linux executable (ELF)' },
  { signature: [0xCA, 0xFE, 0xBA, 0xBE], name: 'Java class file' },
  { signature: [0xFE, 0xED, 0xFA, 0xCE], name: 'macOS Mach-O 32-bit' },
  { signature: [0xFE, 0xED, 0xFA, 0xCF], name: 'macOS Mach-O 64-bit' },
  { signature: [0xCF, 0xFA, 0xED, 0xFE], name: 'macOS Mach-O 64-bit (reversed)' },

  // Scripts that could be executed
  { signature: [0x23, 0x21], name: 'Shebang script (#!)' }, // Shell scripts
];

export interface FileValidationResult {
  valid: boolean;
  detectedType?: string;
  claimedType: string;
  error?: string;
  warning?: string;
}

/**
 * Check if buffer matches a signature
 */
function matchesSignature(buffer: Uint8Array, signature: number[], offset = 0): boolean {
  if (buffer.length < offset + signature.length) {
    return false;
  }

  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Validate file content against claimed MIME type
 */
export async function validateFileContent(
  file: File,
  claimedMimeType: string
): Promise<FileValidationResult> {
  const buffer = new Uint8Array(await file.slice(0, 64).arrayBuffer());

  // Check for dangerous file signatures first
  for (const dangerous of DANGEROUS_SIGNATURES) {
    if (matchesSignature(buffer, dangerous.signature)) {
      return {
        valid: false,
        claimedType: claimedMimeType,
        error: `Blocked: File appears to be ${dangerous.name}`,
      };
    }
  }

  // Get expected signatures for claimed type
  const expectedSignatures = FILE_SIGNATURES[claimedMimeType];

  // If no signatures defined for this type, allow it (text files, etc.)
  if (!expectedSignatures || expectedSignatures.length === 0) {
    // But warn about potentially dangerous text-based types
    if (claimedMimeType.includes('html') || claimedMimeType.includes('javascript')) {
      return {
        valid: true,
        claimedType: claimedMimeType,
        warning: 'Text-based file type may contain active content',
      };
    }
    return {
      valid: true,
      claimedType: claimedMimeType,
    };
  }

  // Check if file matches any expected signature
  for (const sig of expectedSignatures) {
    if (matchesSignature(buffer, sig.signature, sig.offset || 0)) {
      return {
        valid: true,
        detectedType: claimedMimeType,
        claimedType: claimedMimeType,
      };
    }
  }

  // Try to detect actual type
  for (const [mimeType, signatures] of Object.entries(FILE_SIGNATURES)) {
    for (const sig of signatures) {
      if (matchesSignature(buffer, sig.signature, sig.offset || 0)) {
        return {
          valid: false,
          detectedType: mimeType,
          claimedType: claimedMimeType,
          error: `MIME type mismatch: claimed ${claimedMimeType}, detected ${mimeType}`,
        };
      }
    }
  }

  // Could not validate - might be text file or unknown type
  return {
    valid: false,
    claimedType: claimedMimeType,
    error: 'Could not verify file type matches claimed MIME type',
  };
}

/**
 * Quick validation check - returns boolean
 */
export async function isValidFileType(file: File, claimedMimeType: string): Promise<boolean> {
  const result = await validateFileContent(file, claimedMimeType);
  return result.valid;
}

/**
 * Check if file extension matches MIME type
 */
export function extensionMatchesMime(fileName: string, mimeType: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) return false;

  const mimeToExt: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif'],
    'image/webp': ['webp'],
    'image/bmp': ['bmp'],
    'application/pdf': ['pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['pptx'],
    'application/msword': ['doc'],
    'application/vnd.ms-excel': ['xls'],
    'application/vnd.ms-powerpoint': ['ppt'],
    'application/zip': ['zip'],
    'text/plain': ['txt'],
    'text/csv': ['csv'],
    'audio/mpeg': ['mp3'],
    'audio/wav': ['wav'],
    'video/mp4': ['mp4'],
    'video/webm': ['webm'],
  };

  const allowedExtensions = mimeToExt[mimeType];
  if (!allowedExtensions) return true; // Unknown MIME type, allow

  return allowedExtensions.includes(ext);
}

/**
 * SVG Security Check
 * SVGs can contain JavaScript - need special handling
 */
export async function isSvgSafe(file: File): Promise<{ safe: boolean; reason?: string }> {
  const content = await file.text();

  // Check for JavaScript
  if (/<script/i.test(content)) {
    return { safe: false, reason: 'SVG contains script element' };
  }

  // Check for event handlers
  if (/\bon\w+\s*=/i.test(content)) {
    return { safe: false, reason: 'SVG contains event handlers' };
  }

  // Check for external resources
  if (/xlink:href|href\s*=\s*["'](?!#)/i.test(content)) {
    return { safe: false, reason: 'SVG contains external references' };
  }

  // Check for data URIs with scripts
  if (/data:\s*(?:text\/html|application\/javascript)/i.test(content)) {
    return { safe: false, reason: 'SVG contains potentially dangerous data URI' };
  }

  return { safe: true };
}
