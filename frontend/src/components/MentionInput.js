import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Textarea } from './ui/textarea';
import { api } from '../App';

// Debounce helper
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function MentionInput({
  value,
  onChange,
  placeholder = 'Add a comment...',
  onMentionSelect,
  className = '',
  rows = 2,
  ...props
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState(-1);
  const [loading, setLoading] = useState(false);
  
  const textareaRef = useRef(null);
  const suggestionsRef = useRef(null);
  
  const debouncedQuery = useDebounce(mentionQuery, 150);

  // Search for users when query changes
  useEffect(() => {
    const searchUsers = async () => {
      if (!showSuggestions || mentionStartPos === -1) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        const response = await api.get(`/users/mentions?q=${encodeURIComponent(debouncedQuery)}`);
        setSuggestions(response.data);
        setSelectedIndex(0);
      } catch (error) {
        console.error('Failed to search users:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    };

    searchUsers();
  }, [debouncedQuery, showSuggestions, mentionStartPos]);

  // Handle text input changes
  const handleChange = useCallback((e) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);

    // Check if we should show mention suggestions
    const textBeforeCursor = newValue.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      const startPos = cursorPos - query.length - 1;
      setMentionQuery(query);
      setMentionStartPos(startPos);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setMentionStartPos(-1);
      setMentionQuery('');
    }
  }, [onChange]);

  // Handle selecting a mention
  const selectMention = useCallback((user) => {
    if (mentionStartPos === -1 || !textareaRef.current) return;

    const beforeMention = value.slice(0, mentionStartPos);
    const afterMention = value.slice(mentionStartPos + mentionQuery.length + 1);
    const mentionText = `@${user.name.replace(/\s+/g, '_')} `;
    
    const newValue = beforeMention + mentionText + afterMention;
    onChange(newValue);

    // Notify parent about the mention
    if (onMentionSelect) {
      onMentionSelect(user);
    }

    // Reset state
    setShowSuggestions(false);
    setMentionStartPos(-1);
    setMentionQuery('');

    // Set cursor position after mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length;
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        textareaRef.current.focus();
      }
    }, 0);
  }, [mentionStartPos, mentionQuery, value, onChange, onMentionSelect]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % suggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case 'Enter':
        if (showSuggestions && suggestions[selectedIndex]) {
          e.preventDefault();
          selectMention(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        break;
      case 'Tab':
        if (showSuggestions && suggestions[selectedIndex]) {
          e.preventDefault();
          selectMention(suggestions[selectedIndex]);
        }
        break;
      default:
        break;
    }
  }, [showSuggestions, suggestions, selectedIndex, selectMention]);

  // Scroll selected suggestion into view
  useEffect(() => {
    if (suggestionsRef.current && suggestions.length > 0) {
      const selectedEl = suggestionsRef.current.children[selectedIndex];
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, suggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (textareaRef.current && !textareaRef.current.contains(e.target) &&
          suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        rows={rows}
        {...props}
      />

      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            ref={suggestionsRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
            data-testid="mention-suggestions"
          >
            {loading ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                Searching...
              </div>
            ) : suggestions.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">
                No users found
              </div>
            ) : (
              suggestions.map((user, index) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => selectMention(user)}
                  className={`w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-secondary/50 transition-colors ${
                    index === selectedIndex ? 'bg-secondary' : ''
                  }`}
                  data-testid={`mention-suggestion-${user.id}`}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium flex-shrink-0">
                    {user.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  {user.department && (
                    <span className="text-xs text-muted-foreground">{user.department}</span>
                  )}
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
