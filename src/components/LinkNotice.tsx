interface Props {
  message: string;
  onDismiss: () => void;
}

/** Non-blocking message about how the share link was read: data that was ignored or a link that was not valid. */
export default function LinkNotice({ message, onDismiss }: Props) {
  return (
    <div className="link-notice" role="status">
      <p className="link-notice-message">{message}</p>
      <button type="button" className="link-notice-dismiss" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
