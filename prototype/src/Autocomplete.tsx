import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { matchSuggestions, type Suggestion } from "./autocomplete-model";

interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  suggestions: Suggestion[];
  onValueChange: (value: string) => void;
  onSuggestionSelect?: (option: Suggestion) => void;
  filterQuery?: string;
  emptyMessage: string;
  resultsMessage: (count: number) => string;
  validationMessage?: string;
}

export function AutocompleteInput({
  suggestions,
  onValueChange,
  onSuggestionSelect,
  filterQuery,
  emptyMessage,
  resultsMessage,
  validationMessage = "",
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  disabled,
  readOnly,
  id,
  value,
  ...props
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const matches = useMemo(
    () => matchSuggestions(suggestions, filterQuery ?? String(value ?? "")),
    [suggestions, filterQuery, value],
  );
  const visible = open && !disabled && !readOnly;
  const activeOption = matches[active];
  useLayoutEffect(() => {
    input.current?.setCustomValidity(validationMessage);
  }, [validationMessage]);
  useEffect(() => setActive(-1), [suggestions, filterQuery, value]);
  useLayoutEffect(() => {
    if (!visible) return;
    const place = () => {
      const rect = input.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - 8;
      const above = rect.top - 8;
      const upwards = below < 200 && above > below;
      setPosition({
        left: Math.max(8, rect.left),
        width: Math.min(rect.width, window.innerWidth - 16),
        maxHeight: Math.min(320, Math.max(52, upwards ? above : below)),
        ...(upwards
          ? { bottom: window.innerHeight - rect.top + 4 }
          : { top: rect.bottom + 4 }),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [visible]);
  useEffect(() => {
    if (visible && active >= 0)
      list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, visible]);
  const choose = (option: Suggestion) => {
    if (disabled || readOnly || input.current?.matches(":disabled")) return;
    onValueChange(option.value);
    onSuggestionSelect?.(option);
    setOpen(false);
    setActive(-1);
  };
  return (
    <>
      <input
        {...props}
        ref={input}
        id={id}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        autoComplete="off"
        role="combobox"
        aria-invalid={validationMessage ? true : props["aria-invalid"]}
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={visible ? `${id}-suggestions` : undefined}
        aria-activedescendant={
          visible && activeOption ? `${id}-option-${active}` : undefined
        }
        onFocus={(event) => {
          setOpen(true);
          setActive(-1);
          onFocus?.(event);
        }}
        onClick={() => setOpen(true)}
        onBlur={(event) => {
          setOpen(false);
          setActive(-1);
          onBlur?.(event);
        }}
        onChange={(event) => {
          setOpen(true);
          setActive(-1);
          onValueChange(event.target.value);
          onChange?.(event);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || disabled || readOnly) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((previous) => {
              if (!matches.length) return -1;
              if (!visible || previous < 0)
                return event.key === "ArrowDown" ? 0 : matches.length - 1;
              return (
                (previous +
                  (event.key === "ArrowDown" ? 1 : -1) +
                  matches.length) %
                matches.length
              );
            });
          } else if (event.key === "Enter" && visible && activeOption) {
            event.preventDefault();
            choose(activeOption);
          } else if (event.key === "Escape" && visible) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            setActive(-1);
          } else if (event.key === "Tab") {
            setOpen(false);
          }
          onKeyDown?.(event);
        }}
      />
      {visible &&
        createPortal(
          <div className="autocomplete-popup" style={position}>
            <div
              className="autocomplete-options"
              id={`${id}-suggestions`}
              role="listbox"
              aria-label={props["aria-label"] || undefined}
              aria-labelledby={props["aria-label"] ? undefined : `${id}-label`}
              ref={list}
            >
              {matches.map((option, index) => (
                <div
                  key={option.value}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={active === index}
                  className="autocomplete-option"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  <span>{option.label}</span>
                  {option.description && <small>{option.description}</small>}
                </div>
              ))}
            </div>
            {!matches.length && (
              <p className="autocomplete-empty">{emptyMessage}</p>
            )}
            <span className="sr-only" role="status">
              {resultsMessage(matches.length)}
            </span>
          </div>,
          input.current?.closest("dialog") || document.body,
        )}
    </>
  );
}
