import { describe, expect, it } from 'vitest';
import { nodeName, nodeStateLabel } from './node-label';

describe('nodeName', () => {
  it('uses the author’s title, or the type when it is empty', () => {
    expect(nodeName({ title: 'Ponte velha', type: 'battle' })).toBe('Ponte velha');
    expect(nodeName({ title: '  ', type: 'campfire' })).toBe('Fogueira');
  });
});

describe('nodeStateLabel', () => {
  it('names a cleared node by what clearing it means', () => {
    expect(nodeStateLabel({ type: 'boss', state: 'cleared' })).toBe('vencido');
    expect(nodeStateLabel({ type: 'narrative', state: 'cleared' })).toBe('lida');
    expect(nodeStateLabel({ type: 'shop', state: 'locked' })).toBe('bloqueado');
  });
});
