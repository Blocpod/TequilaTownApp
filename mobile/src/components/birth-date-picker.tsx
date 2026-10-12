import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { PrintCard } from './ui/card';
import { WheelPicker } from './ui/wheel-picker';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const THIS_YEAR = new Date().getFullYear();

export type BirthDateParts = { month: string; day: string; year: string };

export const todayParts = (): BirthDateParts => {
  const t = new Date();
  return { month: String(t.getMonth()), day: String(t.getDate()), year: String(t.getFullYear()) };
};

/** Clamp the day to the selected month and return a local Date. */
export function partsToDate(p: BirthDateParts): Date {
  const days = new Date(Number(p.year), Number(p.month) + 1, 0).getDate();
  return new Date(Number(p.year), Number(p.month), Math.min(Number(p.day), days));
}

/** Month / day / year drum wheels in a printed card. */
export function BirthDatePicker({ value, onChange }: { value: BirthDateParts; onChange: (v: BirthDateParts) => void }) {
  const monthItems = useMemo(() => MONTHS.map((m, i) => ({ value: String(i), label: m })), []);
  const yearItems = useMemo(() => Array.from({ length: 100 }, (_, i) => String(THIS_YEAR - i)).map((y) => ({ value: y, label: y })), []);
  const daysInMonth = new Date(Number(value.year), Number(value.month) + 1, 0).getDate();
  const dayItems = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })), [daysInMonth]);
  const safeDay = String(Math.min(Number(value.day), daysInMonth));

  return (
    <PrintCard contentStyle={styles.wheels}>
      <WheelPicker label="Birth month" items={monthItems} value={value.month} onChange={(month) => onChange({ ...value, month })} style={{ flex: 1.5 }} />
      <WheelPicker label="Birth day" items={dayItems} value={safeDay} onChange={(day) => onChange({ ...value, day })} style={{ flex: 0.8 }} />
      <WheelPicker label="Birth year" items={yearItems} value={value.year} onChange={(year) => onChange({ ...value, year })} style={{ flex: 1.1 }} />
    </PrintCard>
  );
}

const styles = StyleSheet.create({
  wheels: { flexDirection: 'row', paddingHorizontal: 6 },
});
