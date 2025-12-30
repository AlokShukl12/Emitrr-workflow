import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type NodeType = 'action' | 'branch' | 'end'

type Edge = {
  id?: string
  label: string
}

type WorkflowNode = {
  id: string
  label: string
  type: NodeType
  children: Edge[]
}

const BRANCH_BASE = ['True', 'False']

const STORAGE_KEY = 'workflow-builder-state'

const cloneNodes = (map: Record<string, WorkflowNode>) => {
  const result: Record<string, WorkflowNode> = {}
  Object.values(map).forEach((node) => {
    result[node.id] = {
      ...node,
      children: node.children.map((edge) => ({ ...edge })),
    }
  })
  return result
}

const ensureBranchEdges = (children: Edge[] = []) => {
  const edges = [...children]
  BRANCH_BASE.forEach((label) => {
    if (!edges.some((edge) => edge.label === label)) {
      edges.push({ label })
    }
  })
  return edges
}

const createNode = (id: string, type: NodeType): WorkflowNode => {
  if (type === 'branch') {
    return { id, label: 'Branch', type, children: ensureBranchEdges([]) }
  }
  if (type === 'end') {
    return { id, label: 'End', type, children: [] }
  }
  return { id, label: 'Action', type, children: [] }
}

type ParentMatch = { parentId: string; edgeIndex: number }
type MenuTarget = { parentId: string; label: string | null }

