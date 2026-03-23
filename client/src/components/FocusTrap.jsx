import FocusTrapReact from 'focus-trap-react';

// Thin wrapper around focus-trap-react with safe defaults for our modals.
// Usage: <FocusTrap><div className="modal-overlay">...</div></FocusTrap>
export default function FocusTrap({ children, active = true }) {
  return (
    <FocusTrapReact
      active={active}
      focusTrapOptions={{
        allowOutsideClick: true,       // let backdrop clicks close the modal
        escapeDeactivates: false,       // we handle Escape in the component itself
        fallbackFocus: '[data-focus-trap-fallback]', // safety fallback
        initialFocus: false,            // don't steal focus from current element
      }}
    >
      {children}
    </FocusTrapReact>
  );
}
