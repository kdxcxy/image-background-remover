import { useState, useCallback, useRef, type DragEvent, type ChangeEvent } from 'react'

type Status = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function base64ToBlob(base64: string): string {
  return `data:image/png;base64,${base64}`
}

export default function App() {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrorMsg('不支持的文件格式，请上传 PNG、JPG 或 WEBP 图片')
      setStatus('error')
      return
    }
    if (file.size > MAX_SIZE) {
      setErrorMsg('文件大小超过 10MB 限制')
      setStatus('error')
      return
    }

    setFileName(file.name)
    setStatus('processing')
    setErrorMsg('')
    setOriginalUrl(URL.createObjectURL(file))

    try {
      const base64 = await toBase64(file)
      const res = await fetch('/api/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '处理失败')
        throw new Error(text)
      }

      const data = await res.json()
      setResultUrl(base64ToBlob(data.image))
      setStatus('done')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '处理失败，请重试')
      setStatus('error')
    }
  }, [])

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) processFile(file)
        return
      }
    }
  }, [processFile])

  // Global paste listener
  useState(() => {
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  })

  const handleDownload = () => {
    if (!resultUrl || !fileName) return
    const baseName = fileName.replace(/\.[^.]+$/, '')
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = `removed_bg_${baseName}.png`
    a.click()
  }

  const handleReset = () => {
    setStatus('idle')
    setErrorMsg('')
    setOriginalUrl(null)
    setResultUrl(null)
    setFileName('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      {/* Header */}
      <header className="py-6 px-4 text-center">
        <h1 className="text-3xl font-bold text-gray-800">✨ AI 背景去除</h1>
        <p className="mt-2 text-gray-500">上传图片，一键去除背景</p>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-4xl">
          {/* Upload Area */}
          {(status === 'idle' || status === 'error') && (
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`
                relative cursor-pointer border-2 border-dashed rounded-2xl p-12 text-center transition-all
                ${dragOver
                  ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                  : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-gray-50'}
              `}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={handleInput}
                className="hidden"
              />
              <div className="text-5xl mb-4">🖼️</div>
              <p className="text-lg font-medium text-gray-700">
                拖拽图片到这里，或点击上传
              </p>
              <p className="mt-2 text-sm text-gray-400">
                支持 PNG / JPG / WEBP，最大 10MB · 也可以 Ctrl+V 粘贴
              </p>
              {status === 'error' && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  ⚠️ {errorMsg}
                </div>
              )}
            </div>
          )}

          {/* Processing */}
          {status === 'processing' && (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
              <div className="inline-block w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-700">正在处理中...</p>
              <p className="mt-2 text-sm text-gray-400">AI 正在分析并去除背景，请稍候</p>
            </div>
          )}

          {/* Result */}
          {status === 'done' && originalUrl && resultUrl && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original */}
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2 text-center">原图</p>
                  <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                    <img src={originalUrl} alt="原图" className="w-full object-contain max-h-80 mx-auto" />
                  </div>
                </div>
                {/* Result */}
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2 text-center">去背景后</p>
                  <div
                    className="rounded-xl overflow-hidden border border-gray-200 checkerboard"
                    style={{ backgroundImage: 'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px' }}
                  >
                    <img src={resultUrl} alt="去背景" className="w-full object-contain max-h-80 mx-auto" />
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-6">
                <button
                  onClick={handleDownload}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors shadow-sm"
                >
                  📥 下载 PNG
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                >
                  重新上传
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-gray-400">
        AI 背景去除工具 · 所有处理均在服务端完成
      </footer>
    </div>
  )
}
