import type { Edge, NodeType, ParentMatch, WorkflowNode } from '../types'

const BRANCH_BASE = ['True', 'False']

export const cloneNodes = (map: Record<string, WorkflowNode>) => {
  const result: Record<string, WorkflowNode> = {}
  Object.values(map).forEach((node) => {
    result[node.id] = {
      ...node,
      children: node.children.map((edge) => ({ ...edge })),
    }
  })
  return result
}

export const ensureBranchEdges = (children: Edge[] = []) => {
  const edges = [...children]
  BRANCH_BASE.forEach((label) => {
    if (!edges.some((edge) => edge.label === label)) {
      edges.push({ label })
    }
  })
  return edges
}

export const createNode = (id: string, type: NodeType): WorkflowNode => {
  if (type === 'branch') {
    return { id, label: 'Branch', type, children: ensureBranchEdges([]) }
  }
  if (type === 'end') {
    return { id, label: 'End', type, children: [] }
  }
  return { id, label: 'Action', type, children: [] }
}

export const findParent = (
  currentId: string,
  targetId: string,
  map: Record<string, WorkflowNode>
): ParentMatch | null => {
  const node = map[currentId]
  if (!node) return null

  for (let i = 0; i < node.children.length; i += 1) {
    const childId = node.children[i].id
    if (childId === targetId) return { parentId: currentId, edgeIndex: i }
    if (childId) {
      const nested = findParent(childId, targetId, map)
      if (nested) return nested
    }
  }
  return null
}
