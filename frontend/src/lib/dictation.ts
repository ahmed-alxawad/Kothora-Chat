/**
 * Voice typing with the browser's speech recognition (Chrome, Edge, Safari). Speech is
 * processed by the browser vendor's service, not by Kothora. Returns null where the
 * browser has no support, so the microphone button can hide itself.
 */
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult:
    | ((event: {
        resultIndex: number
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
      }) => void)
    | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

export type Dictation = { stop(): void }

export function dictationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  )
}

export function startDictation(options: {
  language: "bn-BD" | "en-US"
  onText: (finalText: string) => void
  onEnd: (error?: string) => void
}): Dictation | null {
  const Ctor =
    (window as unknown as Record<string, new () => Recognition>).SpeechRecognition ??
    (window as unknown as Record<string, new () => Recognition>).webkitSpeechRecognition
  if (!Ctor) return null
  const recognition = new Ctor()
  recognition.lang = options.language
  recognition.interimResults = false
  recognition.continuous = true
  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      if (result.isFinal) options.onText(result[0].transcript)
    }
  }
  recognition.onerror = (event) =>
    options.onEnd(event.error === "not-allowed" ? "Microphone access was blocked." : event.error)
  recognition.onend = () => options.onEnd()
  recognition.start()
  return { stop: () => recognition.stop() }
}
