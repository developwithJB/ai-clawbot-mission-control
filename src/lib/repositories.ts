import {
  readRepoGraph as readRepoGraphFromDb,
  type RepoDependency,
  type RepoGraph,
  type RepoHealth,
  type RepoNode,
  type RepoStatus,
} from "@/lib/services/repositoryService";

export type { RepoDependency, RepoGraph, RepoHealth, RepoNode, RepoStatus };

export async function readRepoGraph(): Promise<RepoGraph> {
  return readRepoGraphFromDb();
}
