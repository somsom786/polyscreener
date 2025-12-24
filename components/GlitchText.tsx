import React from 'react';

interface GlitchTextProps {
  text: string;
  as?: React.ElementType;
  className?: string;
  onClick?: () => void;
}

const GlitchText: React.FC<GlitchTextProps> = ({ text, as: Tag = 'span', className = '', onClick }) => {
  return (
    <Tag 
      className={`relative inline-block group cursor-pointer ${className}`} 
      onClick={onClick}
      data-text={text}
    >
      <span className="relative z-10 group-hover:animate-pulse">{text}</span>
      <span className="absolute top-0 left-0 -z-10 w-full h-full text-green-700 opacity-0 group-hover:opacity-100 group-hover:translate-x-[2px] group-hover:skew-x-12 transition-all duration-75">
        {text}
      </span>
      <span className="absolute top-0 left-0 -z-10 w-full h-full text-red-700 opacity-0 group-hover:opacity-70 group-hover:-translate-x-[2px] group-hover:-skew-x-12 transition-all duration-75">
        {text}
      </span>
    </Tag>
  );
};

export default GlitchText;