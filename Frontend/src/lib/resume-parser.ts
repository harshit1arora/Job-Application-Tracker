/**
 * resume-parser.ts — In-browser file text extraction for PDF, DOCX, and TXT resumes.
 */

/**
 * Extracts clean plain text from an uploaded resume file (PDF, TXT, DOC/DOCX).
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const fileName = file.name.toLowerCase();

  // 1. Plain text / Markdown
  if (fileName.endsWith(".txt") || fileName.endsWith(".md") || file.type.startsWith("text/")) {
    const raw = await file.text();
    return cleanExtractedText(raw);
  }

  // 2. PDF extraction using PDF.js library
  if (fileName.endsWith(".pdf") || file.type === "application/pdf") {
    try {
      const buffer = await file.arrayBuffer();
      const extracted = await extractTextFromPdfUsingPdfJs(buffer);
      if (extracted.trim().length > 20) {
        return cleanExtractedText(extracted);
      }
    } catch (err) {
      console.warn("PDF.js extraction warning, trying stream decoder fallback:", err);
    }

    // Secondary fallback: PDF stream parser
    try {
      const buffer = await file.arrayBuffer();
      const extracted = extractTextFromPdfBuffer(buffer);
      if (extracted.trim().length > 20) {
        return cleanExtractedText(extracted);
      }
    } catch (err) {
      console.warn("PDF stream decoder warning:", err);
    }
  }

  // 3. DOCX extraction (XML content stream)
  if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
    try {
      const buffer = await file.arrayBuffer();
      const text = extractTextFromDocxBuffer(buffer);
      if (text.trim().length > 20) return cleanExtractedText(text);
    } catch {
      // fallback
    }
  }

  // Generic text fallback
  const text = await file.text();
  return cleanExtractedText(text);
}

/**
 * Uses Mozilla PDF.js to extract all text items and lines across pages
 */
async function extractTextFromPdfUsingPdfJs(buffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || "5.6.205"}/build/pdf.worker.min.mjs`;
    } catch {
      // ignore
    }
  }

  const data = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pageTexts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const strings: string[] = [];

    let lastY: number | null = null;
    for (const item of content.items) {
      if ("str" in item) {
        const textItem = item as { str: string; transform?: number[] };
        const currentY =
          textItem.transform && typeof textItem.transform[5] === "number"
            ? textItem.transform[5]
            : null;

        // If line position changes significantly, add a newline
        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
          strings.push("\n");
        } else if (strings.length > 0 && !strings[strings.length - 1]?.endsWith("\n")) {
          strings.push(" ");
        }

        strings.push(textItem.str);
        if (currentY !== null) lastY = currentY;
      }
    }

    pageTexts.push(strings.join("").trim());
  }

  return pageTexts.join("\n\n");
}

/**
 * Parses PDF string streams and text blocks (BT ... ET markers, Tj / TJ commands)
 */
function extractTextFromPdfBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binaryStr = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binaryStr += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }

  const textChunks: string[] = [];

  // Match parentheses in PDF streams (e.g., (John Doe) Tj or [(John) 10 (Doe)] TJ)
  const tjRegex = /\(([^()]*)\)\s*(?:Tj|'|")/g;
  let match: RegExpExecArray | null;
  while ((match = tjRegex.exec(binaryStr)) !== null) {
    if (match[1]) {
      textChunks.push(decodePdfString(match[1]));
    }
  }

  // Array format: [(Hello) 10 (World)] TJ
  const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
  while ((match = arrayTjRegex.exec(binaryStr)) !== null) {
    const inner = match[1] || "";
    const innerMatches = inner.match(/\((.*?)\)/g);
    if (innerMatches) {
      const line = innerMatches.map((m) => decodePdfString(m.slice(1, -1))).join(" ");
      textChunks.push(line);
    }
  }

  return textChunks.join(" ").trim();
}

function decodePdfString(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

/**
 * Extracts raw XML paragraphs from DOCX binary buffer
 */
function extractTextFromDocxBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    str += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }

  // DOCX XML tags <w:t>Text</w:t>
  const wtRegex = /<w:t[^>]*>(.*?)<\/w:t>/g;
  const parts: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = wtRegex.exec(str)) !== null) {
    if (m[1]) parts.push(m[1]);
  }

  return parts.join(" ").trim();
}

/**
 * Strips raw non-printable binary garbage and normalizes whitespace
 */
export function cleanExtractedText(raw: string): string {
  if (!raw) return "";

  // Filter out non-printable ASCII control characters except \n, \r, \t
  let clean = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, " ");

  // Normalize excessive spacing while preserving intentional newlines
  clean = clean
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
    .join("\n")
    .trim();

  // If text contains too high a ratio of unreadable glyphs, sanitize to printable words
  const printableChars = clean.replace(/[^a-zA-Z0-9\s.,@+\-/#():;]/g, "");
  if (printableChars.length < clean.length * 0.5 && clean.length > 50) {
    return printableChars.replace(/[ \t]+/g, " ").trim();
  }

  return clean;
}

/**
 * Sample resume text for instant 1-click testing
 */
export const SAMPLE_RESUME_PRESET = `
ALEX CARTER
Email: alex.carter@example.com | Phone: +1 (415) 890-2341 | Location: San Francisco, CA
LinkedIn: linkedin.com/in/alexcarter-dev | Portfolio: github.com/alexcarter | Age: 27

PROFESSIONAL SUMMARY
Results-driven Full Stack Software Engineer with 5+ years of experience building modern web platforms, distributed APIs, and scalable AI applications. Proficient in React, TypeScript, Node.js, C# / .NET 8, Python, Next.js, and Cloud Infrastructure.

SKILLS
• Languages & Frameworks: TypeScript, JavaScript (ES6+), Python, C#, React, Next.js, Node.js, ASP.NET Core, Tailwind CSS
• Databases & Cloud: PostgreSQL, MongoDB, Redis, AWS (S3, Lambda), Docker, Firebase, Git CI/CD
• Specialties: Distributed Systems, RESTful APIs, Real-time WebSockets, AI Integration (LLMs & Embeddings), Microservices

EXPERIENCE
Lead Software Engineer | Apex Cloud Systems | San Francisco, CA
2022 – Present
• Architected high-throughput API gateway processing 25M+ daily requests with 99.98% uptime.
• Spearheaded migration of legacy frontend to React 19 and TypeScript, accelerating page load speeds by 42%.
• Built automated CI/CD deployment pipelines cutting release cycle from 3 days to 25 minutes.

Full Stack Developer | NexaTech Solutions | Austin, TX
2020 – 2022
• Developed customer-facing analytics dashboard used by 120,000+ active enterprise users.
• Designed and optimized relational PostgreSQL schemas, reducing query latency by 35%.
• Integrated Stripe subscription billing and automated webhook reconciliation.

EDUCATION
Bachelor of Science in Computer Science
University of California, Berkeley (2016 – 2020)
`;
