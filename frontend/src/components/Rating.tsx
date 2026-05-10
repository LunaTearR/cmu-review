import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHeart } from '@fortawesome/free-solid-svg-icons'

interface Props {
  value: number;
  max?: number;
  onChange?: (v: number) => void;
}

export function Rating({ value, max = 5, onChange }: Props) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <span
          key={star}
          style={{
            cursor: onChange ? "pointer" : "default",
            color: star <= value ? "var(--cmu-star)" : "var(--cmu-star-empty)",
            fontSize: "1.25rem",
            transition: "color 0.1s",
          }}
          onClick={() => onChange?.(star)}
        >
          <FontAwesomeIcon icon={faHeart} />
        </span>
      ))}
    </span>
  );
}
