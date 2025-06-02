import React, { useState, useRef, useEffect } from 'react';

interface ImageInfoDropdownProps {
  title: string;
  children?: React.ReactNode;
  isOpen?: boolean;
  onCopyContent?: () => void; // NEW: Function to get content for copying
  copyContent?: string; // NEW: Direct content to copy
}

// Utility function to convert HTML to plain text with proper line breaks
const htmlToPlainText = (html: string): string => {
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Define block elements that should have line breaks before/after
  const blockElements = [
    'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 
    'ul', 'ol', 'li', 'br', 'hr', 'section', 'article', 
    'header', 'footer', 'nav', 'main', 'aside', 'blockquote'
  ];

  // Function to recursively process nodes
  const processNode = (node: Node): string => {
    let result = '';

    if (node.nodeType === Node.TEXT_NODE) {
      // Text node - return the text content
      return node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      // Add line break before block elements (except the first one)
      if (blockElements.includes(tagName)) {
        result += '\n';
      }

      // Process child nodes
      for (let i = 0; i < node.childNodes.length; i++) {
        result += processNode(node.childNodes[i]);
      }

      // Special handling for specific elements
      if (tagName === 'li') {
        result += '\n'; // Line break after each list item
      } else if (tagName === 'br') {
        result += '\n'; // Line break for <br> tags
      } else if (blockElements.includes(tagName) && tagName !== 'li') {
        result += '\n'; // Line break after other block elements
      }
    }

    return result;
  };

  let plainText = processNode(tempDiv);

  // Clean up extra line breaks
  plainText = plainText
    .replace(/^\n+/, '') // Remove leading line breaks
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Replace multiple consecutive line breaks with double line breaks
    .replace(/\n+$/, ''); // Remove trailing line breaks

  return plainText;
};

const ImageInfoDropdown: React.FC<ImageInfoDropdownProps> = ({ 
  title, 
  children,
  isOpen: initialIsOpen = false,
  onCopyContent,
  copyContent
}) => {
  const [isOpen, setIsOpen] = useState(initialIsOpen);
  const [isCopied, setIsCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent dropdown toggle
    
    let textToCopy = '';
    
    // Method 1: Use provided copyContent
    if (copyContent) {
      // Check if copyContent contains HTML tags
      if (copyContent.includes('<') && copyContent.includes('>')) {
        textToCopy = htmlToPlainText(copyContent);
      } else {
        textToCopy = copyContent;
      }
    }
    // Method 2: Use onCopyContent callback
    else if (onCopyContent) {
      onCopyContent();
      return; // Let the callback handle the copying
    }
    // Method 3: Extract text from children content
    else if (contentRef.current) {
      // Check if content has HTML
      const htmlContent = contentRef.current.innerHTML;
      if (htmlContent.includes('<') && htmlContent.includes('>')) {
        textToCopy = htmlToPlainText(htmlContent);
      } else {
        textToCopy = contentRef.current.innerText || contentRef.current.textContent || '';
      }
    }
    
    if (textToCopy.trim()) {
      navigator.clipboard.writeText(textToCopy.trim())
        .then(() => {
          // Change icon to copied state
          setIsCopied(true);
          console.log('Copied text:', textToCopy); // Debug log
        })
        .catch((err) => {
          console.error('Failed to copy text: ', err);
        });
    }
  };

  // Reset icon after 2 seconds
  useEffect(() => {
    if (isCopied) {
      const timer = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isCopied]);

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
          <div className="copy-icon-wrapper" onClick={handleCopyClick}>
            {isCopied ? (
              // Checkmark icon when copied
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="copy-icon"
              >
                <path 
                  d="M20 6L9 17L4 12" 
                  stroke="#10a37f"
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              // Copy icon (default)
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                className="copy-icon"
              >
                <path 
                  d="M7 5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-2v2a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3h2V5Zm2 2h5a3 3 0 0 1 3 3v5h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1v2ZM5 9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5Z" 
                  fill="#484848"
                  fillRule="evenodd"
                  clipRule="evenodd"
                />
              </svg>
            )}
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
            maxHeight: isOpen ? (contentRef.current ? `${contentRef.current.scrollHeight + 60}px` : '1500px') : '0px',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default ImageInfoDropdown;