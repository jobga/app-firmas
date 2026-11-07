import { useRef } from 'react';

/** Six single-digit boxes that auto-advance; reports the joined code. */
export function CodeInput({ label, size = 'md', onChange }: {
  label: string; size?: 'md' | 'sm'; onChange?: (code: string) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const emit = () => onChange?.(refs.current.map((el) => el?.value ?? '').join(''));

  return (
    <div role="group" aria-label={label} className="code-group">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className={size === 'sm' ? 'code code--sm' : 'code'}
          inputMode="numeric"
          maxLength={1}
          aria-label={`Dígito ${i + 1}`}
          onInput={(e) => {
            const t = e.currentTarget;
            t.value = t.value.replace(/\D/g, '').slice(0, 1);
            if (t.value) refs.current[i + 1]?.focus();
            emit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !e.currentTarget.value) refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6 - i);
            if (!digits) return;
            e.preventDefault();
            [...digits].forEach((d, k) => { const el = refs.current[i + k]; if (el) el.value = d; });
            refs.current[Math.min(i + digits.length, 5)]?.focus();
            emit();
          }}
        />
      ))}
    </div>
  );
}
