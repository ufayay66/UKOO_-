import React from 'react';
import { Layers, Scissors, MessageSquareText, Sparkles, Check } from 'lucide-react';

interface HeaderProps {
  currentStep: 1 | 2 | 3 | 4;
  onStepChange: (step: 1 | 2 | 3 | 4) => void;
  hasImage: boolean;
  panelsCount: number;
  hasApiKey: boolean;
  onLoadSample?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentStep,
  onStepChange,
  hasImage,
  panelsCount,
}) => {
  const stepNames = [
    { num: 1 as const, title: '上传报纸' },
    { num: 2 as const, title: '检查裁切' },
    { num: 3 as const, title: '编辑译文' },
    { num: 4 as const, title: '预览导出' },
  ];

  return (
    <header className="bg-[#FBF7EF] border-b border-[#EAE3D2] sticky top-0 z-40 transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-15 relative flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-[#222725] text-[#FBF7EF] flex items-center justify-center font-bold text-sm select-none">
            框
          </div>
          <div>
            <h1 className="text-base font-bold text-[#222725] tracking-tight flex items-center space-x-1.5">
              <span>有个框/漫画拆分</span>
            </h1>
          </div>
        </div>

        {/* 4 Steps Navigation (Desktop & Tablet) - Centered */}
        <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center space-x-1 bg-[#F2ECE0] p-1 rounded-full text-xs font-medium border border-[#E3DCC8]">
          {stepNames.map((s) => {
            const isCurrent = currentStep === s.num;
            const isAccessible = s.num === 1 || (hasImage && panelsCount > 0) || (s.num <= currentStep);

            return (
              <button
                key={s.num}
                id={`nav-step-${s.num}`}
                disabled={!isAccessible}
                onClick={() => isAccessible && onStepChange(s.num)}
                className={`px-3 py-1.5 rounded-full transition-all flex items-center space-x-1.5 cursor-pointer ${
                  isCurrent
                    ? 'bg-[#222725] text-white font-semibold'
                    : isAccessible
                    ? 'text-[#75716B] hover:text-[#222725]'
                    : 'text-[#BBB4A6] opacity-50 cursor-not-allowed'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  isCurrent ? 'bg-white/20 text-white' : 'bg-[#E3D9C8] text-[#75716B]'
                }`}>
                  {s.num}
                </span>
                <span>{s.title}</span>
              </button>
            );
          })}
        </nav>

        {/* Mobile Step Indicator Badge */}
        <div className="md:hidden flex items-center space-x-2">
          <div className="flex items-center space-x-1 px-3 py-1 rounded-full bg-[#F2ECE0] border border-[#E3DCC8] text-xs font-medium text-[#222725]">
            <span className="font-bold">{currentStep}</span>
            <span className="text-[#A09A90]">/ 4</span>
            <span className="text-[#75716B] ml-1 font-semibold">
              {stepNames[currentStep - 1].title}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
