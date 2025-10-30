import React, { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './DraggableSelect.css';

interface Option {
  id: string;
  value: string;
  label: string;
  order: number;
}

interface Props {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  onReorder: (reordered: Option[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

function SortableOption({ 
  option, 
  isSelected,
  onClick 
}: { 
  option: Option;
  isSelected: boolean;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: option.id,
    // Add this to make it work better
    transition: {
      duration: 200,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'default',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`draggable-option ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
    >
      <div
        className="drag-handle"
        {...attributes}
        {...listeners}
        title="Drag to reorder"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="4" cy="3" r="1.2"/>
          <circle cx="10" cy="3" r="1.2"/>
          <circle cx="4" cy="7" r="1.2"/>
          <circle cx="10" cy="7" r="1.2"/>
          <circle cx="4" cy="11" r="1.2"/>
          <circle cx="10" cy="11" r="1.2"/>
        </svg>
      </div>
      <div 
        className="option-label" 
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {option.label}
      </div>
    </div>
  );
}

export default function DraggableSelect({
  value,
  options,
  onChange,
  onReorder,
  placeholder = 'Select...',
  disabled = false
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState(options);
  const [isDragging, setIsDragging] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ✅ FIX: More permissive sensor configuration
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Reduce from 8 to 5 pixels
      },
    })
  );

  useEffect(() => {
    // Sort by order when options change
    const sorted = [...options].sort((a, b) => (a.order || 0) - (b.order || 0));
    setItems(sorted);
    console.log('📋 Loaded options:', sorted);
  }, [options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    console.log('🎯 Drag started:', event.active.id);
    setIsDragging(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    console.log('🎯 Drag ended:', { active: active.id, over: over?.id });
    setIsDragging(false);

    if (!over || active.id === over.id) {
      console.log('⚠️ No reorder needed');
      return;
    }

    setItems((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      console.log('📊 Reordering:', { oldIndex, newIndex });

      if (oldIndex === -1 || newIndex === -1) {
        console.error('❌ Invalid indices');
        return items;
      }

      const reordered = arrayMove(items, oldIndex, newIndex);
      
      // Update order field
      const withNewOrder = reordered.map((item, index) => ({
        ...item,
        order: index
      }));

      console.log('✅ New order:', withNewOrder.map(i => i.label));

      // Save to server
      onReorder(withNewOrder);

      return withNewOrder;
    });
  };

  const selectedOption = items.find(opt => opt.value === value);

  return (
    <div className="draggable-select" ref={dropdownRef}>
      <button
        type="button"
        className={`select-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className={selectedOption ? '' : 'placeholder'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg 
          className={`arrow ${isOpen ? 'rotate' : ''}`}
          width="16" 
          height="16" 
          viewBox="0 0 16 16" 
          fill="currentColor"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      </button>

      {isOpen && (
        <div className="select-dropdown">
          {items.length === 0 ? (
            <div className="empty-state">No options</div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={items.map(i => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className={`options-list ${isDragging ? 'dragging' : ''}`}>
                  {items.map((option) => (
                    <SortableOption
                      key={option.id}
                      option={option}
                      isSelected={option.value === value}
                      onClick={() => {
                        console.log('📝 Selected:', option.label);
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      )}
    </div>
  );
}