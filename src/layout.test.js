import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

function ruleFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? '';
}

describe('app shell layout', () => {
  it('keeps the outer app height stable and scrolls each page internally', () => {
    expect(ruleFor('.app-shell')).toContain('height: 100dvh');
    expect(ruleFor('.app-shell')).toContain('overflow: hidden');
    expect(ruleFor('.screen')).toContain('overflow-y: auto');
    expect(ruleFor('.screen')).toContain('min-height: 0');
  });

  it('uses the same bottom scroll space for tab, detail, and workout pages', () => {
    expect(ruleFor('.with-nav')).toContain('padding-bottom: 118px');
    expect(ruleFor('.workout-screen')).toContain('padding-bottom: 118px');
  });

  it('shows coach cue illustrations without cropping the vertical artwork', () => {
    expect(ruleFor('.coach-cue-shot')).toContain('aspect-ratio: 9 / 16');
    expect(ruleFor('.coach-cue-shot')).toContain('object-fit: contain');
    expect(ruleFor('.coach-cue-shot')).not.toContain('max-height');
    expect(ruleFor('.coach-cue-shot')).not.toContain('object-fit: cover');
  });

  it('shows action profile hero images without cropping vertical artwork', () => {
    expect(ruleFor('.exercise-detail-hero img')).toContain('object-fit: contain');
    expect(ruleFor('.exercise-detail-hero img')).not.toContain('object-fit: cover');
    expect(ruleFor('.exercise-detail-hero > div')).not.toContain('position: absolute');
  });
});
