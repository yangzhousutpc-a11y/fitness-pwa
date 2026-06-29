import type { CoachExerciseNote } from '../types';
import { withBase } from '../utils';

export function CoachCueCard({ note, defaultOpen = true }: { note: CoachExerciseNote; defaultOpen?: boolean }) {
  return (
    <details className="coach-cue-card" {...(defaultOpen ? { open: true } : {})}>
      <summary>
        <span>名师要点</span>
      </summary>
      <div className="coach-cue-body">
        {note.imageUrl ? (
          <img className="coach-cue-shot" src={withBase(note.imageUrl)} alt={`${note.sourceTitle} 动作示意图`} loading="lazy" />
        ) : null}
        <div className="coach-cue-copy">
          <p>{note.goal}</p>
          <div>
            <h4>跟练提示</h4>
            <ul>
              {note.keyCues.map((cue) => (
                <li key={cue}>{cue}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>避免</h4>
            <ul>
              {note.commonMistakes.map((mistake) => (
                <li key={mistake}>{mistake}</li>
              ))}
            </ul>
          </div>
          {note.regression ? <p className="regression-note">{note.regression}</p> : null}
          <a href={note.sourceUrl} target="_blank" rel="noreferrer">
            {note.sourceTitle}
          </a>
        </div>
      </div>
    </details>
  );
}
