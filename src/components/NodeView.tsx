import type { Dispatch, SetStateAction } from 'react'
import { ensureBranchEdges } from '../utils/workflow'
import type { MenuTarget, NodeType, WorkflowNode } from '../types'

type NodeViewProps = {
  nodeId: string
  incomingLabel?: string
  nodes: Record<string, WorkflowNode>
  rootId: string
  menuTarget: MenuTarget | null
  setMenuTarget: Dispatch<SetStateAction<MenuTarget | null>>
  addNode: (parentId: string, branchLabel: string | null, type: NodeType) => void
  deleteNode: (targetId: string) => void
  updateLabel: (id: string, label: string) => void
  addBranchPath: (nodeId: string) => void
}

const NodeView = ({
  nodeId,
  incomingLabel,
  nodes,
  rootId,
  menuTarget,
  setMenuTarget,
  addNode,
  deleteNode,
  updateLabel,
  addBranchPath,
}: NodeViewProps) => {
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
            {node.type === 'action' ? 'Action' : node.type === 'branch' ? 'Branch' : 'End'}
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
                <NodeView
                  nodeId={edge.id}
                  incomingLabel={edge.label}
                  nodes={nodes}
                  rootId={rootId}
                  menuTarget={menuTarget}
                  setMenuTarget={setMenuTarget}
                  addNode={addNode}
                  deleteNode={deleteNode}
                  updateLabel={updateLabel}
                  addBranchPath={addBranchPath}
                />
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

export default NodeView
