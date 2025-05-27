import React, { useState, useRef, useEffect } from 'react';

interface ImageInfoDropdownProps {
  title: string;
  children?: React.ReactNode;
  isOpen?: boolean;
}

const ImageInfoDropdown: React.FC<ImageInfoDropdownProps> = ({ 
  title, 
  children,
  isOpen: initialIsOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(initialIsOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const container = containerRef.current;
      
      setTimeout(() => {
        const rect = container.getBoundingClientRect();
        
        if (rect.bottom > window.innerHeight - 50) {
          const scrollOptions: ScrollIntoViewOptions = {
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
          };
          container.scrollIntoView(scrollOptions);
        }
      }, 300);
    }
  }, [isOpen]);

  return (
    <div 
      className={`image-info-dropdown ${isOpen ? 'opened' : ''}`}
      ref={containerRef}
    >
      <div className="dropdown-container">
        <div className="dropdown-header" onClick={toggleDropdown}>
          <div className="info-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 11V16M12 8V8.01M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" 
                    stroke="#484848" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="dropdown-title">{title}</div>
          <div className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="#484848" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        
        <div 
          className={`dropdown-content ${isOpen ? 'open' : 'closed'}`}
          ref={contentRef}
          style={{
            maxHeight: isOpen ? (contentRef.current ? `${contentRef.current.scrollHeight}px` : '1000px') : '0px',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default ImageInfoDropdown;