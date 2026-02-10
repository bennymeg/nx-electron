import {
  checkFilesExist,
  ensureNxProject,
  readJson,
  runNxCommandAsync,
  uniq,
} from '@nx/plugin/testing';
describe('nx-electron e2e', () => {
  it('should create nx-electron', async () => {
    const plugin = uniq('nx-electron');
    ensureNxProject('nx-electron', 'dist/packages/nx-electron');
    await runNxCommandAsync(`generate nx-electron:application ${plugin}`);

    const result = await runNxCommandAsync(`build ${plugin}`);
    expect(result.stdout).toContain('compiled successfully');
  }, 120000);

  describe('--directory', () => {
    it('should create src in the specified directory', async () => {
      const plugin = uniq('nx-electron');
      ensureNxProject('nx-electron', 'dist/packages/nx-electron');
      await runNxCommandAsync(
        `generate nx-electron:application ${plugin} --directory subdir`,
      );
      expect(() =>
        checkFilesExist(`subdir/${plugin}/src/main.ts`),
      ).not.toThrow();
    }, 120000);
  });

  describe('--tags', () => {
    it('should add tags to the project', async () => {
      const plugin = uniq('nx-electron');
      ensureNxProject('nx-electron', 'dist/packages/nx-electron');
      await runNxCommandAsync(
        `generate nx-electron:application ${plugin} --tags e2etag,e2ePackage`,
      );
      const project = readJson(`${plugin}/project.json`);
      expect(project.tags).toBeUndefined();
    }, 120000);
  });
});
