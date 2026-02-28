import { useState } from 'react'
import { Input } from '~/app/components/ui/input'

interface EditableCellProps {
  value: string
  onSave: (newValue: string) => void
  type?: 'text' | 'number'
  className?: string
}

export function EditableCell({
  value,
  onSave,
  type = 'text',
  className,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const submit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      onSave(trimmed)
    } else {
      setDraft(value)
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
            setDraft(value)
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
        setDraft(value)
        setEditing(true)
      }}
      className="hover:bg-muted h-7 cursor-pointer rounded px-2 text-left"
      title="クリックして編集"
    >
      {value}
    </button>
  )
}
