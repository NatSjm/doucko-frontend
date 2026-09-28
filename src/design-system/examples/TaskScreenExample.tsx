// Reference layout for the task screen (1280×720, desktop). Copy the structure, wire real data.
import { useState } from 'react';
import { AnswerPart, Button, Feedback, HintButton, HintCard, RankBadge, SubjectChip, TaskPrompt, XpBar } from '../index';

export function TaskScreenExample() {
  const [showUk, setShowUk] = useState(true);
  const [a, setA] = useState('12,35');
  const [b, setB] = useState('0,99');
  return (
    <div style={{ padding: 'var(--space-5) var(--space-7) var(--space-6)', display: 'grid', gap: 'var(--space-5)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontWeight: 600 }}>
          <SubjectChip subject="math" /> Výcvik 3: Zaokrouhlování
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
          <RankBadge rank="Parťačka" level={2} size="sm" />
          <div style={{ width: 320 }}><XpBar xp={1240} from={800} to={1500} /></div>
        </div>
      </header>
      <main style={{ maxWidth: 760, width: '100%', margin: '0 auto', display: 'grid', gap: 'var(--space-4)' }}>
        <TaskPrompt subject="math" power="Desetinná čísla" kicker="Úloha 4/10" attempts={1}
          prompt="Zaokrouhli čísla na setiny:  a) 12,348   b) 0,995"
          translation="Округли числа до сотих:  а) 12,348   б) 0,995"
          showTranslation={showUk} onToggleTranslation={() => setShowUk(!showUk)} onReport={() => {}} />
        <HintCard index={1} total={2}>Setiny jsou druhé místo za desetinnou čárkou.</HintCard>
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <AnswerPart label="a" value={a} onChange={(e) => setA(e.target.value)} state="correct" />
          <AnswerPart label="b" value={b} onChange={(e) => setB(e.target.value)} state="wrong" />
        </div>
        <Feedback kind="almost">Část b) ještě nesedí. Máš ještě jeden pokus.</Feedback>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <HintButton used={1} total={2} />
          <Button variant="primary" size="lg" iconAfter="arrow" type="submit">Odeslat</Button>
        </div>
      </main>
    </div>
  );
}
