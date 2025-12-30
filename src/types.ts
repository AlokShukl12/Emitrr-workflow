export type NodeType = 'action' | 'branch' | 'end'

export type Edge = {
  id?: string
  label: string
}

export type WorkflowNode = {
  id: string
  label: string
  type: NodeType
  children: Edge[]
}

export type ParentMatch = { parentId: string; edgeIndex: number }
export type MenuTarget = { parentId: string; label: string | null }
