// OCR assistivo (lazy). Carrega o tesseract.js sob demanda para não pesar no bundle.
// Princípio do master: OCR é ASSISTENTE — o resultado sempre passa por revisão manual.

type RecognizeFn = (
  image: File | Blob,
  lang: string,
  options: { logger: (m: { status: string; progress: number }) => void }
) => Promise<{ data: { text: string } }>;

export async function ocrImagem(
  file: File | Blob,
  onProgress?: (progress: number) => void
): Promise<string> {
  const mod = (await import("tesseract.js")) as unknown as {
    recognize?: RecognizeFn;
    default?: { recognize: RecognizeFn };
  };
  const recognize = mod.recognize ?? mod.default?.recognize;
  if (!recognize) throw new Error("Falha ao carregar o motor de OCR.");

  const { data } = await recognize(file, "por", {
    logger: (m) => {
      if (m.status === "recognizing text" && onProgress) onProgress(m.progress);
    },
  });
  return data.text ?? "";
}
