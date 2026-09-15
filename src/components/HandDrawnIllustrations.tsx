import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

/**
 * Hand-drawn SVG illustrations matching the reference doodle aesthetic:
 * Natural black lines (#222725), playful organic shapes, subtle solid black accents,
 * floating sparkles, dashes, stars, and comic/newspaper elements.
 */

interface IllustrationProps {
  className?: string;
  size?: number;
  isSuccess?: boolean;
}

// 1. Upload Step: Newspaper, Camera, Scissors & Comic Frame
// Both default and success states share the EXACT same newspaper body, viewBox, and coordinate system.
export const DoodleNewspaperUpload: React.FC<IllustrationProps> = ({
  className = '',
  size = 200,
  isSuccess = false,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`mx-auto select-none ${className}`}
    >
      {/* Floating sparkles & confetti dashes - 100% static across both states */}
      <path d="M42 38L46 32M44 35L48 35" stroke="#222725" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M196 44L202 52M200 46L194 50" stroke="#222725" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M30 115L36 112M33 118L33 110" stroke="#222725" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="210" cy="118" r="2.5" fill="#222725" />
      <circle cx="28" cy="65" r="2" fill="#222725" />
      <circle cx="198" cy="188" r="3" fill="#222725" />
      
      {/* Playful curved motion ticks - 100% static across both states */}
      <path d="M72 26C78 22 86 24 90 28" stroke="#222725" strokeWidth="2" strokeLinecap="round" />
      <path d="M152 24C158 20 166 22 170 27" stroke="#222725" strokeWidth="2" strokeLinecap="round" />

      {/* Main Folded Newspaper - exactly the original paths, completely unchanged & stationary */}
      <g transform="translate(48, 52)">
        {/* Newspaper Back Page Shadow / Layer */}
        <path
          d="M16 10C16 10 74 6 128 10C136 11 140 16 142 24L146 122C146 130 140 136 132 136L20 134C12 134 6 128 6 120L10 18C10 12 14 10 16 10Z"
          stroke="#222725"
          strokeWidth="2.8"
          strokeLinejoin="round"
          fill="#FFFDF9"
        />

        {/* Newspaper Header Strip */}
        <path d="M22 28H130" stroke="#222725" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M22 36H90" stroke="#222725" strokeWidth="1.8" strokeLinecap="round" />
        
        {/* Newspaper Comic Panels (Grid of 4 with wavy lines) */}
        {/* Panel 1 */}
        <rect x="22" y="44" width="48" height="36" rx="3" stroke="#222725" strokeWidth="2.2" fill="#FBF7EF" />
        {/* Doodle character in panel 1: smiling face */}
        <circle cx="42" cy="60" r="8" stroke="#222725" strokeWidth="1.8" />
        <path d="M39 58C39 58 40 57 41 58" stroke="#222725" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M43 58C43 58 44 57 45 58" stroke="#222725" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M40 63C41 65 43 65 44 63" stroke="#222725" strokeWidth="1.5" strokeLinecap="round" />

        {/* Panel 2 */}
        <rect x="76" y="44" width="52" height="36" rx="3" stroke="#222725" strokeWidth="2.2" fill="#FBF7EF" />
        {/* Speech bubble in panel 2 */}
        <path
          d="M84 50H118C121 50 123 52 123 55V65C123 68 121 70 118 70H96L90 75V70H84C81 70 79 68 79 65V55C79 52 81 50 84 50Z"
          stroke="#222725"
          strokeWidth="1.8"
          fill="#FFFDF9"
        />
        <path d="M86 58H116" stroke="#222725" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M86 63H106" stroke="#222725" strokeWidth="1.5" strokeLinecap="round" />

        {/* Panel 3 */}
        <rect x="22" y="86" width="48" height="38" rx="3" stroke="#222725" strokeWidth="2.2" fill="#FBF7EF" />
        <path d="M28 96H62" stroke="#222725" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M28 102H54" stroke="#222725" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M28 108H58" stroke="#222725" strokeWidth="1.5" strokeLinecap="round" />

        {/* Panel 4 */}
        <rect x="76" y="86" width="52" height="38" rx="3" stroke="#222725" strokeWidth="2.2" fill="#FBF7EF" />
        {/* Little snoopy-like ear/character silhouette */}
        <path
          d="M92 108C92 100 102 96 108 102C114 108 116 114 114 118C110 120 98 120 92 116Z"
          stroke="#222725"
          strokeWidth="1.8"
          fill="#222725"
        />
      </g>

      {/* Playful Doodle Camera (Floating Bottom-Left) - Fades out on upload success */}
      <g transform="translate(24, 136)">
        <AnimatePresence>
          {!isSuccess && (
            <motion.g
              key="camera-content"
              initial={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <rect x="6" y="14" width="46" height="34" rx="7" stroke="#222725" strokeWidth="2.5" fill="#FFFDF9" />
              {/* Lens */}
              <circle cx="28" cy="31" r="10" stroke="#222725" strokeWidth="2.5" fill="#FBF7EF" />
              <circle cx="28" cy="31" r="4.5" fill="#222725" />
              {/* Shutter button & flash */}
              <rect x="12" y="9" width="10" height="6" rx="2" stroke="#222725" strokeWidth="2" fill="#222725" />
              <circle cx="42" cy="22" r="2.5" fill="#222725" />
              {/* Flash rays */}
              <path d="M4 10L0 6M10 5L8 0" stroke="#222725" strokeWidth="2" strokeLinecap="round" />
            </motion.g>
          )}
        </AnimatePresence>
      </g>

      {/* Playful Doodle Scissors (Floating Bottom-Right) - Fades out on upload success */}
      <g transform="translate(156, 126)">
        <AnimatePresence>
          {!isSuccess && (
            <motion.g
              key="scissors-content"
              initial={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {/* Scissor blades */}
              <path d="M12 28L42 10" stroke="#222725" strokeWidth="2.8" strokeLinecap="round" />
              <path d="M12 14L42 32" stroke="#222725" strokeWidth="2.8" strokeLinecap="round" />
              {/* Scissor center pivot */}
              <circle cx="26" cy="21" r="2.5" fill="#222725" />
              {/* Finger rings */}
              <ellipse cx="6" cy="32" rx="7" ry="5" stroke="#222725" strokeWidth="2.5" fill="#FFFDF9" />
              <ellipse cx="6" cy="10" rx="7" ry="5" stroke="#222725" strokeWidth="2.5" fill="#FFFDF9" />
              {/* Cutting dotted line */}
              <path d="M48 6L56 2M62 0L70 -4" stroke="#222725" strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" />
            </motion.g>
          )}
        </AnimatePresence>
      </g>

      {/* Circular Success Checkmark Badge (Bottom-Right) - Enlarged ~1.65x (diameter ~56% of newspaper width) */}
      <g transform="translate(178, 170)">
        <AnimatePresence>
          {isSuccess && (
            <motion.g
              key="success-badge-content"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: [0.4, 1.1, 1] }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Hand-drawn Circular Badge overlapping bottom-right corner of newspaper */}
              <circle
                cx="0"
                cy="0"
                r="39"
                stroke="#222725"
                strokeWidth="4.8"
                fill="#FFFDF9"
              />
              {/* Bold Hand-drawn Dark Checkmark */}
              <path
                d="M-17 0L-4 13L20 -13"
                stroke="#222725"
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </motion.g>
          )}
        </AnimatePresence>
      </g>
    </svg>
  );
};

