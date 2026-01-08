
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [activeInput, setActiveInput] = useState<'start' | 'end'>('start');

  // Temporary state to hold selection before "Done" is clicked
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync temp state with props when opening
  useEffect(() => {
      if (isOpen) {
          setTempStart(startDate);
          setTempEnd(endDate);
          
          if (!startDate) setActiveInput('start');
          else if (!endDate) setActiveInput('end');
          
          if (startDate) setViewDate(new Date(startDate));
          else setViewDate(new Date());
      }
  }, [isOpen, startDate, endDate]);

  // Sync viewDate when switching inputs (using temp values)
  useEffect(() => {
      if (!isOpen) return;
      if (activeInput === 'start' && tempStart) {
          setViewDate(new Date(tempStart));
      } else if (activeInput === 'end' && tempEnd) {
          setViewDate(new Date(tempEnd));
      }
  }, [activeInput]);

  // Helper to safely format YYYY-MM-DD regardless of timezone
  const toLocalISO = (date: Date) => {
    const offset = date.getTimezoneOffset();
    const d = new Date(date.getTime() - (offset * 60 * 1000));
    return d.toISOString().split('T')[0];
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return 'Select Date';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const updatePosition = () => {
      if (buttonRef.current && isOpen) {
          const btnRect = buttonRef.current.getBoundingClientRect();
          let width = 520; 
          
          if (dropdownRef.current) {
               width = dropdownRef.current.offsetWidth || width;
          }

          let left = btnRect.left;
          let top = btnRect.bottom + 8;
          
          const padding = 16;
          if (left + width > window.innerWidth - padding) {
              left = window.innerWidth - width - padding;
          }
          if (left < padding) left = padding;

          setPosition({ top, left });
      }
  };

  useLayoutEffect(() => {
      if (isOpen) {
          updatePosition();
      }
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
    
    const handleResize = () => {
        if (isOpen) requestAnimationFrame(updatePosition);
    };

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
    const dateStr = toLocalISO(newDate);

    if (activeInput === 'start') {
        if (tempEnd && dateStr > tempEnd) {
            setTempStart(dateStr);
            setTempEnd(dateStr); // Reset end if start is after end
        } else {
            setTempStart(dateStr);
        }
        setActiveInput('end'); // Auto-advance to end date selection
    } else {
        if (tempStart && dateStr < tempStart) {
             setTempStart(dateStr);
             setTempEnd(dateStr); // Reset start if end is before start
        } else {
             setTempEnd(dateStr);
        }
    }
  };

  const handleManualStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (tempEnd && val > tempEnd) {
         setTempStart(val);
         setTempEnd(val);
      } else {
         setTempStart(val);
      }
      if(val) setViewDate(new Date(val));
      setActiveInput('start');
  };

  const handleManualEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (tempStart && val < tempStart) {
          setTempStart(val);
          setTempEnd(val);
      } else {
          setTempEnd(val);
      }
      if(val) setViewDate(new Date(val));
      setActiveInput('end');
  };

  const handlePreset = (type: 'TODAY' | 'LAST_7' | 'LAST_30' | 'THIS_MONTH' | 'LAST_MONTH') => {
      const today = new Date();
      let start = new Date();
      let end = new Date();

      switch (type) {
          case 'TODAY':
              break; 
          case 'LAST_7':
              start.setDate(today.getDate() - 6);
              break;
          case 'LAST_30':
              start.setDate(today.getDate() - 29);
              break;
          case 'THIS_MONTH':
              start = new Date(today.getFullYear(), today.getMonth(), 1);
              break;
          case 'LAST_MONTH':
              start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
              end = new Date(today.getFullYear(), today.getMonth(), 0);
              break;
      }
      setTempStart(toLocalISO(start));
      setTempEnd(toLocalISO(end));
      setViewDate(start);
  };

  const handleDone = () => {
      onChange(tempStart, tempEnd);
      setIsOpen(false);
  };

  const changeMonth = (offset: number) => {
      setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };
  
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const year = parseInt(e.target.value);
      setViewDate(new Date(year, viewDate.getMonth(), 1));
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const month = parseInt(e.target.value);
      setViewDate(new Date(viewDate.getFullYear(), month, 1));
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({length: 12}, (_, i) => currentYear - 10 + i);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const renderMonth = () => {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay(); 
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      return (
          <div className="w-[300px]">
              <div className="flex justify-between items-center mb-4 px-2 h-8">
                  <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-colors">
                      <ChevronLeft className="w-5 h-5"/>
                  </button>
                  
                  <div className="flex gap-1 font-bold text-slate-800 text-sm">
                        <select value={month} onChange={handleMonthChange} className="bg-transparent hover:bg-slate-100 rounded cursor-pointer outline-none p-1">
                            {monthNames.map((m, i) => <option key={m} value={i}>{m}</option>)}
                        </select>
                        <select value={year} onChange={handleYearChange} className="bg-transparent hover:bg-slate-100 rounded cursor-pointer outline-none p-1">
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                  </div>

                  <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-colors">
                      <ChevronRight className="w-5 h-5"/>
                  </button>
              </div>
              
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                      <div key={d} className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{d}</div>
                  ))}
              </div>

              <div className="grid grid-cols-7 gap-y-1 gap-x-0">
                  {Array.from({ length: firstDay }).map((_, i) => (
                      <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                      const d = i + 1;
                      const dateStr = toLocalISO(new Date(year, month, d));
                      const isStart = tempStart === dateStr;
                      const isEnd = tempEnd === dateStr;
                      const isRange = tempStart && tempEnd && dateStr > tempStart && dateStr < tempEnd;
                      
                      let btnClass = "w-8 h-8 flex items-center justify-center text-sm rounded-full transition-all relative z-10 font-medium ";
                      
                      if (isStart || isEnd) {
                          btnClass += "bg-slate-900 text-white shadow-md scale-105";
                      } else if (isRange) {
                          btnClass += "text-slate-900 bg-gold-100/50";
                      } else {
                          btnClass += "text-slate-600 hover:bg-slate-100 hover:text-slate-900";
                      }

                      const isRangeStart = isStart && tempEnd && tempEnd !== tempStart;
                      const isRangeEnd = isEnd && tempStart && tempStart !== tempEnd;

                      return (
                          <div key={d} className="relative w-9 h-9 flex items-center justify-center mx-auto">
                              {isRange && <div className="absolute inset-0 bg-gold-100/30" />}
                              {isRangeStart && <div className="absolute top-0 bottom-0 right-0 w-1/2 bg-gold-100/30" />}
                              {isRangeEnd && <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gold-100/30" />}
                              
                              <button onClick={() => handleDayClick(d)} className={btnClass}>
                                  {d}
                              </button>
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  return (
    <>
      <button 
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full sm:w-auto flex items-center justify-between sm:justify-start gap-3 bg-white px-4 py-2.5 rounded-xl border transition-all duration-200 group ${isOpen ? 'border-gold-400 shadow-md ring-1 ring-gold-100' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}
      >
        <div className="flex items-center gap-3">
            <CalendarIcon className={`w-4 h-4 transition-colors ${isOpen ? 'text-gold-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <span>{formatDateDisplay(startDate)}</span>
                <span className="text-slate-300 mx-1">→</span>
                <span>{formatDateDisplay(endDate)}</span>
            </div>
        </div>
      </button>

      {isOpen && createPortal(
        <div 
            ref={dropdownRef}
            className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-left flex flex-col sm:flex-row"
            style={{ 
                top: position.top, 
                left: position.left,
                maxWidth: 'calc(100vw - 20px)'
            }}
        >
             {/* Sidebar */}
             <div className="bg-slate-50 p-4 border-b sm:border-b-0 sm:border-r border-slate-100 flex flex-col gap-4 sm:w-56 min-w-[200px]">
                
                {/* Manual Inputs with Active State Indication */}
                <div className="grid gap-3">
                     <div 
                        onClick={() => setActiveInput('start')}
                        className={`p-2 rounded-lg border cursor-pointer transition-all bg-white ${activeInput === 'start' ? 'border-gold-500 ring-2 ring-gold-500/20 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
                     >
                        <label className={`text-[10px] font-bold uppercase tracking-wider mb-1 block ${activeInput === 'start' ? 'text-gold-600' : 'text-slate-400'}`}>From</label>
                        <input 
                            type="date" 
                            value={tempStart || ''} 
                            onChange={handleManualStartChange}
                            onFocus={() => setActiveInput('start')}
                            className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer" 
                        />
                     </div>
                     <div 
                        onClick={() => setActiveInput('end')}
                        className={`p-2 rounded-lg border cursor-pointer transition-all bg-white ${activeInput === 'end' ? 'border-gold-500 ring-2 ring-gold-500/20 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
                     >
                        <label className={`text-[10px] font-bold uppercase tracking-wider mb-1 block ${activeInput === 'end' ? 'text-gold-600' : 'text-slate-400'}`}>To</label>
                        <input 
                            type="date" 
                            value={tempEnd || ''} 
                            onChange={handleManualEndChange} 
                            onFocus={() => setActiveInput('end')}
                            className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer" 
                        />
                     </div>
                </div>

                <div className="h-px bg-slate-200"></div>
                
                <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Presets</p>
                <div className="flex flex-row sm:flex-col gap-2 overflow-x-auto sm:overflow-visible no-scrollbar pb-1 sm:pb-0">
                    {[
                        { label: 'Today', type: 'TODAY' },
                        { label: 'Last 7 Days', type: 'LAST_7' },
                        { label: 'Last 30 Days', type: 'LAST_30' },
                        { label: 'This Month', type: 'THIS_MONTH' },
                        { label: 'Last Month', type: 'LAST_MONTH' }
                    ].map((preset) => (
                        <button
                            key={preset.type}
                            onClick={() => handlePreset(preset.type as any)}
                            className="whitespace-nowrap text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-white hover:text-gold-700 hover:shadow-sm rounded-lg transition-all flex items-center gap-2"
                        >
                            <Clock className="w-3 h-3 opacity-50"/>
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Calendar */}
            <div className="p-4 flex flex-col justify-between">
                {renderMonth()}
                
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">
                        {tempStart ? (tempEnd ? `${Math.ceil((new Date(tempEnd).getTime() - new Date(tempStart).getTime()) / (1000 * 60 * 60 * 24)) + 1} Days` : 'Select End Date') : 'Select Start Date'}
                    </span>
                    <button onClick={handleDone} className="px-5 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10">Done</button>
                </div>
            </div>
        </div>,
        document.body
      )}
    </>
  );
};
