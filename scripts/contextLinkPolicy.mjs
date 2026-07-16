import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

export function resolveRepositoryMarkdownLink({ repositoryRoot, sourceFile, target }) {
  const targetPath = resolve(dirname(resolve(repositoryRoot, sourceFile)), target);
  const repositoryRelativePath = relative(repositoryRoot, targetPath);
  const escapesRepository =
    repositoryRelativePath === ".." || repositoryRelativePath.startsWith(`..${sep}`);

  return {
    isRepositoryLocal: !isAbsolute(target) && !escapesRepository,
    targetPath,
  };
}