// 1b. Upload Step Success: Directly aliases DoodleNewspaperUpload with isSuccess={true}
export const DoodleNewspaperUploadSuccess: React.FC<IllustrationProps> = (props) => {
  return <DoodleNewspaperUpload {...props} isSuccess={true} />;
};

// 2. Crop Inspect Step: Panel with 4 Magnified Corner Pins & Lens
export const DoodleCropInspector: React.FC<IllustrationProps> = ({ className = '', size = 180 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`mx-auto select-none ${className}`}
    >
      {/* Comic Panel Box */}
      <rect x="32" y="36" width="136" height="116" rx="6" stroke="#222725" strokeWidth="3" fill="#FFFDF9" />
      <rect x="42" y="46" width="116" height="96" rx="3" stroke="#222725" strokeWidth="1.5" strokeDasharray="4 3" />

      {/* 4 Precision Corner Nodes */}
      <circle cx="32" cy="36" r="6" stroke="#222725" strokeWidth="2.5" fill="#222725" />
      <circle cx="168" cy="36" r="6" stroke="#222725" strokeWidth="2.5" fill="#222725" />
      <circle cx="168" cy="152" r="6" stroke="#222725" strokeWidth="2.5" fill="#222725" />
      <circle cx="32" cy="152" r="6" stroke="#222725" strokeWidth="2.5" fill="#222725" />

      {/* Magnifying Glass examining bottom-right corner */}
      <g transform="translate(112, 98)">
        <circle cx="32" cy="32" r="26" stroke="#222725" strokeWidth="3" fill="#FFFDF9" />
        <circle cx="32" cy="32" r="22" stroke="#222725" strokeWidth="1" strokeDasharray="3 2" />
        {/* Crosshair inside glass */}
        <line x1="32" y1="18" x2="32" y2="46" stroke="#8F3E2E" strokeWidth="1.8" />
        <line x1="18" y1="32" x2="46" y2="32" stroke="#8F3E2E" strokeWidth="1.8" />
        {/* Target dot */}
        <circle cx="32" cy="32" r="2.5" fill="#8F3E2E" />
        {/* Handle */}
        <path d="M51 51L74 74" stroke="#222725" strokeWidth="5" strokeLinecap="round" />
      </g>

      {/* Decorative sparkles */}
      <path d="M18 72L24 68M20 74L22 66" stroke="#222725" strokeWidth="2" strokeLinecap="round" />
      <circle cx="178" cy="92" r="2.5" fill="#222725" />
      <circle cx="24" cy="168" r="2" fill="#222725" />
    </svg>
  );
};

