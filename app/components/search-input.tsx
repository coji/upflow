import { SearchIcon, XIcon } from 'lucide-react'
import { useRef, useState } from 'react'
import { Input } from '~/app/components/ui/input'
import { cn } from '~/app/libs/utils'

interface SearchInputProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function SearchInput({
  value: controlledValue,
  onChange,
  placeholder = 'Search...',
  className,
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(controlledValue ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const isComposingRef = useRef(false)

  const value = controlledValue ?? internalValue

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInternalValue(newValue)
    if (!isComposingRef.current) {
      onChange(newValue)
    }
  }

  const handleCompositionEnd = (
    e: React.CompositionEvent<HTMLInputElement>,
  ) => {
    isComposingRef.current = false
    const newValue = (e.target as HTMLInputElement).value
    onChange(newValue)
  }

  const handleClear = () => {
    setInternalValue('')
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={cn('relative', className)}>
      <SearchIcon className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
      <Input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onCompositionStart={() => {
          isComposingRef.current = true
        }}
        onCompositionEnd={handleCompositionEnd}
        placeholder={placeholder}
        className="pr-8 pl-8"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="text-muted-foreground hover:text-foreground absolute top-2.5 right-2.5"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </div>
  )
}
