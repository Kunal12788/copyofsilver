
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface SingleDatePickerProps {
  value: string | null;
  onChange: (date: string) => void;
  className?: string;
  placeholder?: string;
}

export const SingleDatePicker: React.FC<SingleDatePickerProps> = ({ value, onChange, className = "", placeholder = 'Select Date' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setViewDate(new Date(value));
    }
  }, [value]);

  const formatDateDisplay = (dateStr: string | null) => {
    if (!dateStr) return placeholder;
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const toLocalISO = (date: Date) => {
    const offset = date.getTimezoneOffset();
    const d = new Date(date.getTime() - (offset * 60 * 1000));
    return d.toISOString().split('T')[0];
  };

  const updatePosition = () => {
    if (buttonRef.current && isOpen) {
        const btnRect = buttonRef.current.getBoundingClientRect();
        let width = 300; // Fixed calendar width
        let left = btnRect.left;
        let top = btnRect.bottom + 8;

        // Prevent overflow to the right
        if (left + width > window.innerWidth - 16) {
            left = btnRect.right - width;
        }
        // Prevent overflow to the left
        if (left < 16) left = 16;

        setPosition({ top, left });
    }
  };

  useLayoutEffect(() => {
      if (isOpen) updatePosition();
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current && 
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    
    const handleResize = () => { if(isOpen) requestAnimationFrame(updatePosition); };

    if (isOpen) {
        window.addEventListener('resize', handleResize);
        window.addEventListener('scroll', handleResize, true);
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleResize, true);
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleDayClick = (day: number) => {
      const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
      onChange(toLocalISO(newDate));
      setIsOpen(false);
  };

  const changeMonth = (offset: number) => {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  const renderCalendar = () => {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay(); 
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const currentSelected = value ? new Date(value) : null;

      return (
          <div className="w-[300px] p-4 bg-white rounded-2xl shadow-xl border border-slate-100 font-sans">
              <div className="flex justify-between items-center mb-4">
                  <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-colors"><ChevronLeft className="w-5 h-5"/></button>
                  <span className="font-bold text-slate-800">{monthNames[month]} {year}</span>
                  <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-colors"><ChevronRight className="w-5 h-5"/></button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                      const d = i + 1;
                      const thisDate = new Date(year, month, d);
                      const isSelected = currentSelected && thisDate.toDateString() === currentSelected.toDateString();
                      const isToday = new Date().toDateString() === thisDate.toDateString();
                      
                      return (
                          <button 
                            key={d} 
                            type="button"
                            onClick={(e) => { e.preventDefault(); handleDayClick(d); }} 
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all mx-auto
                                ${isSelected ? 'bg-slate-900 text-white shadow-lg scale-105 font-bold' : 'text-slate-600 hover:bg-gold-50 hover:text-gold-700'}
                                ${!isSelected && isToday ? 'ring-1 ring-slate-200 bg-slate-50' : ''}
                            `}
                          >
                              {d}
                          </button>
                      );
                  })}
              </div>
          </div>
      );
  };

  return (
    <>
      <button 
        type="button"
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`${className} flex items-center justify-between text-left group`}
      >
        <span className={!value ? "text-slate-400" : "text-slate-900"}>{formatDateDisplay(value)}</span>
        <CalendarIcon className="w-4 h-4 text-slate-400 group-hover:text-gold-500 transition-colors" />
      </button>

      {isOpen && createPortal(
        <div 
            ref={dropdownRef}
            className="fixed z-[9999] animate-in fade-in zoom-in-95 duration-200"
            style={{ top: position.top, left: position.left }}
        >
            {renderCalendar()}
        </div>,
        document.body
      )}
    </>
  );
};
