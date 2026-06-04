'use client'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Props = {
  id: string
  isSelected: boolean
  isNew: boolean
  isAnyDragging: boolean
  onClick: () => void
  children: React.ReactNode
}

export default function SortableRow({ id, isSelected, isNew, isAnyDragging, onClick, children }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <tr
      ref={setNodeRef}
      onClick={onClick}
      className={isNew && !isSelected ? 'circuit-new' : undefined}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isAnyDragging && !isDragging
          ? `${transition}, background-color 100ms ease`
          : 'background-color 100ms ease',
        opacity:    isDragging ? 0.4 : 1,
        cursor:     'pointer',
        outline:    isSelected ? '1px solid var(--clr-info-a10)' : undefined,
        background: isSelected ? 'var(--clr-info-a0)' : undefined,
      }}
    >
      <td
        className="w-8 text-center text-surface-tonal-a40 cursor-grab select-none"
        {...attributes} {...listeners}
      >⠿</td>
      {children}
    </tr>
  )
}
