import { describe, expect, it } from 'vitest';
import { resolveConnections } from './resolve-connections';

const custom = {
  id: 'local',
  name: 'ローカル用',
  url: 'https://example.test/license',
  headers: { Authorization: 'secret' },
};
describe('接続先の境界', () => {
  it.each([false, 'false', undefined, '1'])(
    '既定で独自接続を無効にする %s',
    (enabled) => {
      expect(resolveConnections(enabled, 'invalid json', false)).toHaveLength(
        2,
      );
    },
  );
  it.each([true, 'true'])(
    '明示的に有効化したローカルでは設定を検証する %s',
    (enabled) => {
      expect(
        resolveConnections(enabled, JSON.stringify([custom]), false)[2],
      ).toEqual({ ...custom, drm: 'widevine' });
      expect(resolveConnections(enabled, 'invalid json', true)).toHaveLength(2);
    },
  );
  it('重複IDや公開接続先の置き換えを拒否する', () => {
    expect(() =>
      resolveConnections(true, JSON.stringify([custom, custom]), false),
    ).toThrow();
    expect(() =>
      resolveConnections(
        true,
        JSON.stringify([{ ...custom, id: 'shaka-widevine' }]),
        false,
      ),
    ).toThrow();
  });
  it.each([
    'http://example.test/license',
    'https://user:password@example.test/license',
    'https://user@example.test/license',
  ])('HTTPS以外やURL認証情報を拒否する %s', (url) => {
    expect(() =>
      resolveConnections(true, JSON.stringify([{ ...custom, url }]), false),
    ).toThrow();
  });
  it('空の設定を許可する', () => {
    expect(resolveConnections(true, '[]', false)).toHaveLength(2);
  });
});