// 3. Translation Edit Step: Speech Bubbles & Translation Arrow
export const DoodleTranslationEdit: React.FC<IllustrationProps> = ({ className = '', size = 180 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`mx-auto select-none ${className}`}
    >
      {/* Left English Bubble */}
      <path
        d="M24 50C24 38 36 30 54 30H86C104 30 116 38 116 50V74C116 86 104 94 86 94H62L44 110V94H54C36 94 24 86 24 74V50Z"
        stroke="#222725"
        strokeWidth="2.8"
        strokeLinejoin="round"
        fill="#FFFDF9"
      />
      <text x="46" y="68" fontFamily="sans-serif" fontSize="18" fontWeight="700" fill="#222725">
        "HI!"
      </text>

      {/* Translation arrow doodle */}
      <path
        d="M102 110C108 116 116 122 124 118C130 114 132 106 130 98"
        stroke="#8F3E2E"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="4 3"
      />
      <path d="M136 102L130 96L124 104" stroke="#8F3E2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Right Chinese Translated Bubble */}
      <path
        d="M84 120C84 108 96 100 114 100H156C174 100 186 108 186 120V144C186 156 174 164 156 164H144L132 178V164H114C96 164 84 156 84 144V120Z"
        stroke="#222725"
        strokeWidth="2.8"
        strokeLinejoin="round"
        fill="#FBF7EF"
      />
      <text x="112" y="140" fontFamily="sans-serif" fontSize="16" fontWeight="700" fill="#8F3E2E">
        “你好！”
      </text>

      {/* Little pencil doodle */}
      <g transform="translate(18, 130) rotate(-35)">
        <rect x="0" y="0" width="36" height="10" rx="2" stroke="#222725" strokeWidth="2" fill="#FFFDF9" />
        <path d="M36 0L46 5L36 10Z" stroke="#222725" strokeWidth="2" fill="#222725" />
      </g>
    </svg>
  );
};

// 4. Finished 3:4 Cards Preview & Export Stack
export const DoodleFinishedExport: React.FC<IllustrationProps> = ({ className = '', size = 180 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`mx-auto select-none ${className}`}
    >
      {/* Background card angled */}
      <rect
        x="68"
        y="18"
        width="96"
        height="128"
        rx="6"
        transform="rotate(8 68 18)"
        stroke="#222725"
        strokeWidth="2.5"
        fill="#F5EFE0"
      />

      {/* Foreground 3:4 Card */}
      <rect x="36" y="26" width="102" height="136" rx="6" stroke="#222725" strokeWidth="3" fill="#FFFDF9" />
      
      {/* Card Header signature doodle */}
      <path d="M52 40H86" stroke="#A09A90" strokeWidth="1.8" strokeLinecap="round" />
      
      {/* Card Top Translated Text in Red-Brown */}
      <path d="M48 52H126" stroke="#8F3E2E" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M48 60H110" stroke="#8F3E2E" strokeWidth="2" strokeLinecap="round" />

      {/* Card Comic Panel (Inner authentic frame) */}
      <rect x="46" y="72" width="82" height="64" rx="2" stroke="#222725" strokeWidth="2.5" fill="#FBF7EF" />
      {/* Character inside frame */}
      <circle cx="87" cy="100" r="14" stroke="#222725" strokeWidth="2" fill="#FFFDF9" />
      <circle cx="82" cy="98" r="1.5" fill="#222725" />
      <circle cx="92" cy="98" r="1.5" fill="#222725" />
      <path d="M84 104C86 107 88 107 90 104" stroke="#222725" strokeWidth="1.5" strokeLinecap="round" />

      {/* Card bottom page number doodle */}
      <text x="80" y="152" fontFamily="Caveat, cursive" fontSize="16" fontWeight="700" fill="#222725">
        1/6
      </text>

      {/* Celebratory sparkles around */}
      <path d="M156 70L162 76M162 70L156 76" stroke="#222725" strokeWidth="2" strokeLinecap="round" />
      <circle cx="168" cy="120" r="3" fill="#222725" />
      <circle cx="20" cy="80" r="2.5" fill="#222725" />
      <circle cx="148" cy="30" r="2" fill="#222725" />
    </svg>
  );
};