const findParent = (
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

function App() {
  const rootId = useMemo(() => 'node-0', [])
  const idCounter = useRef(1)
  const loadInitial = useMemo<Record<string, WorkflowNode>>(() => {
    if (typeof window === 'undefined') {
      return { [rootId]: { id: rootId, label: 'Start', type: 'action', children: [] } }
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) {
        return { [rootId]: { id: rootId, label: 'Start', type: 'action', children: [] } }
      }
      const parsed = JSON.parse(raw) as Record<string, WorkflowNode>
      if (!parsed[rootId]) {
        return { [rootId]: { id: rootId, label: 'Start', type: 'action', children: [] } }
      }
      return parsed
    } catch (error) {
      console.warn('Failed to load saved workflow; using default', error)
      return { [rootId]: { id: rootId, label: 'Start', type: 'action', children: [] } }
    }
  }, [rootId])

  const [nodes, setNodes] = useState<Record<string, WorkflowNode>>(() => cloneNodes(loadInitial))
  const [history, setHistory] = useState<Record<string, WorkflowNode>[]>(() => [
    cloneNodes(loadInitial),
  ])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null)

  useEffect(() => {
    const maxId = Object.keys(nodes).reduce((max, key) => {
      const num = Number(key.replace('node-', ''))
      return Number.isNaN(num) ? max : Math.max(max, num)
    }, 0)
    idCounter.current = maxId + 1
  }, [nodes])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nodes))
  }, [nodes])

  useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      const inPopover = target.closest('.popover')
      const inConnector = target.closest('.connector')
      if (!inPopover && !inConnector) {
        setMenuTarget(null)
      }
    }
    document.addEventListener('pointerdown', handleClickAway)
    return () => document.removeEventListener('pointerdown', handleClickAway)
  }, [])

  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      const isMeta = event.metaKey || event.ctrlKey
      if (!isMeta) return

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if (event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }
    document.addEventListener('keydown', handleKeys)
    return () => document.removeEventListener('keydown', handleKeys)
  }, [historyIndex, history])

  const nextId = () => {
    const value = idCounter.current
    idCounter.current += 1
    return `node-${value}`
  }

  const applyChange = (
    updater: (prev: Record<string, WorkflowNode>) => Record<string, WorkflowNode>,
    trackHistory = false
  ) => {
    setNodes((prev) => {
      const next = updater(prev)
      if (next === prev) return prev

      if (trackHistory) {
        const snapshot = cloneNodes(next)
        setHistory((hist) => {
          const trimmed = hist.slice(0, historyIndex + 1)
          return [...trimmed, snapshot]
        })
        setHistoryIndex((idx) => idx + 1)
      }

      return next
    })
    setMenuTarget(null)
  }

  const undo = () => {
    if (historyIndex === 0) return
    const nextIndex = historyIndex - 1
    setHistoryIndex(nextIndex)
    setNodes(cloneNodes(history[nextIndex]))
    setMenuTarget(null)
  }

  const redo = () => {
    if (historyIndex >= history.length - 1) return
    const nextIndex = historyIndex + 1
    setHistoryIndex(nextIndex)
    setNodes(cloneNodes(history[nextIndex]))
    setMenuTarget(null)
  }

  const logWorkflow = () => {
    // Console save hook; persisted to localStorage as well.
    console.log('Workflow snapshot', cloneNodes(nodes))
  }

  const attachExistingChild = (node: WorkflowNode, childId?: string) => {
    if (!childId) return node
    if (node.type === 'branch') {
      const edges = ensureBranchEdges(node.children)
      edges[0] = { ...edges[0], id: childId }
      node.children = edges
      return node
    }
    if (node.type === 'action') {
      node.children = [{ label: 'Next', id: childId }]
    }
    return node
  }

  const addNode = (parentId: string, branchLabel: string | null, type: NodeType) => {
    applyChange(
      (prev) => {
        const parent = prev[parentId]
        if (!parent || parent.type === 'end') return prev

        const newNode = createNode(nextId(), type)
        const updated: Record<string, WorkflowNode> = { ...prev, [newNode.id]: newNode }

        if (parent.type === 'action') {
          const existing = parent.children[0]?.id
          attachExistingChild(newNode, existing)
          updated[parentId] = { ...parent, children: [{ label: 'Next', id: newNode.id }] }
          return updated
        }

        if (parent.type === 'branch') {
          const edges = ensureBranchEdges(parent.children)
          const matchIndex = branchLabel
            ? edges.findIndex((edge) => edge.label === branchLabel)
            : 0
          const targetIndex = matchIndex === -1 ? 0 : matchIndex
          const priorTarget = edges[targetIndex].id

          attachExistingChild(newNode, priorTarget)
          edges[targetIndex] = { ...edges[targetIndex], id: newNode.id }
          updated[parentId] = { ...parent, children: edges }
        }

        return updated
      },
      true
    )
  }

  const deleteNode = (targetId: string) => {
    if (targetId === rootId) return

    applyChange(
      (prev) => {
        const relation = findParent(rootId, targetId, prev)
        if (!relation) return prev

        const { parentId, edgeIndex } = relation
        const parent = prev[parentId]
        const target = prev[targetId]
        if (!parent || !target) return prev

        const updated = { ...prev }
        delete updated[targetId]

        const adopted = target.children.filter((edge) => edge.id)

        if (parent.type === 'action') {
          const next = adopted[0]
          updated[parentId] = {
            ...parent,
            children: next
              ? [{ label: parent.children[edgeIndex]?.label ?? 'Next', id: next.id }]
              : [],
          }
          return updated
        }

        if (parent.type === 'branch') {
          const edges = ensureBranchEdges([...parent.children])
          const base = edges[edgeIndex] ?? { label: 'Next' }

          if (adopted.length === 0) {
            edges[edgeIndex] = { ...base, id: undefined }
          } else if (adopted.length === 1) {
            edges[edgeIndex] = { ...base, id: adopted[0].id }
          } else {
            const replacements = adopted.map((edge, idx) => ({
              label: edge.label ? `${base.label} + ${edge.label}` : `${base.label} path ${idx + 1}`,
              id: edge.id,
            }))
            edges.splice(edgeIndex, 1, ...replacements)
          }

          const ensured = ensureBranchEdges(edges)
          updated[parentId] = { ...parent, children: ensured }
        }

        return updated
      },
      true
    )
  }

  const updateLabel = (id: string, label: string) => {
    setNodes((prev) => ({
      ...prev,
      [id]: prev[id] ? { ...prev[id], label } : prev[id],
    }))
  }

  const addBranchPath = (nodeId: string) => {
    applyChange((prev) => {
      const node = prev[nodeId]
      if (!node || node.type !== 'branch') return prev
      const nextLabel = `Path ${node.children.length + 1}`
      const children = [...node.children, { label: nextLabel }]
      return { ...prev, [nodeId]: { ...node, children } }
    }, true)
  }

  type NodeViewProps = { nodeId: string; incomingLabel?: string }

  const NodeView = ({ nodeId, incomingLabel }: NodeViewProps) => {
    const node = nodes[nodeId]
    if (!node) return null

    const edges =
      node.type === 'branch'
        ? ensureBranchEdges(node.children)
        : node.type === 'action'
          ? node.children.length
            ? node.children
            : [{ label: 'Next' }]
          : []

    const openMenu = (label: string | null) => {
      setMenuTarget((prev) => {
        if (prev && prev.parentId === nodeId && prev.label === label) return null
        return { parentId: nodeId, label }
      })
    }

    const isMenuOpen = (label: string | null) =>
      menuTarget?.parentId === nodeId && menuTarget.label === label

    const handleInsert = (label: string | null, type: NodeType) => {
      addNode(nodeId, node.type === 'branch' ? label : null, type)
      setMenuTarget(null)
    }

    return (
      <div className="node-wrapper">
        {incomingLabel ? <div className="incoming">{incomingLabel}</div> : null}
        <div className={`node-card ${node.type}`}>
          <div className="node-top">
            <span className="badge">
              {node.type === 'action'
                ? 'Action'
                : node.type === 'branch'
                  ? 'Branch'
                  : 'End'}
            </span>
            <input
              className="node-input"
              value={node.label}
              onChange={(event) => updateLabel(nodeId, event.target.value)}
            />
          </div>
          <div className="node-tools">
            {node.type === 'branch' ? (
              <button className="ghost" onClick={() => addBranchPath(nodeId)}>
                + Add branch path
              </button>
            ) : null}
            {nodeId !== rootId ? (
              <button className="ghost danger" onClick={() => deleteNode(nodeId)}>
                Delete node
              </button>
            ) : null}
          </div>
        </div>

        {edges.length ? (
          <div className="children">
            {edges.map((edge, index) => (
              <div className="child-row" key={`${edge.label}-${index}`}>
                <div className="edge-label">{edge.label}</div>
                <div className="edge-actions">
                  <button
                    className={`connector ${isMenuOpen(node.type === 'branch' ? edge.label : null) ? 'active' : ''}`}
                    onClick={() => openMenu(node.type === 'branch' ? edge.label : null)}
                  >
                    <span className="connector-dot" />
                    <span>{edge.id ? 'Insert step' : 'Add step'}</span>
                  </button>

                  {isMenuOpen(node.type === 'branch' ? edge.label : null) ? (
                    <div className="popover" onClick={(event) => event.stopPropagation()}>
                      <p className="popover-title">Choose node type</p>
                      <div className="action-buttons">
                        <button onClick={() => handleInsert(edge.label, 'action')}>Action</button>
                        <button onClick={() => handleInsert(edge.label, 'branch')}>Branch</button>
                        <button onClick={() => handleInsert(edge.label, 'end')}>End</button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {edge.id ? (
                  <NodeView nodeId={edge.id} incomingLabel={edge.label} />
                ) : (
                  <div className="empty-slot">
                    <div className="slot-indicator">
                      <button
                        className={`connector subtle ${isMenuOpen(node.type === 'branch' ? edge.label : null) ? 'active' : ''}`}
                        onClick={() => openMenu(node.type === 'branch' ? edge.label : null)}
                      >
                        <span className="connector-dot" />
                        <span>New step</span>
                      </button>
                    </div>
                    <p className="muted">No step yet</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="header">
        <div>
          <p className="eyebrow">Workflow Builder</p>
          <h1>Design conditional journeys with live editing</h1>
          <p className="lede">
            Add actions, split on branches, and keep labels in sync. Delete a node and its
            parent rewires to the next available step automatically.
          </p>
        </div>
        <div className="header-actions">
          <div className="legend">
            <span className="legend-item action">Action</span>
            <span className="legend-item branch">Branch</span>
            <span className="legend-item end">End</span>
          </div>
          <div className="toolbar">
            <button className="ghost" onClick={logWorkflow}>
              Save (console)
            </button>
            <button className="ghost" onClick={undo} disabled={historyIndex === 0}>
              Undo
            </button>
            <button
              className="ghost"
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
            >
              Redo
            </button>
          </div>
        </div>
      </header>

      <main className="canvas">
        <NodeView nodeId={rootId} />
      </main>
    </div>
  )
}

export default App
