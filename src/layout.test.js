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
    expect(ruleFor('.exercise-detail-screen')).toContain('display: flex');
    expect(ruleFor('.exercise-detail-screen')).toContain('flex-direction: column');
    expect(ruleFor('.exercise-detail-screen > *')).toContain('flex: 0 0 auto');
    expect(ruleFor('.exercise-detail-hero')).toContain('min-height: 236px');
    expect(ruleFor('.exercise-detail-hero')).toContain('grid-template-columns: minmax(0, 1fr) minmax(118px, 42%)');
    expect(ruleFor('.exercise-detail-image-frame')).toContain('position: absolute');
    expect(ruleFor('.exercise-detail-image-frame')).toContain('width: 46%');
    expect(ruleFor('.exercise-detail-copy')).toContain('z-index: 1');
    expect(ruleFor('.exercise-detail-copy')).toContain('grid-column: 1');
    expect(ruleFor('.exercise-detail-image-frame img')).toContain('object-fit: contain');
    expect(ruleFor('.exercise-detail-image-frame img')).toContain('opacity: 0.76');
    expect(ruleFor('.exercise-detail-image-frame img')).not.toContain('object-fit: cover');
  });

  it('keeps the weekly recap card from overflowing on narrow screens', () => {
    expect(ruleFor('.weekly-recap-main')).toContain('display: grid');
    expect(ruleFor('.weekly-recap-main')).toContain('grid-template-columns: minmax(0, 1fr) minmax(96px, 42%)');
    expect(ruleFor('.weekly-recap-main > div')).toContain('min-width: 0');
    expect(ruleFor('.weekly-recap-volume strong')).toContain('font-size: clamp(18px, 5.7vw, 24px)');
    expect(ruleFor('.weekly-recap-volume strong')).toContain('text-overflow: ellipsis');
    expect(ruleFor('.metric-card span')).toContain('overflow-wrap: anywhere');
  });
});
