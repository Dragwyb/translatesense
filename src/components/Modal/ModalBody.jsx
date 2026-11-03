/**
 * ModalBody Component
 */

export function ModalBody({ children, className = '', style = {} }) {
  return (
    <div className={`ts-modal-body ts-common-body ${className}`} style={style}>
      {children}
    </div>
  );
}