// 5. Hand-drawn Status Icon: Upload Success (Organic checkmark, celebratory sparkles)
export const DoodleStatusSuccess: React.FC<{ size?: number; className?: string }> = ({ size = 26, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block select-none shrink-0 ${className}`}
    >
      {/* Hand-drawn organic badge circle */}
      <path
        d="M16 3.5C9.2 3.5 4 8.8 4 15.8C4 23 9.5 28.5 16.5 28C23.2 27.5 28 22.8 28 16C28 9.2 22.8 3.5 16 3.5Z"
        stroke="#1E6B47"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="#EDF7F0"
      />
      {/* Hand-drawn checkmark */}
      <path
        d="M10 16.5L14.2 21L22 11.5"
        stroke="#1E6B47"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Playful sparkle tick */}
      <path d="M26.5 6.5L29 5M28 8.5L27 4" stroke="#1E6B47" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="5.5" cy="8.5" r="1.2" fill="#1E6B47" />
    </svg>
  );
};

// 6. Hand-drawn Status Icon: Upload Failed (Organic cross / alert badge with doodle shake lines)
export const DoodleStatusError: React.FC<{ size?: number; className?: string }> = ({ size = 26, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block select-none shrink-0 ${className}`}
    >
      {/* Hand-drawn organic badge circle */}
      <path
        d="M16 3.8C9.5 3.8 4.2 9.2 4.2 16C4.2 23 9.8 28.2 16.5 28.2C23.2 28.2 28 23 28 16C28 9 22.5 3.8 16 3.8Z"
        stroke="#8F3E2E"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="#FDF2EE"
      />
      {/* Hand-drawn organic cross */}
      <path
        d="M11.5 11.5L20.5 20.5M20.5 11.5L11.5 20.5"
        stroke="#8F3E2E"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      {/* Doodle shake lines */}
      <path d="M1.5 16H3.5M30.5 16H28.5" stroke="#8F3E2E" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
};

// 7. Hand-drawn Status Icon: Uploading / Processing (Rotating doodle dashes)
export const DoodleStatusLoading: React.FC<{ size?: number; className?: string }> = ({ size = 26, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block select-none shrink-0 animate-spin ${className}`}
      style={{ animationDuration: '3s' }}
    >
      <circle cx="16" cy="16" r="12" stroke="#E2D9CB" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="4 4" />
      <path
        d="M16 4C22.6 4 28 9.4 28 16"
        stroke="#222725"
        strokeWidth="2.8"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="3.5" fill="#222725" />
    </svg>
  );
};

// 8. Hand-drawn Status Icon: Waiting / Ready (Hand-drawn camera / photo frame)
export const DoodleStatusWaiting: React.FC<{ size?: number; className?: string }> = ({ size = 26, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`inline-block select-none shrink-0 ${className}`}
    >
      <rect x="5" y="9" width="22" height="17" rx="3.5" stroke="#75716B" strokeWidth="2.2" fill="#FAF7EF" />
      <circle cx="16" cy="17.5" r="4.8" stroke="#75716B" strokeWidth="2" fill="#FFFDF9" />
      <circle cx="16" cy="17.5" r="2.2" fill="#75716B" />
      <rect x="9" y="6" width="6" height="3.5" rx="1" fill="#75716B" />
      <circle cx="23" cy="12.5" r="1" fill="#75716B" />
    </svg>
  );
};

