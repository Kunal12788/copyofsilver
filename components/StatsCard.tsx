
import React from 'react';

interface StatsCardProps {
  title: string;
  value: string;
  subValue?: string;
  icon?: React.ElementType;
  delayIndex?: number;
  isActive?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({ title, value, subValue, icon: Icon, delayIndex = 0, isActive = false }) => {
  return (
    <div 
      className={`relative overflow-hidden rounded-2xl p-6 transition-all duration-500 hover:-translate-y-1 opacity-0 animate-slide-up
        ${isActive 
          ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl shadow-slate-900/20' 
          : 'bg-white text-slate-900 shadow-card hover:shadow-glow border border-slate-100'
        }`}
      style={{ animationDelay: `${delayIndex * 100}ms` }}
    >
      {/* Background Decor */}
      {isActive && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold-500/10 rounded-full blur-3xl -mr-10 -mt-10 animate-pulse-slow"></div>
      )}
      {!isActive && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none"></div>
      )}
      
      <div className="relative z-10 flex justify-between items-start">
        <div>
          <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isActive ? 'text-gold-400' : 'text-slate-400'}`}>
            {title}
          </p>
          <h3 className={`text-3xl font-mono font-bold tracking-tight mb-1 ${isActive ? 'text-white' : 'text-slate-900'}`}>
            {value}
          </h3>
          {subValue && (
            <p className={`text-xs font-medium flex items-center gap-1 ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
              {subValue}
            </p>
          )}
        </div>

        {Icon && (
          <div className={`p-3 rounded-xl transition-transform duration-300 group-hover:scale-110 ${
            isActive 
              ? 'bg-white/10 text-gold-400 backdrop-blur-sm' 
              : 'bg-slate-50 text-gold-600 border border-slate-100'
          }`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
