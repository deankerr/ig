import { PlusIcon } from "lucide-react"
import { useState } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

type TagInputProps = {
  onAdd: (tag: string) => void
  placeholder?: string
}

export function TagInput({ onAdd, placeholder = "add tag" }: TagInputProps) {
  const [value, setValue] = useState("")

  function handleAdd() {
    const trimmed = value.trim()
    if (trimmed) {
      onAdd(trimmed)
      setValue("")
    }
  }

  return (
    <InputGroup className="h-7">
      <InputGroupInput
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            handleAdd()
          }
        }}
        placeholder={placeholder}
        className="text-xs"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" onClick={handleAdd}>
          <PlusIcon />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  )
}
