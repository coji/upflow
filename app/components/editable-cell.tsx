import { LoaderIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Input } from '~/app/components/ui/input'

interface EditableCellProps {
  value: string
  onSave: (newValue: string) => void
  pending?: boolean
  type?: 'text' | 'number'
  className?: string
}

export function EditableCell({
  value,
  onSave,
  pending = false,
  type = 'text',
  className,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const pendingValue = useRef<string | null>(null)

  // Server has caught up once value matches what we submitted
  if (pendingValue.current !== null && value === pendingValue.current) {
    pendingValue.current = null
  }

  const displayValue = pendingValue.current ?? value
  const isSaving = pending && pendingValue.current !== null

  const submit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== displayValue) {
      pendingValue.current = trimmed
      onSave(trimmed)
    } else {
      setDraft(displayValue)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <Input
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={submit}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') {
            setDraft(displayValue)
            setEditing(false)
          }
        }}
        className={`h-7 ${className ?? ''}`}
        autoFocus
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(displayValue)
        setEditing(true)
      }}
      className="hover:bg-muted flex h-7 cursor-pointer items-center gap-1 rounded px-2 text-left"
      title="クリックして編集"
    >
      <span className={isSaving ? 'text-muted-foreground' : undefined}>
        {displayValue}
      </span>
      {isSaving && (
        <LoaderIcon className="text-muted-foreground size-3 animate-spin" />
      )}
    </button>
  )
}
